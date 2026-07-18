#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");

const PROJECT_ID = "medario-doctor";
const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || PROJECT_ID;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const pubsubHost = process.env.PUBSUB_EMULATOR_HOST;

assert.equal(projectId, PROJECT_ID, `Expected Firebase project ${PROJECT_ID}, received ${projectId}`);
for (const [name, host] of [["Auth", authHost], ["Firestore", firestoreHost], ["Functions", functionsHost], ["Pub/Sub", pubsubHost]]) {
  assert.ok(host, `${name} emulator host is missing`);
  assert.match(host, /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/, `${name} host must be loopback: ${host}`);
}

const authBase = `http://${authHost}`;
const firestoreBase = `http://${firestoreHost}`;
const functionsBase = `http://${functionsHost}/${PROJECT_ID}/us-central1`;
const email = "slice2-smoke@medario.test";
const password = "Smoke-Only-2026!";

function pass(message) {
  console.log(`PASS ${message}`);
}

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${url} -> ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function clearEmulators() {
  await jsonRequest(`${firestoreBase}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  await jsonRequest(`${authBase}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  pass("emulator state reset; reruns start clean");
}

async function eventually(description, check, { timeoutMs = 20_000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

async function callFunction(name, idToken, data = {}) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ data }),
  });
  const payload = await response.json();
  if (!response.ok || payload?.error) throw new Error(`${name} callable failed (${response.status}): ${JSON.stringify(payload.error || payload)}`);
  return payload?.result ?? payload?.data;
}

async function assertCallableBlocked(name, idToken) {
  const response = await fetch(`${functionsBase}/${name}`, {
    method: "POST",
    headers: { authorization: `Bearer ${idToken}`, "content-type": "application/json" },
    body: JSON.stringify({ data: {} }),
  });
  const payload = await response.json();
  assert.equal(response.ok, false, `${name} unexpectedly accepted a stale token`);
  assert.ok(["FAILED_PRECONDITION", "UNAUTHENTICATED"].includes(payload?.error?.status), JSON.stringify(payload));
  return payload.error.status;
}

async function runDeletionFinalizer() {
  // Functions emulator omits the production region suffix when wiring schedules.
  const topic = "firebase-schedule-finalizeDeletedUsers";
  return jsonRequest(`http://${pubsubHost}/v1/projects/${PROJECT_ID}/topics/${topic}:publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ data: Buffer.from("{}").toString("base64") }] }),
  });
}

function snapshotData(snapshot) {
  return snapshot.exists ? snapshot.data() : null;
}

async function assertMissing(ref, description) {
  await eventually(description, async () => !(await ref.get()).exists);
  pass(description);
}

await clearEmulators();

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const signup = await jsonRequest(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-key`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, returnSecureToken: true }),
});
const uid = signup.localId;
const idToken = signup.idToken;
assert.ok(uid && idToken);
pass(`Auth REST created user ${uid}`);

const clientApp = initializeApp({ apiKey: "emulator-key", projectId: PROJECT_ID }, `slice2-smoke-${uid}`);
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, authBase, { disableWarnings: true });
const clientFirestore = getFirestore(clientApp);
const [firestoreEmulatorHost, firestoreEmulatorPort] = firestoreHost.split(":");
connectFirestoreEmulator(clientFirestore, firestoreEmulatorHost, Number(firestoreEmulatorPort));
const clientCredential = await signInWithEmailAndPassword(clientAuth, email, password);
const staleIdToken = await clientCredential.user.getIdToken();
assert.equal(clientCredential.user.uid, uid);
pass("client session retained for stale-token deletion-race proof");

