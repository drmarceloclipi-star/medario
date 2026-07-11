"use strict";

const CALENDAR_FRESHNESS_MS = 5 * 60 * 1000;

function calendarIsFresh(availability, now = new Date()) {
  const fetchedAt = new Date(availability?.fetchedAt || "").getTime();
  return availability?.status === "available" && Number.isFinite(fetchedAt) && now.getTime() - fetchedAt <= CALENDAR_FRESHNESS_MS;
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
  if (existingIdempotency) {
    return existingIdempotency.requestFingerprint === requestFingerprint
      ? { kind: "replay", appointmentId: existingIdempotency.appointmentId, status: existingIdempotency.status }
      : { kind: "reject", code: "idempotency_conflict" };
  }

  if (appointmentType.confirmationPolicy === "manual") {
    return { kind: "create", appointment: { id: appointmentId, status: "requested" } };
  }

  if (!calendarIsFresh(calendarSnapshot, now)) return { kind: "reject", code: "calendar_stale" };
  if (!slotIsEligible(slot, appointmentType, now)) return { kind: "reject", code: "slot_unavailable" };

  return {
    kind: "create",
    appointment: { id: appointmentId, status: "confirmed" },
    slotPatch: { status: "reserved", appointmentId },
    integrationOutbox: { id: `${appointmentId}:confirmed`, medarioAppointmentId: appointmentId, startsAt: slot.startsAt, endsAt: slot.endsAt },
  };
}

function canTransitionAppointment(from, to) {
  const allowed = {
    requested: ["confirmed", "declined", "reschedule_proposed", "cancel_requested"],
    held: ["confirmed", "declined", "cancelled"],
    confirmed: ["reschedule_proposed", "cancel_requested", "completed", "no_show"],
    declined: [],
    reschedule_proposed: ["requested", "cancel_requested", "cancelled"],
    cancel_requested: ["cancelled", "confirmed"],
    cancelled: [],
    completed: [],
    no_show: [],
  };
  return Boolean(allowed[from]?.includes(to));
}

module.exports = { CALENDAR_FRESHNESS_MS, calendarIsFresh, slotIsEligible, createReservationDecision, canTransitionAppointment };
