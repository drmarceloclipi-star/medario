"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RECENT_AUTH_MAX_AGE_SECONDS,
  TOMBSTONE_EXPIRY_MS,
  TOMBSTONE_FINALIZE_DELAY_MS,
  affinityDecision,
  appointmentErasurePatch,
  authTimeIsRecent,
  canReleaseClaim,
  deletionTombstone,
  executeAccountDeletion,
  executeDeletionFinalizationBatch,
  executeDeletionFinalizer,
  executeHealthConsentRevocation,
  linkedCleanupQueries,
  missingUserProfileFields,
  shouldDeleteSharedProfessionalResources,
  tombstoneIsActive,
  userSubcollectionsForDeletion,
} = require("./user-cleanup-policy");

test("account deletion includes synchronized favorites and saved searches", () => {
  assert.deepEqual(userSubcollectionsForDeletion(), ["interests", "search_events", "favorites", "savedSearches"]);
});

test("account deletion requires authentication no older than five minutes", () => {
  assert.equal(RECENT_AUTH_MAX_AGE_SECONDS, 300);
  assert.equal(authTimeIsRecent(1_000, 1_300), true);
  assert.equal(authTimeIsRecent(1_000, 1_301), false);
  assert.equal(authTimeIsRecent(1_301, 1_300), false);
  assert.equal(authTimeIsRecent(undefined, 1_300), false);
});

test("user bootstrap fills only absent fields and never overwrites client data", () => {
  const now = new Date("2030-01-01T00:00:00Z");
  const patch = missingUserProfileFields({
    email: "kept@example.com",
    cidade: "Recife",
    idioma: "English",
    consent_preferences: true,
    created_at: "kept",
  }, { email: "auth@example.com" }, now);

  assert.equal(patch.email, undefined);
  assert.equal(patch.cidade, undefined);
  assert.equal(patch.idioma, undefined);
  assert.equal(patch.consent_preferences, undefined);
  assert.equal(patch.created_at, undefined);
  assert.equal(patch.convenio, null);
  assert.equal(patch.acessibilidade, false);
});

test("linked cleanup covers notification data and new idempotency ownership", () => {
  assert.deepEqual(linkedCleanupQueries("user-1"), [
    { collection: "notificationEndpoints", field: "userUid", value: "user-1" },
    { collection: "notificationEndpoints", field: "userId", value: "user-1" },
    { collection: "notificationEndpoints", field: "uid", value: "user-1" },
    { collection: "notificationEndpoints", field: "ownerUid", value: "user-1" },
    { collection: "notificationEndpoints", field: "recipientUid", value: "user-1" },
    { collection: "notificationOutbox", field: "recipientUid", value: "user-1" },
    { collection: "notificationDeliveryAttempts", field: "recipientUid", value: "user-1" },
    { collection: "appointmentIdempotency", field: "patientUid", value: "user-1" },
    { collection: "appointmentRateLimits", field: "patientUid", value: "user-1" },
  ]);
});

test("appointment erasure removes identity while preserving operational fields", () => {
  const deleted = Symbol("deleted");
  const fieldValue = { delete: () => deleted };
  const now = new Date("2030-01-01T00:00:00Z");
  assert.deepEqual(appointmentErasurePatch(fieldValue, now), {
    patientUid: deleted,
    patientName: deleted,
    patientEmail: deleted,
    patientDeleted: true,
    patientDeletedAt: now,
    updatedAt: now,
  });
});

test("affinity trigger cannot recreate a deleted or revoked user", () => {
  assert.deepEqual(affinityDecision(null, [{ id: "cardio", count: 2 }]), { kind: "skip" });
  assert.deepEqual(affinityDecision({ consent_preferences: false }, [{ id: "cardio", count: 2 }]), { kind: "clear" });
  assert.deepEqual(affinityDecision({ consent_preferences: true }, []), { kind: "clear" });
  assert.deepEqual(affinityDecision({ consent_preferences: true }, [
    { id: "cardio", count: 4 },
    { id: "dermato", specialty: "dermatologia", count: 2 },
  ]), { kind: "update", affinity: { cardio: 1, dermatologia: 0.5 } });
});

