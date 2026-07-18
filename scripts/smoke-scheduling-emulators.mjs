#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const admin = require("../functions/node_modules/firebase-admin");
const projectId = "medario-doctor";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";

for (const [name, host] of [["Auth", authHost], ["Firestore", firestoreHost], ["Functions", functionsHost]]) {
  assert.match(host || "", /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/, `${name} emulator must use loopback`);
}

const authBase = `http://${authHost}`;
const firestoreBase = `http://${firestoreHost}`;
const functionsBase = `http://${functionsHost}/${projectId}/us-central1`;

function pass(message) { console.log(`PASS ${message}`); }

const calendarRequests = [];
const calendarServer = http.createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  calendarRequests.push({ method: request.method, url: request.url, body });
  response.writeHead(request.url === "/token" || request.method === "PUT" ? 200 : 204, { "content-type": "application/json" });
  response.end(request.url === "/token" ? JSON.stringify({ access_token: "emulator-access-token" }) : (request.method === "PUT" ? JSON.stringify({ id: "event" }) : ""));
});
await new Promise((resolve) => calendarServer.listen(8787, "127.0.0.1", resolve));
calendarServer.unref();

function encryptedRefreshToken(value) {
  const key = Buffer.from(process.env.MEDARIO_EMULATOR_CALENDAR_TOKEN_KEY || "", "base64");
  assert.equal(key.length, 32, "smoke calendar key must be 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { response, payload };
}

async function signup(email) {
  const result = await requestJson(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Scheduling-Smoke-2026!", returnSecureToken: true }),
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  await admin.auth().updateUser(result.payload.localId, { emailVerified: true });
  const signedIn = await requestJson(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "Scheduling-Smoke-2026!", returnSecureToken: true }),
  });
  assert.equal(signedIn.response.status, 200, JSON.stringify(signedIn.payload));
  return { uid: result.payload.localId, token: signedIn.payload.idToken };
}

