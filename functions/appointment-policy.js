"use strict";

const { calendarSlotIsAvailable } = require("./calendar-policy");

const CALENDAR_FRESHNESS_MS = 5 * 60 * 1000;
const APPOINTMENT_IDEMPOTENCY_MS = 24 * 60 * 60 * 1000;
const MAX_APPOINTMENT_REQUESTS_PER_DAY = 10;

function calendarIsFresh(availability, now = new Date()) {
  const fetchedValue = availability?.fetchedAt?.toDate ? availability.fetchedAt.toDate() : availability?.fetchedAt;
  const fetchedAt = new Date(fetchedValue || "").getTime();
  const age = now.getTime() - fetchedAt;
  return availability?.status === "available" && Number.isFinite(fetchedAt) && age >= 0 && age <= CALENDAR_FRESHNESS_MS;
}

function slotIsEligible(slot, appointmentType, now = new Date()) {
  if (!slot || !appointmentType || slot.status !== "open" || appointmentType.enabled === false) return false;
  if (slot.appointmentTypeId !== appointmentType.id || slot.locationId !== appointmentType.locationId) return false;
  const startsAt = new Date(slot.startsAt).getTime();
  const endsAt = new Date(slot.endsAt).getTime();
  const durationWithBuffer = (endsAt - startsAt) / 60000;
  const maxStart = now.getTime() + Number(appointmentType.maximumWindowDays) * 24 * 60 * 60 * 1000;
  return Number.isFinite(startsAt) && Number.isFinite(endsAt) &&
    durationWithBuffer >= Number(appointmentType.durationMinutes) + Number(appointmentType.bufferMinutes) &&
    startsAt >= now.getTime() + Number(appointmentType.minimumLeadMinutes) * 60 * 1000 &&
    startsAt <= maxStart;
}

function createReservationDecision({ requestFingerprint, appointmentId, existingIdempotency, slot, appointmentType, calendarSnapshot, now = new Date() }) {
  if (idempotencyIsActive(existingIdempotency, now)) {
    return existingIdempotency.requestFingerprint === requestFingerprint
      ? { kind: "replay", appointmentId: existingIdempotency.appointmentId }
      : { kind: "reject", code: "idempotency_conflict" };
  }

  if (!calendarIsFresh(calendarSnapshot, now)) return { kind: "reject", code: "calendar_stale" };
  if (!slotIsEligible(slot, appointmentType, now) || !calendarSlotIsAvailable(calendarSnapshot, slot)) return { kind: "reject", code: "slot_unavailable" };
  if (appointmentType.confirmationPolicy === "manual") {
    return { kind: "create", appointment: { id: appointmentId, status: "requested" } };
  }
  if (appointmentType.confirmationPolicy !== "immediate") return { kind: "reject", code: "invalid_confirmation_policy" };

  return {
    kind: "create",
    appointment: { id: appointmentId, status: "confirmed" },
    slotPatch: { status: "reserved", appointmentId },
    integrationOutbox: { id: `${appointmentId}:confirmed`, action: "create", medarioAppointmentId: appointmentId, startsAt: slot.startsAt, endsAt: slot.endsAt },
  };
}

function idempotencyIsActive(record, now = new Date()) {
  if (!record) return false;
  const expiresAt = record.expiresAt?.toDate ? record.expiresAt.toDate() : new Date(record.expiresAt || "");
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

function appointmentRequestQuotaDecision(record, now = new Date(), maximum = MAX_APPOINTMENT_REQUESTS_PER_DAY) {
  const expiresAt = record?.expiresAt?.toDate ? record.expiresAt.toDate() : new Date(record?.expiresAt || "");
  const active = !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
  const count = active && Number.isInteger(record?.count) ? record.count : 0;
  return count >= maximum
    ? { allowed: false, count }
    : { allowed: true, count: count + 1, expiresAt: new Date(now.getTime() + APPOINTMENT_IDEMPOTENCY_MS) };
}

function cancellationDecision(appointment, slot, now = new Date()) {
  if (!appointment) return { kind: "reject", code: "not_found" };
  if (appointment.status === "cancelled") return { kind: "replay", status: "cancelled" };
  if (appointment.status === "requested") return { kind: "cancel", status: "cancelled" };
  if (appointment.status !== "confirmed") return { kind: "reject", code: "not_cancellable" };
  const startsAt = appointment.startsAt?.toDate ? appointment.startsAt.toDate() : new Date(appointment.startsAt || "");
  const noticeMinutes = Number.isInteger(appointment.cancellationNoticeMinutes) ? appointment.cancellationNoticeMinutes : 0;
  const remainingMs = startsAt.getTime() - now.getTime();
  if (Number.isNaN(startsAt.getTime()) || remainingMs <= 0 || remainingMs < noticeMinutes * 60 * 1000) {
    return { kind: "reject", code: "cancellation_window_closed" };
  }
  const ownsReservedSlot = slot?.status === "reserved" && slot?.appointmentId === appointment.id;
  if (!ownsReservedSlot) return { kind: "reject", code: "slot_mismatch" };
  return {
    kind: "cancel",
    status: "cancelled",
    slotPatch: { status: "open" },
    integrationOutbox: { id: `${appointment.id}:cancelled`, action: "cancel", medarioAppointmentId: appointment.id },
  };
}

function canTransitionAppointment(from, to) {
  const allowed = {
    requested: ["confirmed", "declined", "reschedule_proposed", "cancel_requested"],
    held: ["confirmed", "declined", "cancelled"],
    confirmed: ["reschedule_proposed", "reschedule_requested", "cancel_requested", "completed", "no_show"],
    reschedule_requested: ["confirmed", "cancel_requested", "cancelled"],
    declined: [],
    reschedule_proposed: ["requested", "cancel_requested", "cancelled"],
    cancel_requested: ["cancelled", "confirmed"],
    cancelled: [],
    completed: [],
    no_show: [],
  };
  return Boolean(allowed[from]?.includes(to));
}

module.exports = {
  APPOINTMENT_IDEMPOTENCY_MS,
  CALENDAR_FRESHNESS_MS,
  MAX_APPOINTMENT_REQUESTS_PER_DAY,
  appointmentRequestQuotaDecision,
  calendarIsFresh,
  cancellationDecision,
  canTransitionAppointment,
  createReservationDecision,
  idempotencyIsActive,
  slotIsEligible,
};
