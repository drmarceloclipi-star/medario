"use strict";

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { assertFails, assertSucceeds, initializeTestEnvironment } = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc } = require("firebase/firestore");

const projectId = "medario-rules-test";
let environment;

test.before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "appointments/appointment-1"), { patientUid: "patient-1", doctorId: "doctor-1", status: "requested" });
    await setDoc(doc(db, "professionalAccounts/doctor-user"), { doctorId: "doctor-1" });
    await setDoc(doc(db, "calendarAvailability/doctor-1"), { status: "available" });
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
