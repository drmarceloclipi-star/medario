"use strict";

const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;
const TOMBSTONE_FINALIZE_DELAY_MS = 2 * 60 * 60 * 1000;
const TOMBSTONE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function userSubcollectionsForDeletion() {
  return ["interests", "search_events", "favorites", "savedSearches"];
}

function authTimeIsRecent(authTime, nowSeconds, maxAgeSeconds = RECENT_AUTH_MAX_AGE_SECONDS) {
  return Number.isFinite(authTime) &&
    Number.isFinite(nowSeconds) &&
    authTime <= nowSeconds &&
    nowSeconds - authTime <= maxAgeSeconds;
}

function missingUserProfileFields(existing, user, now) {
  const current = existing && typeof existing === "object" ? existing : {};
  const defaults = {
    email: user?.email || null,
    cidade: null,
    convenio: null,
    tipo_atendimento: null,
    idioma: "Português",
    acessibilidade: false,
    consent_preferences: false,
    created_at: now,
  };
  return Object.fromEntries(Object.entries(defaults).filter(([key]) => !Object.prototype.hasOwnProperty.call(current, key)));
}

function linkedCleanupQueries(uid) {
  return [
    { collection: "notificationEndpoints", field: "userUid", value: uid },
    { collection: "notificationEndpoints", field: "userId", value: uid },
    { collection: "notificationEndpoints", field: "uid", value: uid },
    { collection: "notificationEndpoints", field: "ownerUid", value: uid },
    { collection: "notificationEndpoints", field: "recipientUid", value: uid },
    { collection: "notificationOutbox", field: "recipientUid", value: uid },
    { collection: "notificationDeliveryAttempts", field: "recipientUid", value: uid },
    { collection: "appointmentIdempotency", field: "patientUid", value: uid },
    { collection: "appointmentRateLimits", field: "patientUid", value: uid },
  ];
}

function appointmentErasurePatch(fieldValue, now) {
  return {
    patientUid: fieldValue.delete(),
    patientName: fieldValue.delete(),
    patientEmail: fieldValue.delete(),
    patientDeleted: true,
    patientDeletedAt: now,
    updatedAt: now,
  };
}

function affinityDecision(user, interests) {
  if (!user) return { kind: "skip" };
  if (user.consent_preferences !== true || !interests.length) return { kind: "clear" };

  const counts = {};
  let maxCount = 0;
  for (const interest of interests) {
    const count = Number.isFinite(interest.count) ? interest.count : 0;
    const specialty = interest.specialty || interest.id;
    counts[specialty] = count;
    if (count > maxCount) maxCount = count;
  }
  return {
    kind: "update",
    affinity: Object.fromEntries(Object.entries(counts).map(([specialty, count]) => [specialty, maxCount > 0 ? count / maxCount : 0])),
  };
}

async function executeAccountDeletion(uid, operations) {
  await operations.ensureTombstone(uid);
  await operations.revokeRefreshTokens(uid);
  await operations.cleanupUserData(uid);
  try {
    await operations.deleteAuthUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
}

async function executeDeletionFinalizer(uid, operations) {
  await operations.cleanupUserData(uid);
  await operations.deleteTombstone(uid);
}

async function executeDeletionFinalizationBatch(items, finalize) {
  let finalized = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await finalize(item);
      finalized += 1;
    } catch {
      failed += 1;
    }
  }
  return { finalized, failed };
}

function deletionTombstone(now) {
  return {
    createdAt: now,
    finalizeAfter: new Date(now.getTime() + TOMBSTONE_FINALIZE_DELAY_MS),
    expiresAt: new Date(now.getTime() + TOMBSTONE_EXPIRY_MS),
  };
}

function tombstoneIsActive(record, now = new Date()) {
  const expiresAt = record?.expiresAt?.toDate ? record.expiresAt.toDate() : record?.expiresAt;
  return expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
}

function canReleaseClaim({ ownerUid, uid, otherActiveOwner }) {
  return otherActiveOwner !== true && (!ownerUid || ownerUid === uid);
}

function shouldDeleteSharedProfessionalResources(otherActiveOwner) {
  return otherActiveOwner !== true;
}

async function executeHealthConsentRevocation(operations) {
  await operations.disableConsent();
  await operations.deleteHealthData();
  await operations.clearAffinity();
}

module.exports = {
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
};
