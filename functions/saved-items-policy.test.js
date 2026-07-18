"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { expectedAccountMatches, savedSearchCriteriaFrom, savedSearchRecord } = require("./saved-items-policy");

test("keeps account saved searches to objective derived criteria", () => {
  assert.deepEqual(savedSearchCriteriaFrom({ specialty: "psiquiatria", city: "joinville", modality: "telemedicine" }), { specialty: "psiquiatria", city: "joinville", modality: "telemedicine" });
  assert.throws(() => savedSearchCriteriaFrom({ query: "dor no peito" }));
  assert.throws(() => savedSearchCriteriaFrom({ symptoms: ["dor"] }));
  assert.throws(() => savedSearchCriteriaFrom({ exactLocation: { lat: -26.3 } }));
});

test("pins every saved-items effect to the initiating account", () => {
  assert.equal(expectedAccountMatches("user-a", "user-a"), true);
  assert.equal(expectedAccountMatches("user-a", "user-b"), false);
  assert.equal(expectedAccountMatches(undefined, "user-a"), false);
});

test("records no raw text or location in saved search persistence", () => {
  const record = savedSearchRecord({ id: "search-1", criteria: { insurance: "unimed" }, alertEnabled: true, now: new Date("2030-01-01T10:00:00Z") });

  assert.deepEqual(Object.keys(record).sort(), ["alertEnabled", "createdAt", "criteria", "id", "updatedAt", "version"]);
  assert.doesNotMatch(JSON.stringify(record), /query|symptom|location|dor|latitude/i);
});
