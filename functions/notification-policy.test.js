"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { defaultPreferences, enabledChannels, notificationEnabled, notificationOutboxRecord, preferencesFrom, providerlessDeliveryState } = require("./notification-policy");

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

test("fans out only through explicitly enabled channels", () => {
  const preferences = preferencesFrom({ appointment_confirmed: { email: true, whatsapp: true, push: false } });

  assert.deepEqual(enabledChannels(preferences, "appointment_confirmed"), ["email", "whatsapp"]);
  assert.deepEqual(enabledChannels(preferences, "saved_search_material"), []);
  assert.deepEqual(enabledChannels(preferences, "promotion"), []);
});

test("rechecks a revocation before providerless processing", () => {
  const enabled = preferencesFrom({ appointment_confirmed: { email: true } });

  assert.equal(providerlessDeliveryState(enabled, "appointment_confirmed", "email"), "blocked_provider_not_configured");
  assert.equal(providerlessDeliveryState(defaultPreferences(), "appointment_confirmed", "email"), "suppressed_revoked");
});

test("outbox stores only metadata and never health or contact content", () => {
  const record = notificationOutboxRecord({ id: "n-1", event: "appointment_confirmed", channel: "email", recipientUid: "user-1", subjectRef: "appointment-1", now: new Date("2030-01-01T10:00:00Z") });

  assert.deepEqual(Object.keys(record).sort(), ["attempts", "channel", "createdAt", "event", "id", "recipientUid", "state", "subjectRef"]);
  assert.doesNotMatch(JSON.stringify(record), /email@|phone|symptom|query|location|diagnos/i);
});
