"use strict";

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertFails, assertSucceeds, initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } = require("firebase/firestore");

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
    await setDoc(doc(db, "publicDoctors/doctor-1"), { published: true, publicReadSafe: true, slug: "doctor-1" });
    await setDoc(doc(db, "publicDoctors/doctor-authorized"), {
      published: true,
      publicReadSafe: true,
      slug: "doctor-authorized",
      location: { city: "Joinville", authorized: true, address: "Rua autorizada, 10" },
    });
    await setDoc(doc(db, "publicDoctors/doctor-sanitized"), {
      published: true,
      publicReadSafe: true,
      slug: "doctor-sanitized",
      location: { city: "Joinville", authorized: false },
    });
    await setDoc(doc(db, "publicDoctors/doctor-unsafe"), {
      published: true,
      publicReadSafe: false,
      slug: "doctor-unsafe",
      location: { city: "Joinville", authorized: false, address: "Rua privada, 99" },
    });
    await setDoc(doc(db, "publicDoctors/doctor-address-without-authorization"), {
      published: true,
      publicReadSafe: false,
      slug: "doctor-address-without-authorization",
      location: { city: "Joinville", address: "Rua privada, 100" },
    });
    await setDoc(doc(db, "users/search-without-consent"), { email: "no-consent@example.com", consent_preferences: false });
    await setDoc(doc(db, "users/search-with-consent"), { email: "consent@example.com", consent_preferences: true });
    await setDoc(doc(db, "users/deleted-user"), { email: "deleted@example.com", consent_preferences: false });
    await setDoc(doc(db, "deletedUsers/deleted-user"), { expiresAt: Timestamp.fromDate(new Date("2099-01-01T00:00:00Z")), finalizeAfter: Timestamp.fromDate(new Date("2098-12-31T00:00:00Z")) });
    await setDoc(doc(db, "deletedUsers/expired-user"), { expiresAt: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")), finalizeAfter: Timestamp.fromDate(new Date("1999-12-31T00:00:00Z")) });
    await setDoc(doc(db, "appointmentRateLimits/patient-1_2030-01-01"), { patientUid: "patient-1", count: 1 });
  });
});

test.after(async () => environment.cleanup());

test("allows patient to read own appointment while professionals use server DTOs", async () => {
  const patient = environment.authenticatedContext("patient-1").firestore();
  const doctor = environment.authenticatedContext("doctor-user").firestore();
  const stranger = environment.authenticatedContext("patient-2").firestore();

  await assertSucceeds(getDoc(doc(patient, "appointments/appointment-1")));
  await assertFails(getDoc(doc(doctor, "appointments/appointment-1")));
  await assertFails(getDoc(doc(stranger, "appointments/appointment-1")));
});

test("denies direct writes and all availability reads", async () => {
  const patient = environment.authenticatedContext("patient-1").firestore();

  await assertFails(setDoc(doc(patient, "appointments/appointment-1"), { status: "confirmed" }, { merge: true }));
  await assertFails(getDoc(doc(patient, "calendarAvailability/doctor-1")));
  await assertFails(getDoc(doc(patient, "appointmentRateLimits/patient-1_2030-01-01")));
});

test("exposes only published public projections", async () => {
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, "publicDoctors/doctor-1")));
  await assertFails(getDoc(doc(anonymous, "doctors/doctor-1")));
});

test("allows sanitized or authorized public locations and denies unsafe addresses", async () => {
  const anonymous = environment.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(anonymous, "publicDoctors/doctor-sanitized")));
  await assertSucceeds(getDoc(doc(anonymous, "publicDoctors/doctor-authorized")));
  await assertFails(getDoc(doc(anonymous, "publicDoctors/doctor-unsafe")));
  await assertFails(getDoc(doc(anonymous, "publicDoctors/doctor-address-without-authorization")));
});

test("lists only projections explicitly marked safe without rules acting as filters", async () => {
  const anonymous = environment.unauthenticatedContext().firestore();
  const safeDirectory = query(
    collection(anonymous, "publicDoctors"),
    where("published", "==", true),
    where("publicReadSafe", "==", true),
  );

  const snapshot = await assertSucceeds(getDocs(safeDirectory));
  assert.deepEqual(snapshot.docs.map((item) => item.id).sort(), ["doctor-1", "doctor-authorized", "doctor-sanitized"]);
  await assertFails(getDocs(query(collection(anonymous, "publicDoctors"), where("published", "==", true))));
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

test("allows granting consent but requires the revocation callable", async () => {
  const granted = environment.authenticatedContext("search-with-consent", { email: "consent@example.com" }).firestore();
  const denied = environment.authenticatedContext("search-without-consent", { email: "no-consent@example.com" }).firestore();

  await assertFails(setDoc(doc(granted, "users/search-with-consent"), { consent_preferences: false, consent_at: serverTimestamp() }, { merge: true }));
  await assertSucceeds(setDoc(doc(granted, "users/search-with-consent"), { cidade: "Joinville", consent_preferences: true }, { merge: true }));
  await assertFails(setDoc(doc(denied, "users/search-without-consent"), { consent_preferences: true }, { merge: true }));
  await assertSucceeds(setDoc(doc(denied, "users/search-without-consent"), { consent_preferences: true, consent_at: serverTimestamp() }, { merge: true }));

  const newUserId = `consent-create-${Date.now()}`;
  const newUser = environment.authenticatedContext(newUserId, { email: "new-consent@example.com" }).firestore();
  const profile = { email: "new-consent@example.com", idioma: "Português", acessibilidade: false, consent_preferences: true, created_at: serverTimestamp() };
  await assertFails(setDoc(doc(newUser, `users/${newUserId}`), profile));
  await assertSucceeds(setDoc(doc(newUser, `users/${newUserId}`), { ...profile, consent_at: serverTimestamp() }));
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

test("active deletion tombstone blocks stale tokens while remaining server-only", async () => {
  const deleted = environment.authenticatedContext("deleted-user", { email: "deleted@example.com" }).firestore();

  await assertFails(getDoc(doc(deleted, "users/deleted-user")));
  await assertFails(setDoc(doc(deleted, "users/deleted-user"), {
    email: "deleted@example.com",
    idioma: "Português",
    acessibilidade: false,
    created_at: serverTimestamp(),
  }));
  await assertFails(getDoc(doc(deleted, "deletedUsers/deleted-user")));
});

test("expired tombstone no longer blocks a legitimate account profile", async () => {
  const restored = environment.authenticatedContext("expired-user", { email: "restored@example.com" }).firestore();
  await assertSucceeds(setDoc(doc(restored, "users/expired-user"), {
    email: "restored@example.com",
    idioma: "Português",
    acessibilidade: false,
    created_at: serverTimestamp(),
  }));
});