test("account deletion cleans data before deleting Auth and remains idempotent", async () => {
  const calls = [];
  await executeAccountDeletion("user-1", {
    ensureTombstone: async (uid) => calls.push(`tombstone:${uid}`),
    revokeRefreshTokens: async (uid) => calls.push(`revoke:${uid}`),
    cleanupUserData: async (uid) => calls.push(`cleanup:${uid}`),
    deleteAuthUser: async (uid) => calls.push(`auth:${uid}`),
  });
  assert.deepEqual(calls, ["tombstone:user-1", "revoke:user-1", "cleanup:user-1", "auth:user-1"]);

  await executeAccountDeletion("user-1", {
    ensureTombstone: async () => undefined,
    revokeRefreshTokens: async () => undefined,
    cleanupUserData: async () => undefined,
    deleteAuthUser: async () => { throw Object.assign(new Error("gone"), { code: "auth/user-not-found" }); },
  });
});

test("account deletion never removes Auth when data cleanup fails", async () => {
  let authCalled = false;
  await assert.rejects(executeAccountDeletion("user-1", {
    ensureTombstone: async () => undefined,
    revokeRefreshTokens: async () => undefined,
    cleanupUserData: async () => { throw new Error("firestore unavailable"); },
    deleteAuthUser: async () => { authCalled = true; },
  }), /firestore unavailable/);
  assert.equal(authCalled, false);
});

test("tombstone outlives an ID token and finalizer removes it only after residual cleanup", async () => {
  const now = new Date("2030-01-01T00:00:00Z");
  const record = deletionTombstone(now);
  assert.equal(TOMBSTONE_FINALIZE_DELAY_MS > 60 * 60 * 1000, true);
  assert.equal(TOMBSTONE_EXPIRY_MS > TOMBSTONE_FINALIZE_DELAY_MS, true);
  assert.equal(tombstoneIsActive(record, new Date("2030-01-01T01:30:00Z")), true);

  const calls = [];
  await executeDeletionFinalizer("user-1", {
    cleanupUserData: async () => calls.push("cleanup"),
    deleteTombstone: async () => calls.push("tombstone-delete"),
  });
  assert.deepEqual(calls, ["cleanup", "tombstone-delete"]);

  let tombstoneDeleted = false;
  await assert.rejects(executeDeletionFinalizer("user-1", {
    cleanupUserData: async () => { throw new Error("residual cleanup failed"); },
    deleteTombstone: async () => { tombstoneDeleted = true; },
  }), /residual cleanup failed/);
  assert.equal(tombstoneDeleted, false);
});

test("finalizer batch isolates failures and continues without deleting failed tombstones", async () => {
  const completed = [];
  const result = await executeDeletionFinalizationBatch(["first", "second"], async (uid) => {
    if (uid === "first") throw new Error("cleanup failed");
    completed.push(uid);
  });
  assert.deepEqual(result, { finalized: 1, failed: 1 });
  assert.deepEqual(completed, ["second"]);
});

test("claim release never overwrites a new explicit owner", () => {
  assert.equal(canReleaseClaim({ ownerUid: undefined, uid: "old", otherActiveOwner: false }), true);
  assert.equal(canReleaseClaim({ ownerUid: "old", uid: "old", otherActiveOwner: false }), true);
  assert.equal(canReleaseClaim({ ownerUid: "new", uid: "old", otherActiveOwner: false }), false);
  assert.equal(canReleaseClaim({ ownerUid: "old", uid: "old", otherActiveOwner: true }), false);
});

test("shared professional resources survive when another active owner remains", () => {
  assert.equal(shouldDeleteSharedProfessionalResources(true), false);
  assert.equal(shouldDeleteSharedProfessionalResources(false), true);
});

test("health revocation denies consent before deleting or clearing derived data", async () => {
  const calls = [];
  await executeHealthConsentRevocation({
    disableConsent: async () => calls.push("disable"),
    deleteHealthData: async () => calls.push("delete"),
    clearAffinity: async () => calls.push("clear"),
  });
  assert.deepEqual(calls, ["disable", "delete", "clear"]);
});
