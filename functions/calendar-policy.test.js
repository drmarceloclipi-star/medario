"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { busyIntervalsFrom, calendarEventId, calendarSlotIsAvailable } = require("./calendar-policy");

test("keeps only valid Google busy intervals", () => {
  const busy = busyIntervalsFrom({ calendars: { "calendar-id": { busy: [
    { start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T10:30:00.000Z" },
    { start: "2030-01-01T12:00:00.000Z", end: "2030-01-01T12:00:00.000Z" },
  ] } } }, "calendar-id");
  assert.deepEqual(busy, [{ start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T10:30:00.000Z" }]);
  assert.throws(() => busyIntervalsFrom({}, "calendar-id"), /availability unavailable/);
});

test("rejects slots that overlap Google busy time", () => {
  const availability = { busy: [{ start: "2030-01-01T10:00:00.000Z", end: "2030-01-01T10:30:00.000Z" }] };
  assert.equal(calendarSlotIsAvailable(availability, { startsAt: "2030-01-01T09:30:00.000Z", endsAt: "2030-01-01T10:00:00.000Z" }), true);
  assert.equal(calendarSlotIsAvailable(availability, { startsAt: "2030-01-01T10:15:00.000Z", endsAt: "2030-01-01T10:45:00.000Z" }), false);
  assert.equal(calendarSlotIsAvailable({}, { startsAt: "2030-01-01T09:30:00.000Z", endsAt: "2030-01-01T10:00:00.000Z" }), false);
});

test("uses a stable Google-compatible event id", () => {
  assert.match(calendarEventId("appointment-1"), /^m[a-f0-9]{40}$/);
  assert.equal(calendarEventId("appointment-1"), calendarEventId("appointment-1"));
});
