"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  appointmentRequestQuotaDecision,
  calendarIsFresh,
  cancellationDecision,
  canTransitionAppointment,
  createReservationDecision,
  idempotencyIsActive,
  slotIsEligible,
} = require("./appointment-policy");

const now = new Date("2030-01-01T09:00:00.000Z");
const appointmentType = { id: "type-1", locationId: "clinic-1", durationMinutes: 30, bufferMinutes: 15, minimumLeadMinutes: 30, maximumWindowDays: 7, enabled: true };
const slot = { appointmentTypeId: "type-1", locationId: "clinic-1", startsAt: "2030-01-01T10:00:00.000Z", endsAt: "2030-01-01T10:45:00.000Z", status: "open" };

test("accepts only a fresh available calendar snapshot", () => {
  assert.equal(calendarIsFresh({ status: "available", fetchedAt: "2030-01-01T08:55:00.000Z" }, now), true);
  assert.equal(calendarIsFresh({ status: "available", fetchedAt: "2030-01-01T08:54:59.999Z" }, now), false);
  assert.equal(calendarIsFresh({ status: "conflict", fetchedAt: "2030-01-01T08:59:00.000Z" }, now), false);
  assert.equal(calendarIsFresh({ status: "available", fetchedAt: { toDate: () => new Date("2030-01-01T08:59:00.000Z") } }, now), true);
  assert.equal(calendarIsFresh({ status: "available", fetchedAt: "2030-01-01T09:00:00.001Z" }, now), false);
});

test("fails closed for an unknown confirmation policy", () => {
  const decision = createReservationDecision({
    requestFingerprint: "fp",
    appointmentId: "a1",
    slot,
    appointmentType: { ...appointmentType, confirmationPolicy: "legacy-invalid" },
    calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] },
    now,
  });
  assert.deepEqual(decision, { kind: "reject", code: "invalid_confirmation_policy" });
});

test("rejects double-booked, short, and incompatible slots", () => {
  assert.equal(slotIsEligible(slot, appointmentType, now), true);
  assert.equal(slotIsEligible({ ...slot, status: "held" }, appointmentType, now), false);
  assert.equal(slotIsEligible({ ...slot, endsAt: "2030-01-01T10:30:00.000Z" }, appointmentType, now), false);
  assert.equal(slotIsEligible({ ...slot, appointmentTypeId: "type-2" }, appointmentType, now), false);
});

test("does not reserve a manual request but atomically confirms an immediate request", () => {
  const calendarSnapshot = { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] };
  const manual = createReservationDecision({ requestFingerprint: "a", appointmentId: "appointment-1", slot, appointmentType: { ...appointmentType, confirmationPolicy: "manual" }, calendarSnapshot, now });
  const immediate = createReservationDecision({ requestFingerprint: "b", appointmentId: "appointment-2", slot, appointmentType: { ...appointmentType, confirmationPolicy: "immediate" }, calendarSnapshot, now });

  assert.deepEqual(manual, { kind: "create", appointment: { id: "appointment-1", status: "requested" } });
  assert.equal(immediate.appointment.status, "confirmed");
  assert.deepEqual(immediate.slotPatch, { status: "reserved", appointmentId: "appointment-2" });
  assert.deepEqual(immediate.integrationOutbox, { id: "appointment-2:confirmed", action: "create", medarioAppointmentId: "appointment-2", startsAt: slot.startsAt, endsAt: slot.endsAt });
});

test("manual policy still rejects missing, stale, incompatible, or disabled slots", () => {
  const input = { requestFingerprint: "a", appointmentId: "appointment-1", slot, appointmentType: { ...appointmentType, confirmationPolicy: "manual" }, now };
  assert.deepEqual(createReservationDecision(input), { kind: "reject", code: "calendar_stale" });
  assert.deepEqual(createReservationDecision({ ...input, slot: null, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] } }), { kind: "reject", code: "slot_unavailable" });
  assert.deepEqual(createReservationDecision({ ...input, appointmentType: { ...input.appointmentType, enabled: false }, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] } }), { kind: "reject", code: "slot_unavailable" });
});

