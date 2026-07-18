"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { defaultPreferences, enabledChannels, notificationEnabled, notificationOutboxRecord, preferencesFrom, preferencesFromDocument, providerlessDeliveryState, safePushMessage } = require("./notification-policy");

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

test("reads stored preference documents without treating server metadata as user input", () => {
  const preferences = preferencesFromDocument({
    appointment_confirmed: { push: true },
    updatedAt: new Date(),
    version: 1,
  });

  assert.equal(notificationEnabled(preferences, "appointment_confirmed", "push"), true);
  assert.equal(notificationEnabled(preferences, "profile_updated", "push"), false);
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

test("push copy never exposes specialty, symptoms, patient identity, or exact location", () => {
  for (const event of ["appointment_confirmed", "profile_updated", "saved_search_material"]) {
    const message = safePushMessage(event);
    const serialized = JSON.stringify(message).toLowerCase();
    for (const forbidden of ["cardio", "sintoma", "paciente", "email", "telefone", "endereço", "diagnóstico"]) {
      assert.equal(serialized.includes(forbidden), false);
    }
    assert.match(message.destination, /^(appointments|saved_items)$/);
  }
});
