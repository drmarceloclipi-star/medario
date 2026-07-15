"use strict";

const crypto = require("node:crypto");

function calendarEventId(medarioAppointmentId) {
  return `m${crypto.createHash("sha256").update(String(medarioAppointmentId)).digest("hex").slice(0, 40)}`;
}

function busyIntervalsFrom(response, calendarId) {
  const busy = response?.calendars?.[calendarId]?.busy;
  if (!Array.isArray(busy)) throw new Error("calendar availability unavailable");
  return busy.flatMap((item) => {
    const start = new Date(item?.start).toISOString();
    const end = new Date(item?.end).toISOString();
    return new Date(start).getTime() < new Date(end).getTime() ? [{ start, end }] : [];
  });
}

function calendarSlotIsAvailable(availability, slot) {
  if (!Array.isArray(availability?.busy)) return false;
  const start = new Date(slot?.startsAt || "").getTime();
  const end = new Date(slot?.endsAt || "").getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return false;
  return availability.busy.every((interval) => {
    const busyStart = new Date(interval?.start || "").getTime();
    const busyEnd = new Date(interval?.end || "").getTime();
    return !Number.isFinite(busyStart) || !Number.isFinite(busyEnd) || end <= busyStart || start >= busyEnd;
  });
}

module.exports = { busyIntervalsFrom, calendarEventId, calendarSlotIsAvailable };
