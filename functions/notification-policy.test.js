"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { defaultPreferences, notificationEnabled, notificationOutboxRecord, preferencesFrom } = require("./notification-policy");

test("defaults every notification preference to denied", () => {
  assert.equal(notificationEnabled(defaultPreferences(), "appointment_confirmed", "email"), false);
  assert.equal(notificationEnabled(defaultPreferences(), "profile_updated", "push"), false);
});

test("normalizes only known event and channel preferences", () => {
  const preferences = preferencesFrom({ appointment_confirmed: { email: true }, profile_updated: { push: true } });

  assert.equal(notificationEnabled(preferences, "appointment_confirmed", "email"), true);
  assert.equal(notificationEnabled(preferences, "appointment_confirmed", "whatsapp"), false);
  assert.throws(() => preferencesFrom({ promotion: { email: true } }));
  assert.throws(() => preferencesFrom({ appointment_confirmed: { sms: true } }));
});

test("outbox stores only metadata and never health or contact content", () => {
  const record = notificationOutboxRecord({ id: "n-1", event: "appointment_confirmed", channel: "email", recipientUid: "user-1", subjectRef: "appointment-1", now: new Date("2030-01-01T10:00:00Z") });

  assert.deepEqual(Object.keys(record).sort(), ["attempts", "channel", "createdAt", "event", "id", "recipientUid", "state", "subjectRef"]);
  assert.doesNotMatch(JSON.stringify(record), /email@|phone|symptom|query|location|diagnos/i);
});
