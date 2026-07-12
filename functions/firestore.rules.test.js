"use strict";

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertFails, assertSucceeds, initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { deleteDoc, doc, getDoc, serverTimestamp, setDoc } = require("firebase/firestore");

const projectId = "medario-rules-test";
const emulatorPort = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080);
let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: emulatorPort,
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "appointments/appointment-1"), { patientUid: "patient-1", doctorId: "doctor-1", status: "requested" });
    await setDoc(doc(db, "professionalAccounts/doctor-user"), { doctorId: "doctor-1", status: "active" });
    await setDoc(doc(db, "professionalAccounts/other-doctor-user"), { doctorId: "doctor-2", status: "active" });
    await setDoc(doc(db, "calendarAvailability/doctor-1"), { status: "available" });
    await setDoc(doc(db, "calendarConnections/doctor-1"), { status: "active", integrationCalendarId: "integration-calendar" });
    await setDoc(doc(db, "profileChangeRequests/change-1"), { doctorId: "doctor-1", status: "pending" });
    await setDoc(doc(db, "professionalLeadMetrics/doctor-1"), { profileViews: 1 });
    await setDoc(doc(db, "professionalLeads/lead-1"), { doctorId: "doctor-1", action: "appointment_request" });
    await setDoc(doc(db, "publicDoctors/doctor-1"), { published: true, slug: "doctor-1" });
    await setDoc(doc(db, "users/search-without-consent"), { email: "no-consent@example.com", consent_preferences: false });
    await setDoc(doc(db, "users/search-with-consent"), { email: "consent@example.com", consent_preferences: true });
  });
});

test.after(async () => environment.cleanup());

test("allows patient and owning professional to read only their appointment", async () => {
  const patient = environment.authenticatedContext("patient-1").firestore();
  const doctor = environment.authenticatedContext("doctor-user").firestore();
  const stranger = environment.authenticatedContext("patient-2").firestore();

  await assertSucceeds(getDoc(doc(patient, "appointments/appointment-1")));
  await assertSucceeds(getDoc(doc(doctor, "appointments/appointment-1")));
  await assertFails(getDoc(doc(stranger, "appointments/appointment-1")));
});

test("denies direct writes and all availability reads", async () => {
  const patient = environment.authenticatedContext("patient-1").firestore();

  await assertFails(setDoc(doc(patient, "appointments/appointment-1"), { status: "confirmed" }, { merge: true }));
  await assertFails(getDoc(doc(patient, "calendarAvailability/doctor-1")));
});

test("exposes only published public projections", async () => {
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, "publicDoctors/doctor-1")));
  await assertFails(getDoc(doc(anonymous, "doctors/doctor-1")));
});

test("keeps Medário Pro review and lead data server-only", async () => {
  const professional = environment.authenticatedContext("doctor-user").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();

  await assertFails(setDoc(doc(professional, "profileChangeRequests/change-1"), { doctorId: "doctor-1", status: "pending" }));
  await assertFails(getDoc(doc(professional, "professionalLeadMetrics/doctor-1")));
  await assertFails(getDoc(doc(professional, "professionalLeads/lead-1")));
  await assertFails(getDoc(doc(anonymous, "profileChangeRequests/change-1")));
  await assertFails(getDoc(doc(anonymous, "professionalLeadMetrics/doctor-1")));
});

test("limits the professional account to its owner and keeps calendar connection data server-only", async () => {
  const professional = environment.authenticatedContext("doctor-user").firestore();
  const otherProfessional = environment.authenticatedContext("other-doctor-user").firestore();
  const patient = environment.authenticatedContext("patient-1").firestore();

  await assertSucceeds(getDoc(doc(professional, "professionalAccounts/doctor-user")));
  await assertFails(getDoc(doc(otherProfessional, "professionalAccounts/doctor-user")));
  await assertFails(setDoc(doc(professional, "professionalAccounts/doctor-user"), { doctorId: "doctor-2" }, { merge: true }));
  await assertFails(getDoc(doc(professional, "calendarConnections/doctor-1")));
  await assertFails(getDoc(doc(patient, "calendarConnections/doctor-1")));
});

test("keeps notification preferences and outbox server-only", async () => {
  const patient = environment.authenticatedContext("patient-1").firestore();

  await assertFails(setDoc(doc(patient, "notificationPreferences/patient-1"), { appointment_confirmed: { email: true } }));
  await assertFails(getDoc(doc(patient, "notificationPreferences/patient-1")));
  await assertFails(getDoc(doc(patient, "notificationOutbox/notification-1")));
  await assertFails(getDoc(doc(patient, "notificationEndpoints/endpoint-1")));
  await assertFails(getDoc(doc(patient, "notificationDeliveryAttempts/attempt-1")));
});

test("keeps synchronized favorites and saved searches server-only", async () => {
  const patient = environment.authenticatedContext("patient-1").firestore();

  await assertFails(setDoc(doc(patient, "users/patient-1/favorites/doctor-1"), { doctorId: "doctor-1" }));
  await assertFails(setDoc(doc(patient, "users/patient-1/savedSearches/search-1"), { criteria: { specialty: "psiquiatria" } }));
});

test("requires explicit health consent before accepting raw search events", async () => {
  const withoutConsent = environment.authenticatedContext("search-without-consent").firestore();
  const withConsent = environment.authenticatedContext("search-with-consent").firestore();
  const event = () => ({ query: "psiquiatra em Joinville", timestamp: serverTimestamp() });
  const eventId = `event-${Date.now()}`;

  await assertFails(setDoc(doc(withoutConsent, `users/search-without-consent/search_events/${eventId}`), event()));
  await assertSucceeds(setDoc(doc(withConsent, `users/search-with-consent/search_events/${eventId}`), event()));
});

test("allows only account-owned profile fields and blocks derived writes", async () => {
  const userId = `rules-profile-${Date.now()}`;
  const patient = environment.authenticatedContext(userId, { email: "patient@example.com" }).firestore();

  await assertSucceeds(setDoc(doc(patient, `users/${userId}`), {
    email: "patient@example.com",
    cidade: "Joinville",
    idioma: "Português",
    acessibilidade: false,
    created_at: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(patient, `users/${userId}`), { affinity: { psiquiatria: 1 } }, { merge: true }));
  await assertFails(deleteDoc(doc(patient, `users/${userId}`)));
  await assertFails(setDoc(doc(patient, `users/${userId}/interests/psiquiatria`), { specialty: "psiquiatria" }));
});
