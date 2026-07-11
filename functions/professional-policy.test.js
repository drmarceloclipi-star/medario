"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { canCreateIdentifiedLead, leadMetricsFrom, profileChangesFrom } = require("./professional-policy");

test("accepts only verifiable profile changes", () => {
  assert.deepEqual(profileChangesFrom({ rqe: "RQE 1234", availability: "Aceita novos pacientes", location: { city: "Joinville", authorized: true } }), { rqe: "RQE 1234", availability: "Aceita novos pacientes", location: { city: "Joinville", authorized: true } });
  assert.throws(() => profileChangesFrom({ bio: "texto livre" }));
  assert.throws(() => profileChangesFrom({ location: { latitude: -26.3 } }));
});

test("keeps anonymous metrics free of health and location content", () => {
  const metrics = leadMetricsFrom({ profileViews: 12, externalContactOpens: 4, appointmentRequests: 2, query: "dor no peito", symptoms: ["dor"], exactLocation: { lat: 1 } });

  assert.deepEqual(metrics, { profileViews: 12, externalContactOpens: 4, appointmentRequests: 2 });
  assert.equal(JSON.stringify(metrics).match(/query|symptom|location|dor/i), null);
});

test("creates identified leads only after explicit identification", () => {
  assert.equal(canCreateIdentifiedLead("appointment_request"), true);
  assert.equal(canCreateIdentifiedLead("external_contact_identified"), true);
  assert.equal(canCreateIdentifiedLead("profile_view"), false);
});