test("replays active idempotency and lets an expired key create again", () => {
  const existing = { requestFingerprint: "same", appointmentId: "appointment-1", expiresAt: "2030-01-01T10:00:00.000Z" };

  assert.deepEqual(createReservationDecision({ requestFingerprint: "same", appointmentId: "new", existingIdempotency: existing, now }), { kind: "replay", appointmentId: "appointment-1" });
  assert.deepEqual(createReservationDecision({ requestFingerprint: "different", appointmentId: "new", existingIdempotency: existing, now }), { kind: "reject", code: "idempotency_conflict" });
  assert.equal(idempotencyIsActive({ ...existing, expiresAt: "2030-01-01T08:59:59.999Z" }, now), false);
  const recreated = createReservationDecision({ requestFingerprint: "different", appointmentId: "new", existingIdempotency: { ...existing, expiresAt: "2030-01-01T08:59:59.999Z" }, slot, appointmentType: { ...appointmentType, confirmationPolicy: "manual" }, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] }, now });
  assert.equal(recreated.kind, "create");
});

test("daily quota resets after expiry and rejects the eleventh request", () => {
  const ninth = appointmentRequestQuotaDecision({ count: 9, expiresAt: "2030-01-02T09:00:00.000Z" }, now);
  const tenth = appointmentRequestQuotaDecision({ count: 10, expiresAt: "2030-01-02T09:00:00.000Z" }, now);
  const expired = appointmentRequestQuotaDecision({ count: 10, expiresAt: "2030-01-01T08:00:00.000Z" }, now);
  assert.equal(ninth.allowed, true);
  assert.equal(ninth.count, 10);
  assert.deepEqual(tenth, { allowed: false, count: 10 });
  assert.equal(expired.count, 1);
});

test("cancellation is idempotent and releases only the appointment owned slot", () => {
  const requested = { id: "a-1", status: "requested" };
  const confirmed = { id: "a-1", status: "confirmed", startsAt: "2030-01-01T10:00:00.000Z" };
  assert.deepEqual(cancellationDecision(requested), { kind: "cancel", status: "cancelled" });
  assert.deepEqual(cancellationDecision({ ...requested, status: "cancelled" }), { kind: "replay", status: "cancelled" });
  assert.deepEqual(cancellationDecision(confirmed, { status: "reserved", appointmentId: "other" }), { kind: "reject", code: "slot_mismatch" });
  assert.deepEqual(cancellationDecision(confirmed, { status: "reserved", appointmentId: "a-1" }), {
    kind: "cancel",
    status: "cancelled",
    slotPatch: { status: "open" },
    integrationOutbox: { id: "a-1:cancelled", action: "cancel", medarioAppointmentId: "a-1" },
  });
  assert.deepEqual(cancellationDecision(confirmed, { status: "reserved", appointmentId: "a-1" }, new Date("2030-01-01T10:00:00.000Z")), { kind: "reject", code: "cancellation_window_closed" });
  assert.deepEqual(cancellationDecision({ ...confirmed, cancellationNoticeMinutes: 120 }, { status: "reserved", appointmentId: "a-1" }, now), { kind: "reject", code: "cancellation_window_closed" });
});

test("never confirms an immediate request with stale availability or an unavailable slot", () => {
  const input = { requestFingerprint: "a", appointmentId: "appointment-1", slot, appointmentType: { ...appointmentType, confirmationPolicy: "immediate" }, now };

  assert.deepEqual(createReservationDecision({ ...input, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:54:59.999Z" } }), { kind: "reject", code: "calendar_stale" });
  assert.deepEqual(createReservationDecision({ ...input, slot: { ...slot, status: "reserved" }, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] } }), { kind: "reject", code: "slot_unavailable" });
  assert.deepEqual(createReservationDecision({ ...input, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [{ start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T10:30:00.000Z" }] } }), { kind: "reject", code: "slot_unavailable" });
});

test("does not resurrect cancelled or completed appointments", () => {
  assert.equal(canTransitionAppointment("requested", "confirmed"), true);
  assert.equal(canTransitionAppointment("confirmed", "completed"), true);
  assert.equal(canTransitionAppointment("cancelled", "confirmed"), false);
  assert.equal(canTransitionAppointment("completed", "cancelled"), false);
});
