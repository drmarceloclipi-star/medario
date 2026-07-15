"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { calendarIsFresh, canTransitionAppointment, createReservationDecision, slotIsEligible } = require("./appointment-policy");

const now = new Date("2030-01-01T09:00:00.000Z");
const appointmentType = { id: "type-1", locationId: "clinic-1", durationMinutes: 30, bufferMinutes: 15, minimumLeadMinutes: 30, maximumWindowDays: 7, enabled: true };
const slot = { appointmentTypeId: "type-1", locationId: "clinic-1", startsAt: "2030-01-01T10:00:00.000Z", endsAt: "2030-01-01T10:45:00.000Z", status: "open" };

test("accepts only a fresh available calendar snapshot", () => {
  assert.equal(calendarIsFresh({ status: "available", fetchedAt: "2030-01-01T08:55:00.000Z" }, now), true);
  assert.equal(calendarIsFresh({ status: "available", fetchedAt: "2030-01-01T08:54:59.999Z" }, now), false);
  assert.equal(calendarIsFresh({ status: "conflict", fetchedAt: "2030-01-01T08:59:00.000Z" }, now), false);
});

test("rejects double-booked, short, and incompatible slots", () => {
  assert.equal(slotIsEligible(slot, appointmentType, now), true);
  assert.equal(slotIsEligible({ ...slot, status: "held" }, appointmentType, now), false);
  assert.equal(slotIsEligible({ ...slot, endsAt: "2030-01-01T10:30:00.000Z" }, appointmentType, now), false);
  assert.equal(slotIsEligible({ ...slot, appointmentTypeId: "type-2" }, appointmentType, now), false);
});

test("does not reserve a manual request but atomically confirms an immediate request", () => {
  const manual = createReservationDecision({ requestFingerprint: "a", appointmentId: "appointment-1", appointmentType: { ...appointmentType, confirmationPolicy: "manual" }, now });
  const immediate = createReservationDecision({ requestFingerprint: "b", appointmentId: "appointment-2", slot, appointmentType: { ...appointmentType, confirmationPolicy: "immediate" }, calendarSnapshot: { status: "available", fetchedAt: "2030-01-01T08:59:00.000Z", busy: [] }, now });

  assert.deepEqual(manual, { kind: "create", appointment: { id: "appointment-1", status: "requested" } });
  assert.equal(immediate.appointment.status, "confirmed");
  assert.deepEqual(immediate.slotPatch, { status: "reserved", appointmentId: "appointment-2" });
  assert.deepEqual(immediate.integrationOutbox, { id: "appointment-2:confirmed", medarioAppointmentId: "appointment-2", startsAt: slot.startsAt, endsAt: slot.endsAt });
});

test("replays same idempotency key and rejects a conflicting payload", () => {
  const existing = { requestFingerprint: "same", appointmentId: "appointment-1", status: "confirmed" };

  assert.deepEqual(createReservationDecision({ requestFingerprint: "same", appointmentId: "new", existingIdempotency: existing }), { kind: "replay", appointmentId: "appointment-1", status: "confirmed" });
  assert.deepEqual(createReservationDecision({ requestFingerprint: "different", appointmentId: "new", existingIdempotency: existing }), { kind: "reject", code: "idempotency_conflict" });
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