const userRef = db.collection("users").doc(uid);
const defaults = await eventually("onUserCreate defaults", async () => {
  const snapshot = await userRef.get();
  const data = snapshotData(snapshot);
  return data?.email === email && data?.consent_preferences === false && data?.idioma === "Português" ? data : null;
});
assert.equal(defaults.cidade, null);
assert.equal(defaults.convenio, null);
assert.equal(defaults.tipo_atendimento, null);
assert.equal(defaults.acessibilidade, false);
assert.ok(defaults.created_at);
pass("onUserCreate persisted conservative profile defaults");

await userRef.set({
  cidade: "Recife",
  convenio: "Particular",
  tipo_atendimento: "telemedicina",
  idioma: "Português",
  acessibilidade: true,
  consent_preferences: true,
  consent_at: new Date(),
  affinity: { legacy: 0.25 },
  affinityUpdatedAt: new Date(),
  updated_at: new Date(),
}, { merge: true });

const interests = userRef.collection("interests");
const searchEvents = userRef.collection("search_events");
await interests.doc("manual").set({ specialty: "dermatolog", count: 2, updatedAt: new Date() });
await searchEvents.doc("event-before-revoke").set({ query: "Preciso de cardiologista", timestamp: new Date() });

await eventually("onSearchEvent derived interest", async () => {
  const [event, interest] = await Promise.all([
    searchEvents.doc("event-before-revoke").get(),
    interests.doc("cardiolog").get(),
  ]);
  return !event.exists && interest.exists && interest.data().count === 1;
});
pass("onSearchEvent consumed raw query and derived cardiolog interest");

const notificationPreferencesRef = db.collection("notificationPreferences").doc(uid);
const endpointRef = db.collection("notificationEndpoints").doc(`endpoint-${uid}`);
const outboxRef = db.collection("notificationOutbox").doc(`outbox-${uid}`);
const attemptRef = db.collection("notificationDeliveryAttempts").doc(`attempt-${uid}`);
const idempotencyRef = db.collection("appointmentIdempotency").doc(`${uid}_smoke-key`);
const appointmentRef = db.collection("appointments").doc(`appointment-${uid}`);
const doctorId = `doctor-${uid}`;
const professionalAccountRef = db.collection("professionalAccounts").doc(uid);
const calendarConnectionRef = db.collection("calendarConnections").doc(doctorId);
const calendarAvailabilityRef = db.collection("calendarAvailability").doc(doctorId);
const oauthStateRef = db.collection("calendarOAuthStates").doc(`oauth-${uid}`);
const profileChangeRef = db.collection("profileChangeRequests").doc(`change-${uid}`);
const doctorRef = db.collection("doctors").doc(doctorId);
const publicDoctorRef = db.collection("publicDoctors").doc(doctorId);

await Promise.all([
  userRef.collection("favorites").doc("doctor-smoke").set({ doctorId: "doctor-smoke", createdAt: new Date() }),
  userRef.collection("savedSearches").doc("search-smoke").set({ criteria: { specialty: "cardiologia" }, createdAt: new Date() }),
  endpointRef.set({ userUid: uid, recipientUid: uid, channel: "push", createdAt: new Date() }),
  attemptRef.set({ recipientUid: uid, outboxId: outboxRef.id, endpointId: endpointRef.id, state: "pending", createdAt: new Date() }),
  idempotencyRef.set({ patientUid: uid, requestFingerprint: "smoke", appointmentId: appointmentRef.id, status: "requested", createdAt: new Date() }),
  appointmentRef.set({ patientUid: uid, doctorId: "doctor-smoke", status: "requested", reasonCode: "routine", requestedAt: new Date(), updatedAt: new Date() }),
  professionalAccountRef.set({ doctorId, status: "active", createdAt: new Date() }),
  calendarConnectionRef.set({ status: "active", integrationCalendarId: "medario-smoke", createdAt: new Date() }),
  calendarAvailabilityRef.set({ status: "available", fetchedAt: new Date(), createdAt: new Date() }),
  oauthStateRef.set({ uid, state: "pending", createdAt: new Date() }),
  profileChangeRef.set({ professionalUid: uid, doctorId, status: "pending", createdAt: new Date() }),
  doctorRef.set({ claimed: true, claimed_status: "claimed", claimedByUid: uid, claimedAt: new Date(), crm: "smoke-private" }),
  publicDoctorRef.set({ claimed: true, claimedByUid: uid, claimedAt: new Date(), published: true, publicReadSafe: true, displayName: "Smoke" }),
]);
await notificationPreferencesRef.set({ appointment_confirmed: { email: true, whatsapp: false, push: false }, updatedAt: new Date() });
await outboxRef.set({ recipientUid: uid, event: "appointment_confirmed", channel: "email", state: "pending", attempts: 0, createdAt: new Date() });
pass("patient and professional owned data seeded across cleanup surfaces");