async function callable(name, data, token) {
  return requestJson(`${functionsBase}/${name}`, {
    method: "POST",
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
}

async function eventually(description, check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value; } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${description}${last ? `: ${last.message}` : ""}`);
}

await requestJson(`${firestoreBase}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
await requestJson(`${authBase}/emulator/v1/projects/${projectId}/accounts`, { method: "DELETE" });
admin.initializeApp({ projectId });
const db = admin.firestore();
const patient = await signup("scheduling-patient@medario.test");
const otherPatient = await signup("scheduling-other@medario.test");
const professional = await signup("scheduling-doctor@medario.test");

await eventually("Auth profile triggers", async () => (await db.collection("users").doc(patient.uid).get()).exists);
await db.collection("professionalAccounts").doc(professional.uid).set({ doctorId: "doctor-scheduling", status: "active" });
await db.collection("calendarConnections").doc("doctor-scheduling").set({
  status: "active",
  integrationCalendarId: "medario-emulator-calendar",
  refreshToken: encryptedRefreshToken("emulator-refresh-token"),
});

const doctorRef = db.collection("doctors").doc("doctor-scheduling");
const now = new Date();
const manualStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
const immediateStart = new Date(now.getTime() + 4 * 60 * 60 * 1000);
const rescheduledStart = new Date(now.getTime() + 6 * 60 * 60 * 1000);
const manualSecondStart = new Date(now.getTime() + 8 * 60 * 60 * 1000);
const manualThirdStart = new Date(now.getTime() + 10 * 60 * 60 * 1000);
const slotEnd = (start) => new Date(start.getTime() + 45 * 60 * 1000);
await Promise.all([
  db.collection("publicDoctors").doc("doctor-scheduling").set({
    slug: "doctor-scheduling",
    name: "Dra. QA Scheduling",
    published: true,
    publicReadSafe: true,
    location: { id: "clinic", name: "Clínica QA", city: "Joinville", authorized: false },
  }),
  db.collection("publicDoctors").doc("doctor-unsafe-scheduling").set({ slug: "doctor-unsafe-scheduling", name: "Unsafe", published: true, publicReadSafe: false }),
  doctorRef.collection("appointmentTypes").doc("manual").set({ id: "manual", label: "Consulta inicial", locationId: "clinic", modality: "in_person", durationMinutes: 30, bufferMinutes: 15, minimumLeadMinutes: 30, maximumWindowDays: 7, confirmationPolicy: "manual", cancellationPolicy: "Cancele antes do início.", priceCents: 25000, enabled: true }),
  doctorRef.collection("appointmentTypes").doc("immediate").set({ id: "immediate", label: "Teleconsulta", locationId: "remote", modality: "telemedicine", durationMinutes: 30, bufferMinutes: 15, minimumLeadMinutes: 30, maximumWindowDays: 7, confirmationPolicy: "immediate", cancellationPolicy: "Cancele antes do início.", enabled: true }),
  doctorRef.collection("slots").doc("slot-manual").set({ appointmentTypeId: "manual", locationId: "clinic", startsAt: manualStart.toISOString(), endsAt: slotEnd(manualStart).toISOString(), status: "open", version: 1 }),
  doctorRef.collection("slots").doc("slot-immediate").set({ appointmentTypeId: "immediate", locationId: "remote", startsAt: immediateStart.toISOString(), endsAt: slotEnd(immediateStart).toISOString(), status: "open", version: 1 }),
  doctorRef.collection("slots").doc("slot-rescheduled").set({ appointmentTypeId: "immediate", locationId: "remote", startsAt: rescheduledStart.toISOString(), endsAt: slotEnd(rescheduledStart).toISOString(), status: "open", version: 1 }),
  doctorRef.collection("slots").doc("slot-manual-2").set({ appointmentTypeId: "manual", locationId: "clinic", startsAt: manualSecondStart.toISOString(), endsAt: slotEnd(manualSecondStart).toISOString(), status: "open", version: 1 }),
  doctorRef.collection("slots").doc("slot-manual-3").set({ appointmentTypeId: "manual", locationId: "clinic", startsAt: manualThirdStart.toISOString(), endsAt: slotEnd(manualThirdStart).toISOString(), status: "open", version: 1 }),
  db.collection("calendarAvailability").doc("doctor-scheduling").set({ status: "available", fetchedAt: now, busy: [] }),
]);
pass("safe public doctor, types, slots and fresh calendar seeded");

const options = await callable("listPublicAppointmentOptions", { slug: "doctor-scheduling" });
assert.equal(options.response.status, 200, JSON.stringify(options.payload));
assert.equal(options.payload.result.types.length, 2);
assert.equal(options.payload.result.types.find((item) => item.id === "manual").priceCents, 25000);
assert.equal(options.payload.result.slots.length, 5);
const unsafeOptions = await callable("listPublicAppointmentOptions", { slug: "doctor-unsafe-scheduling" });
assert.equal(unsafeOptions.payload.error.status, "NOT_FOUND");
pass("public options expose only safe profile and immutable booking policy fields");

const nativeWithoutAppCheck = await callable("createNativeAppointmentRequest", {
  doctorId: "doctor-scheduling",
  typeId: "manual",
  slotId: "slot-manual",
  idempotencyKey: "native-without-attestation",
  expectedUid: patient.uid,
}, patient.token);
assert.equal(nativeWithoutAppCheck.payload.error.status, "UNAUTHENTICATED");
pass("native appointment mutation rejects missing App Check attestation");

const missingSlot = await callable("createAppointmentRequest", { doctorId: "doctor-scheduling", typeId: "manual", slotId: "missing", idempotencyKey: "manual-missing", expectedUid: patient.uid }, patient.token);
assert.equal(missingSlot.payload.error.status, "FAILED_PRECONDITION");
pass("manual policy rejects a phantom slot");

const manual = await callable("createAppointmentRequest", { doctorId: "doctor-scheduling", typeId: "manual", slotId: "slot-manual", idempotencyKey: "manual-valid", expectedUid: patient.uid }, patient.token);
assert.equal(manual.response.status, 200, JSON.stringify(manual.payload));
assert.equal(manual.payload.result.status, "requested");
const manualAppointmentId = manual.payload.result.appointmentId;
const manualAppointment = (await db.collection("appointments").doc(manualAppointmentId).get()).data();
assert.equal(manualAppointment.doctorName, "Dra. QA Scheduling");
assert.equal(manualAppointment.typeLabel, "Consulta inicial");
assert.equal(manualAppointment.locationLabel, "Clínica QA");
assert.equal(manualAppointment.patientUid, patient.uid);
assert.equal((await doctorRef.collection("slots").doc("slot-manual").get()).data().status, "open");
pass("manual request stores safe immutable snapshot without reserving slot");

const listed = await callable("listMyAppointments", { limit: 20, expectedUid: patient.uid }, patient.token);
assert.equal(listed.response.status, 200, JSON.stringify(listed.payload));
assert.equal(listed.payload.result.items[0].id, manualAppointmentId);
assert.equal(listed.payload.result.items[0].startsAt, manualStart.toISOString());
assert.equal(Object.hasOwn(listed.payload.result.items[0], "patientUid"), false);
const otherList = await callable("listMyAppointments", { limit: 20, expectedUid: otherPatient.uid }, otherPatient.token);
assert.equal(otherList.payload.result.items.length, 0);
pass("patient list is ordered, scoped and returns minimum DTO");

const professionalRawRead = await requestJson(`${firestoreBase}/v1/projects/${projectId}/databases/(default)/documents/appointments/${manualAppointmentId}`, { headers: { authorization: `Bearer ${professional.token}` } });
assert.equal(professionalRawRead.response.status, 403);
pass("professional stale/raw client cannot read patient UID");

const cancelledManual = await callable("requestAppointmentCancellation", { appointmentId: manualAppointmentId, expectedUid: patient.uid }, patient.token);
assert.equal(cancelledManual.payload.result.status, "cancelled");
const cancelledManualAgain = await callable("requestAppointmentCancellation", { appointmentId: manualAppointmentId, expectedUid: patient.uid }, patient.token);
assert.equal(cancelledManualAgain.payload.result.replayed, true);
const otherCancel = await callable("requestAppointmentCancellation", { appointmentId: manualAppointmentId, expectedUid: otherPatient.uid }, otherPatient.token);
assert.equal(otherCancel.payload.error.status, "PERMISSION_DENIED");
pass("requested cancellation is owner-only and idempotent");

const manualSecond = await callable("createAppointmentRequest", { doctorId: "doctor-scheduling", typeId: "manual", slotId: "slot-manual-2", idempotencyKey: "manual-reschedule", expectedUid: patient.uid }, patient.token);
assert.equal(manualSecond.payload.result.status, "requested");
const manualSecondId = manualSecond.payload.result.appointmentId;
const acceptedManual = await callable("decideAppointmentRequest", { appointmentId: manualSecondId, decision: "accept" }, professional.token);
assert.equal(acceptedManual.payload.result.status, "confirmed");
const requestedManualReschedule = await callable("requestAppointmentReschedule", { appointmentId: manualSecondId, slotId: "slot-manual-3", expectedUid: patient.uid }, patient.token);
assert.equal(requestedManualReschedule.payload.result.status, "reschedule_requested");
assert.equal((await doctorRef.collection("slots").doc("slot-manual-2").get()).data().appointmentId, manualSecondId);
assert.equal((await doctorRef.collection("slots").doc("slot-manual-3").get()).data().status, "open");
const acceptedManualReschedule = await callable("decideAppointmentReschedule", { appointmentId: manualSecondId, decision: "accept" }, professional.token);
assert.equal(acceptedManualReschedule.payload.result.decision, "accepted");
assert.equal((await doctorRef.collection("slots").doc("slot-manual-2").get()).data().status, "open");
assert.equal((await doctorRef.collection("slots").doc("slot-manual-3").get()).data().appointmentId, manualSecondId);
await callable("requestAppointmentCancellation", { appointmentId: manualSecondId, expectedUid: patient.uid }, patient.token);
pass("manual remap keeps old reservation until professional acceptance, then swaps atomically");

const immediateInput = { doctorId: "doctor-scheduling", typeId: "immediate", slotId: "slot-immediate" };
const concurrent = await Promise.all([
  callable("createAppointmentRequest", { ...immediateInput, idempotencyKey: "immediate-a", expectedUid: patient.uid }, patient.token),
  callable("createAppointmentRequest", { ...immediateInput, idempotencyKey: "immediate-b", expectedUid: patient.uid }, patient.token),
]);
const successes = concurrent.filter((result) => result.response.status === 200);
const failures = concurrent.filter((result) => result.response.status !== 200);
assert.equal(successes.length, 1);
assert.equal(failures.length, 1);
assert.equal(failures[0].payload.error.status, "FAILED_PRECONDITION");
const confirmedId = successes[0].payload.result.appointmentId;
assert.equal((await doctorRef.collection("slots").doc("slot-immediate").get()).data().appointmentId, confirmedId);
pass("concurrent immediate requests reserve a slot exactly once");

const winningKey = successes[0] === concurrent[0] ? "immediate-a" : "immediate-b";
const replayBeforeCancel = await callable("createAppointmentRequest", { ...immediateInput, idempotencyKey: winningKey, expectedUid: patient.uid }, patient.token);
assert.equal(replayBeforeCancel.payload.result.status, "confirmed");
assert.equal(replayBeforeCancel.payload.result.replayed, true);
await eventually("initial calendar event delivery", async () => (await db.collection("calendarOutbox").doc(`${confirmedId}:confirmed`).get()).data()?.state === "delivered");
const rescheduled = await callable("requestAppointmentReschedule", { appointmentId: confirmedId, slotId: "slot-rescheduled", expectedUid: patient.uid }, patient.token);
assert.equal(rescheduled.payload.result.status, "confirmed");
assert.equal((await doctorRef.collection("slots").doc("slot-immediate").get()).data().status, "open");
assert.equal((await doctorRef.collection("slots").doc("slot-rescheduled").get()).data().appointmentId, confirmedId);
const rescheduleOutbox = await db.collection("calendarOutbox").where("medarioAppointmentId", "==", confirmedId).where("action", "==", "reschedule").get();
assert.equal(rescheduleOutbox.size, 1);
pass("immediate reschedule atomically swaps slots and emits event update");
const cancelledConfirmed = await callable("requestAppointmentCancellation", { appointmentId: confirmedId, expectedUid: patient.uid }, patient.token);
assert.equal(cancelledConfirmed.payload.result.status, "cancelled");
assert.equal((await doctorRef.collection("slots").doc("slot-immediate").get()).data().status, "open");
assert.equal((await doctorRef.collection("slots").doc("slot-rescheduled").get()).data().status, "open");
assert.equal((await db.collection("calendarOutbox").doc(`${confirmedId}:cancelled`).get()).data().action, "cancel");
const replayAfterCancel = await callable("createAppointmentRequest", { ...immediateInput, idempotencyKey: winningKey, expectedUid: patient.uid }, patient.token);
assert.equal(replayAfterCancel.payload.result.status, "cancelled");
pass("confirmed cancellation releases slot, emits delete outbox and replay returns current state");

await eventually("calendar create, reschedule and cancellation delivery", async () => {
  const outbox = await db.collection("calendarOutbox").where("medarioAppointmentId", "==", confirmedId).get();
  return outbox.size >= 3 && outbox.docs.every((item) => item.data().state === "delivered");
});
assert.ok(calendarRequests.filter((item) => item.method === "PUT").length >= 2);
assert.ok(calendarRequests.some((item) => item.method === "DELETE"));
const eventRequests = Map.groupBy(calendarRequests.filter((item) => item.method === "PUT" || item.method === "DELETE"), (item) => item.url);
assert.ok([...eventRequests.values()].some((items) => items.filter((item) => item.method === "PUT").length >= 2 && items.some((item) => item.method === "DELETE")));
pass("calendar delivery creates, updates and deletes one stable external event");

console.log("SCHEDULING_SMOKE_OK");
await admin.app().delete();
await new Promise((resolve) => calendarServer.close(resolve));