await eventually("providerless outbox terminal state", async () => {
  const data = snapshotData(await outboxRef.get());
  return data?.state === "blocked_provider_not_configured" ? data : null;
});
pass("outbox rechecked preference and blocked unconfigured email provider");

const revokedPushRef = db.collection("notificationOutbox").doc(`push-revoked-${uid}`);
await revokedPushRef.set({ recipientUid: uid, event: "appointment_confirmed", channel: "push", state: "pending", attempts: 0, createdAt: new Date() });
await eventually("revoked push suppression", async () => {
  const data = snapshotData(await revokedPushRef.get());
  return data?.state === "suppressed_revoked" ? data : null;
});
pass("push delivery rechecked latest revocation before provider access");

await notificationPreferencesRef.set({ appointment_confirmed: { email: true, whatsapp: false, push: true }, updatedAt: new Date() });
const missingEndpointPushRef = db.collection("notificationOutbox").doc(`push-missing-endpoint-${uid}`);
await missingEndpointPushRef.set({ recipientUid: uid, event: "appointment_confirmed", channel: "push", state: "pending", attempts: 0, createdAt: new Date() });
await eventually("missing endpoint terminal state", async () => {
  const data = snapshotData(await missingEndpointPushRef.get());
  return data?.state === "blocked_endpoint_unavailable" ? data : null;
});
pass("enabled push without active native endpoint failed closed");

const revocation = await callFunction("revokeHealthConsent", idToken);
assert.deepEqual(revocation, { consentPreferences: false });
const revokedUser = await eventually("health revocation persisted", async () => {
  const data = snapshotData(await userRef.get());
  const [interestSnapshot, eventSnapshot] = await Promise.all([interests.get(), searchEvents.get()]);
  return data?.consent_preferences === false && !("affinity" in data) && !("affinityUpdatedAt" in data) && interestSnapshot.empty && eventSnapshot.empty ? data : null;
});
assert.ok(revokedUser.consent_at);
pass("revokeHealthConsent returned false and purged raw/derived health data");

await searchEvents.doc("event-after-revoke").set({ query: "Procuro neurologista", timestamp: new Date() });
await eventually("post-revocation event discarded", async () => {
  const [event, interest] = await Promise.all([
    searchEvents.doc("event-after-revoke").get(),
    interests.doc("neurolog").get(),
  ]);
  return !event.exists && !interest.exists;
});
pass("revoked consent blocked new derived health data");

const deletion = await callFunction("deleteMyAccount", idToken);
assert.deepEqual(deletion, { deleted: true });
pass("deleteMyAccount accepted recent Auth token");

const tombstoneRef = db.collection("deletedUsers").doc(uid);
const tombstone = await eventually("deletion tombstone persisted", async () => snapshotData(await tombstoneRef.get()));
assert.ok(tombstone.createdAt?.toDate() instanceof Date);
assert.ok(tombstone.finalizeAfter?.toDate() > new Date());
assert.ok(tombstone.expiresAt?.toDate() > tombstone.finalizeAfter?.toDate());
pass("deletion tombstone survives account cleanup and stale ID-token window");

const blockedStatus = await assertCallableBlocked("getNotificationPreferences", staleIdToken);
pass(`stale token blocked by callable account gate (${blockedStatus})`);

await assert.rejects(
  setDoc(doc(clientFirestore, "users", uid), {
    email,
    cidade: null,
    convenio: null,
    tipo_atendimento: null,
    idioma: "Português",
    acessibilidade: false,
    consent_preferences: false,
    created_at: serverTimestamp(),
  }),
  (error) => error?.code === "permission-denied" || error?.code === "unauthenticated"
);
await assertMissing(userRef, "stale token cannot recreate users/{uid}");

await eventually("Auth user removed", async () => {
  try {
    await admin.auth().getUser(uid);
    return false;
  } catch (error) {
    if (error?.code === "auth/user-not-found") return true;
    throw error;
  }
});
pass("Auth user removed");

await Promise.all([
  assertMissing(userRef, "users/{uid} and all owned subcollections removed"),
  assertMissing(notificationPreferencesRef, "notification preferences removed"),
  assertMissing(endpointRef, "notification endpoint removed"),
  assertMissing(outboxRef, "notification outbox removed"),
  assertMissing(attemptRef, "notification delivery attempt removed"),
  assertMissing(idempotencyRef, "appointment idempotency removed"),
  assertMissing(professionalAccountRef, "professional account removed"),
  assertMissing(calendarConnectionRef, "professional calendar connection removed"),
  assertMissing(calendarAvailabilityRef, "professional calendar availability removed"),
  assertMissing(oauthStateRef, "professional OAuth state removed"),
  assertMissing(profileChangeRef, "professional profile change request removed"),
]);

const appointment = await eventually("appointment anonymized", async () => {
  const data = snapshotData(await appointmentRef.get());
  return data?.patientDeleted === true && !("patientUid" in data) ? data : null;
});
assert.equal(appointment.doctorId, "doctor-smoke");
assert.equal(appointment.status, "requested");
assert.equal(appointment.reasonCode, "routine");
assert.ok(appointment.patientDeletedAt);
pass("appointment identity erased; operational fields preserved");

const [doctorAfterDeletion, publicDoctorAfterDeletion] = await Promise.all([doctorRef.get(), publicDoctorRef.get()]);
assert.equal(doctorAfterDeletion.data()?.claimed, false);
assert.equal(doctorAfterDeletion.data()?.claimed_status, "unclaimed");
assert.equal("claimedByUid" in doctorAfterDeletion.data(), false);
assert.equal(publicDoctorAfterDeletion.data()?.claimed, false);
assert.equal("claimedByUid" in publicDoctorAfterDeletion.data(), false);
assert.equal(doctorAfterDeletion.data()?.crm, "smoke-private");
assert.equal(publicDoctorAfterDeletion.data()?.displayName, "Smoke");
pass("professional claim released; doctor records preserved without ownership");

const linkedRemainders = await Promise.all([
  db.collection("notificationEndpoints").where("recipientUid", "==", uid).get(),
  db.collection("notificationOutbox").where("recipientUid", "==", uid).get(),
  db.collection("notificationDeliveryAttempts").where("recipientUid", "==", uid).get(),
  db.collection("appointmentIdempotency").where("patientUid", "==", uid).get(),
]);
assert.ok(linkedRemainders.every((snapshot) => snapshot.empty));
pass("linked-data backstop queries found zero user-owned records");

// Production waits two hours so every stale ID token expires. Backdate only in the
// isolated emulator, then publish the scheduler topic to exercise the real finalizer.
await new Promise((resolve) => setTimeout(resolve, 1_000));
await tombstoneRef.update({ finalizeAfter: new Date(Date.now() - 1_000) });
await runDeletionFinalizer();
await assertMissing(tombstoneRef, "scheduled finalizer reran cleanup and removed due tombstone");

await deleteApp(clientApp);
console.log(`SMOKE_OK project=${PROJECT_ID} uid=${uid}`);
