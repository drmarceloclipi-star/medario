/**
 * Medário — Cloud Functions
 * ------------------------------------------------------------------
 * 1. onSearchEvent     — Firestore trigger: process & delete search events
 * 2. computeAffinity    — Firestore trigger: normalize interests → affinity
 * 3. onUserDelete       — Auth trigger: full data cleanup on account deletion
 *
 * Deploy:  firebase deploy --only functions
 * Runtime: Node 18 (ESM not required; CommonJS via firebase-functions v5)
 * ------------------------------------------------------------------
 */

const functionsV1 = require("firebase-functions/v1");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { FieldPath, FieldValue, Timestamp } = require("firebase-admin/firestore");
const crypto = require("node:crypto");
const {
  APPOINTMENT_IDEMPOTENCY_MS,
  appointmentRequestQuotaDecision,
  calendarIsFresh,
  cancellationDecision,
  canTransitionAppointment,
  createReservationDecision,
  idempotencyIsActive,
  slotIsEligible,
} = require("./appointment-policy");
const { busyIntervalsFrom, calendarEventId, calendarSlotIsAvailable } = require("./calendar-policy");
const { defaultPreferences, enabledChannels, notificationOutboxRecord, preferencesFrom, preferencesFromDocument, providerlessDeliveryState, safePushMessage } = require("./notification-policy");
const { leadMetricsFrom, profileChangesFrom } = require("./professional-policy");
const { expectedAccountMatches, savedSearchCriteriaFrom, savedSearchRecord } = require("./saved-items-policy");
const {
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
} = require("./user-cleanup-policy");
const { unmatchedSearchLogMessage } = require("./privacy");

admin.initializeApp();
const db = admin.firestore();

const DELETE_PAGE_SIZE = 400;

async function deleteQueryDocuments(query) {
  const deletedIds = [];
  while (true) {
    const snapshot = await query.limit(DELETE_PAGE_SIZE).get();
    if (snapshot.empty) return deletedIds;
    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      deletedIds.push(document.id);
      batch.delete(document.ref);
    });
    await batch.commit();
    if (snapshot.size < DELETE_PAGE_SIZE) return deletedIds;
  }
}

async function updateQueryDocuments(query, patch) {
  while (true) {
    const snapshot = await query.limit(DELETE_PAGE_SIZE).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.update(document.ref, patch));
    await batch.commit();
    if (snapshot.size < DELETE_PAGE_SIZE) return;
  }
}

async function deleteRecursiveQueryDocuments(query) {
  while (true) {
    const snapshot = await query.limit(100).get();
    if (snapshot.empty) return;
    await Promise.all(snapshot.docs.map((document) => db.recursiveDelete(document.ref)));
    if (snapshot.size < 100) return;
  }
}

function documentIdPrefixQuery(collection, prefix) {
  return collection
    .orderBy(FieldPath.documentId())
    .startAt(prefix)
    .endAt(`${prefix}\uf8ff`);
}

async function deleteLinkedNotificationAttempts(outboxIds, endpointIds) {
  for (let index = 0; index < outboxIds.length; index += 30) {
    const ids = outboxIds.slice(index, index + 30);
    if (!ids.length) continue;
    await deleteQueryDocuments(db.collection("notificationDeliveryAttempts").where("notificationId", "in", ids));
    await deleteQueryDocuments(db.collection("notificationDeliveryAttempts").where("outboxId", "in", ids));
  }
  for (let index = 0; index < endpointIds.length; index += 30) {
    const ids = endpointIds.slice(index, index + 30);
    if (!ids.length) continue;
    await deleteQueryDocuments(db.collection("notificationDeliveryAttempts").where("endpointId", "in", ids));
  }
}

async function activeAccount(context, message = "Faça login para continuar.") {
  const uid = context.auth?.uid;
  if (!uid) throw new functionsV1.https.HttpsError("unauthenticated", message);
  const tombstone = await db.collection("deletedUsers").doc(uid).get();
  if (tombstone.exists && tombstoneIsActive(tombstone.data())) {
    throw new functionsV1.https.HttpsError("failed-precondition", "Esta conta está em processo de exclusão.");
  }
  return uid;
}

async function ensureDeletionTombstone(uid) {
  const ref = db.collection("deletedUsers").doc(uid);
  const professionalRef = db.collection("professionalAccounts").doc(uid);
  await db.runTransaction(async (transaction) => {
    const [snapshot, professional] = await Promise.all([transaction.get(ref), transaction.get(professionalRef)]);
    const professionalDoctorId = professional.exists && typeof professional.data()?.doctorId === "string" ? professional.data().doctorId : null;
    if (snapshot.exists && tombstoneIsActive(snapshot.data())) {
      if (!snapshot.data()?.professionalDoctorId && professionalDoctorId) transaction.set(ref, { professionalDoctorId }, { merge: true });
      return;
    }
    transaction.set(ref, { ...deletionTombstone(Timestamp.now().toDate()), ...(professionalDoctorId ? { professionalDoctorId } : {}) });
  });
}

async function cleanupProfessionalData(uid, doctorIdHint = null) {
  const accountRef = db.collection("professionalAccounts").doc(uid);
  const accountSnapshot = await accountRef.get();
  const accountDoctorId = accountSnapshot.exists && typeof accountSnapshot.data()?.doctorId === "string" ? accountSnapshot.data().doctorId : null;
  const doctorId = accountDoctorId || doctorIdHint;

  await deleteRecursiveQueryDocuments(db.collection("calendarOAuthStates").where("uid", "==", uid));
  await deleteRecursiveQueryDocuments(db.collection("profileChangeRequests").where("professionalUid", "==", uid));
  if (!doctorId) {
    await accountRef.delete();
    return;
  }

  const ownerSnapshots = await db.collection("professionalAccounts").where("doctorId", "==", doctorId).get();
  const otherActiveOwner = ownerSnapshots.docs.some((owner) => owner.id !== uid && owner.data()?.status === "active");
  if (shouldDeleteSharedProfessionalResources(otherActiveOwner)) {
    await Promise.all([
      db.recursiveDelete(db.collection("calendarConnections").doc(doctorId)),
      db.recursiveDelete(db.collection("calendarAvailability").doc(doctorId)),
      deleteRecursiveQueryDocuments(db.collection("calendarOutbox").where("doctorId", "==", doctorId)),
    ]);
  }

  const doctorRef = db.collection("doctors").doc(doctorId);
  const publicDoctorRef = db.collection("publicDoctors").doc(doctorId);
  await db.runTransaction(async (transaction) => {
    const [currentAccount, owners, doctor, publicDoctor] = await Promise.all([
      transaction.get(accountRef),
      transaction.get(db.collection("professionalAccounts").where("doctorId", "==", doctorId)),
      transaction.get(doctorRef),
      transaction.get(publicDoctorRef),
    ]);
    const stillOwns = currentAccount.exists && currentAccount.data()?.doctorId === doctorId;
    const transactionOtherActiveOwner = owners.docs.some((owner) => owner.id !== uid && owner.data()?.status === "active");
    const explicitOwner = publicDoctor.data()?.claimedByUid || doctor.data()?.claimedByUid;
    if (stillOwns && canReleaseClaim({ ownerUid: explicitOwner, uid, otherActiveOwner: transactionOtherActiveOwner })) {
      const fieldDelete = FieldValue.delete();
      if (doctor.exists) transaction.update(doctorRef, { claimed: false, claimed_status: "unclaimed", claimedByUid: fieldDelete, claimedAt: fieldDelete });
      if (publicDoctor.exists) transaction.update(publicDoctorRef, { claimed: false, claimedByUid: fieldDelete, claimedAt: fieldDelete });
    }
    transaction.delete(accountRef);
  });
}

async function cleanupUserData(uid) {
  const now = new Date();
  const userRef = db.collection("users").doc(uid);
  const tombstoneSnapshot = await db.collection("deletedUsers").doc(uid).get();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (snapshot.exists) transaction.update(userRef, { consent_preferences: false, deletionRequestedAt: now });
  });
  const specs = linkedCleanupQueries(uid);
  const endpointIds = new Set([uid]);
  for (const spec of specs.filter((item) => item.collection === "notificationEndpoints")) {
    const ids = await deleteQueryDocuments(db.collection(spec.collection).where(spec.field, "==", spec.value));
    ids.forEach((id) => endpointIds.add(id));
  }
  const outboxIds = await deleteQueryDocuments(db.collection("notificationOutbox").where("recipientUid", "==", uid));
  await deleteLinkedNotificationAttempts(outboxIds, [...endpointIds]);

  for (const spec of specs) {
    if (spec.collection === "notificationEndpoints" || spec.collection === "notificationOutbox") continue;
    await deleteQueryDocuments(db.collection(spec.collection).where(spec.field, "==", spec.value));
  }

  // Legacy records predate the patientUid field and encode ownership in the document ID.
  await deleteQueryDocuments(documentIdPrefixQuery(db.collection("appointmentIdempotency"), `${uid}_`));
  await deleteQueryDocuments(documentIdPrefixQuery(db.collection("notificationDeliveryAttempts"), `${uid}_`));
  await db.collection("notificationPreferences").doc(uid).delete();
  await db.collection("notificationEndpoints").doc(uid).delete();

  // Appointments remain as operational records, but no longer identify the deleted patient.
  await updateQueryDocuments(
    db.collection("appointments").where("patientUid", "==", uid),
    appointmentErasurePatch(FieldValue, now)
  );

  await cleanupProfessionalData(uid, tombstoneSnapshot.data()?.professionalDoctorId || null);

  // recursiveDelete also covers future or previously unknown owned subcollections.
  await db.recursiveDelete(userRef);
}

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new functionsV1.https.HttpsError("invalid-argument", `${name} is required.`);
  }
  return value.trim();
}

function assertExpectedAccount(data, uid) {
  if (!expectedAccountMatches(data?.expectedUid, uid)) {
    throw new functionsV1.https.HttpsError("failed-precondition", "A sessão mudou. Inicie a operação novamente.");
  }
}

function requireVerifiedEmail(context) {
  if (context.auth?.token?.email_verified !== true) {
    throw new functionsV1.https.HttpsError("failed-precondition", "Confirme seu e-mail antes de agendar.");
  }
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decryptCalendarToken(record) {
  const configuredKey = process.env.FUNCTIONS_EMULATOR === "true"
    ? process.env.MEDARIO_EMULATOR_CALENDAR_TOKEN_KEY
    : process.env.MEDARIO_CALENDAR_TOKEN_KEY;
  const key = Buffer.from(configuredKey || "", "base64");
  if (key.length !== 32 || !record?.ciphertext || !record?.iv || !record?.tag) throw new Error("calendar token unavailable");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

async function googleAccessToken(connection) {
  const refreshToken = decryptCalendarToken(connection.refreshToken);
  const body = new URLSearchParams({ client_id: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_ID || "", client_secret: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET || "", refresh_token: refreshToken, grant_type: "refresh_token" });
  const tokenURL = process.env.MEDARIO_GOOGLE_TOKEN_ENDPOINT || "https://oauth2.googleapis.com/token";
  const response = await fetch(tokenURL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json();
  if (!response.ok || typeof payload.access_token !== "string") throw new Error("calendar refresh failed");
  return payload.access_token;
}

function integrationCalendarId(connection) {
  const calendarId = connection?.integrationCalendarId;
  if (typeof calendarId !== "string" || !calendarId.trim() || calendarId === "primary") throw new Error("integration calendar unavailable");
  return calendarId;
}

async function googleBusyIntervals(accessToken, calendarId) {
  const now = new Date();
  const calendarBaseURL = process.env.MEDARIO_GOOGLE_CALENDAR_API_BASE_URL || "https://www.googleapis.com/calendar/v3";
  const response = await fetch(`${calendarBaseURL}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: now.toISOString(), timeMax: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(), items: [{ id: calendarId }] }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error("calendar availability failed");
  return { busy: busyIntervalsFrom(payload, calendarId), fetchedAt: now };
}

async function refreshCalendarAvailability(doctorId) {
  const connectionSnap = await db.collection("calendarConnections").doc(doctorId).get();
  const connection = connectionSnap.data();
  if (!connectionSnap.exists || connection.status !== "active") throw new Error("calendar disconnected");
  const calendarId = integrationCalendarId(connection);
  try {
    const accessToken = await googleAccessToken(connection);
    const availability = await googleBusyIntervals(accessToken, calendarId);
    await db.collection("calendarAvailability").doc(doctorId).set({ status: "available", integrationCalendarId: calendarId, ...availability, updatedAt: new Date() });
    return { calendarId, ...availability };
  } catch (error) {
    await db.collection("calendarAvailability").doc(doctorId).set({ status: "unavailable", fetchedAt: new Date(), updatedAt: new Date() }, { merge: true });
    throw error;
  }
}

async function deliverCalendarOutboxItem(item) {
  const task = item.data();
  const connectionSnap = await db.collection("calendarConnections").doc(task.doctorId).get();
  const connection = connectionSnap.data();
  if (!connectionSnap.exists || connection.status !== "active") throw new Error("calendar disconnected");
  const accessToken = await googleAccessToken(connection);
  const calendarId = integrationCalendarId(connection);
  const eventId = calendarEventId(task.medarioAppointmentId);
  const calendarBaseURL = process.env.MEDARIO_GOOGLE_CALENDAR_API_BASE_URL || "https://www.googleapis.com/calendar/v3";
  const eventURL = `${calendarBaseURL}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
  if (task.action === "cancel") {
    const response = await fetch(eventURL, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`calendar event ${response.status}`);
    await item.ref.update({ state: "delivered", eventId, deliveredAt: new Date(), attempts: FieldValue.increment(1) });
    return;
  }
  if (task.action && task.action !== "create" && task.action !== "reschedule") throw new Error("calendar action invalid");
  const appointmentRef = db.collection("appointments").doc(task.medarioAppointmentId);
  const appointmentBeforeDelivery = await appointmentRef.get();
  if (!appointmentBeforeDelivery.exists || appointmentBeforeDelivery.data()?.status !== "confirmed") {
    await item.ref.update({ state: "superseded", eventId, deliveredAt: new Date(), attempts: FieldValue.increment(1) });
    return;
  }
  if (Number.isInteger(task.appointmentVersion) && appointmentBeforeDelivery.data()?.version !== task.appointmentVersion) {
    await item.ref.update({ state: "superseded", eventId, deliveredAt: new Date(), attempts: FieldValue.increment(1) });
    return;
  }
  const startsAt = task.startsAt?.toDate ? task.startsAt.toDate() : new Date(task.startsAt);
  const endsAt = task.endsAt?.toDate ? task.endsAt.toDate() : new Date(task.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) throw new Error("calendar event time invalid");
  const event = { summary: `Medário ${task.medarioAppointmentId}`, start: { dateTime: startsAt.toISOString() }, end: { dateTime: endsAt.toISOString() }, extendedProperties: { private: { medarioAppointmentId: task.medarioAppointmentId } } };
  const response = await fetch(eventURL, { method: "PUT", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify(event) });
  if (!response.ok) throw new Error(`calendar event ${response.status}`);
  const appointmentAfterDelivery = await appointmentRef.get();
  if (!appointmentAfterDelivery.exists || appointmentAfterDelivery.data()?.status !== "confirmed") {
    const cleanup = await fetch(eventURL, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } });
    if (!cleanup.ok && cleanup.status !== 404 && cleanup.status !== 410) throw new Error(`calendar cleanup ${cleanup.status}`);
    await item.ref.update({ state: "superseded", eventId, deliveredAt: new Date(), attempts: FieldValue.increment(1) });
    return;
  }
  if (Number.isInteger(task.appointmentVersion) && appointmentAfterDelivery.data()?.version !== task.appointmentVersion) {
    const latestStartsAtValue = appointmentAfterDelivery.data()?.startsAt;
    const latestEndsAtValue = appointmentAfterDelivery.data()?.endsAt;
    const latestStartsAt = latestStartsAtValue?.toDate ? latestStartsAtValue.toDate() : new Date(latestStartsAtValue);
    const latestEndsAt = latestEndsAtValue?.toDate ? latestEndsAtValue.toDate() : new Date(latestEndsAtValue);
    if (Number.isNaN(latestStartsAt.getTime()) || Number.isNaN(latestEndsAt.getTime()) || latestStartsAt >= latestEndsAt) throw new Error("calendar corrective time invalid");
    const correctiveEvent = { ...event, start: { dateTime: latestStartsAt.toISOString() }, end: { dateTime: latestEndsAt.toISOString() } };
    const correctiveResponse = await fetch(eventURL, { method: "PUT", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify(correctiveEvent) });
    if (!correctiveResponse.ok) throw new Error(`calendar corrective event ${correctiveResponse.status}`);
    await item.ref.update({ state: "superseded", eventId, deliveredAt: new Date(), attempts: FieldValue.increment(1) });
    return;
  }
  await item.ref.update({ state: "delivered", eventId, deliveredAt: new Date(), attempts: FieldValue.increment(1) });
}

function decisionError(decision) {
  const messages = {
    idempotency_conflict: "A mesma chave não pode representar outra solicitação.",
    calendar_stale: "Disponibilidade da agenda precisa ser confirmada.",
    slot_unavailable: "Este horário não está mais disponível.",
    invalid_confirmation_policy: "Política de confirmação inválida.",
  };
  return new functionsV1.https.HttpsError("failed-precondition", messages[decision.code] || "Solicitação não pode ser concluída.");
}

function boundedInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new functionsV1.https.HttpsError("invalid-argument", `${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function optionalPriceCents(value) {
  if (value === undefined || value === null || value === "") return null;
  return boundedInteger(value, "priceCents", 0, 10_000_000);
}

function appointmentModality(value, fallback = "in_person") {
  if (value === undefined) return fallback;
  if (value !== "in_person" && value !== "telemedicine") {
    throw new functionsV1.https.HttpsError("invalid-argument", "Modalidade inválida.");
  }
  return value;
}

function appointmentTypeInput(data, existing = {}) {
  const confirmationPolicy = requiredString(data?.confirmationPolicy, "confirmationPolicy");
  if (confirmationPolicy !== "immediate" && confirmationPolicy !== "manual") {
    throw new functionsV1.https.HttpsError("invalid-argument", "confirmationPolicy inválida.");
  }
  return {
    label: requiredString(data?.label, "label"),
    locationId: requiredString(data?.locationId, "locationId"),
    modality: appointmentModality(data?.modality, existing.modality || "in_person"),
    cancellationPolicy: data?.cancellationPolicy === undefined
      ? (existing.cancellationPolicy || "Cancelamento pode ser solicitado até o início do atendimento.")
      : requiredString(data.cancellationPolicy, "cancellationPolicy"),
    cancellationNoticeMinutes: data?.cancellationNoticeMinutes === undefined
      ? (Number.isInteger(existing.cancellationNoticeMinutes) ? existing.cancellationNoticeMinutes : 0)
      : boundedInteger(data.cancellationNoticeMinutes, "cancellationNoticeMinutes", 0, 43200),
    priceCents: data?.priceCents === undefined
      ? (Number.isInteger(existing.priceCents) ? existing.priceCents : null)
      : optionalPriceCents(data.priceCents),
    durationMinutes: boundedInteger(data?.durationMinutes, "durationMinutes", 10, 480),
    bufferMinutes: boundedInteger(data?.bufferMinutes, "bufferMinutes", 0, 180),
    minimumLeadMinutes: boundedInteger(data?.minimumLeadMinutes, "minimumLeadMinutes", 0, 10080),
    maximumWindowDays: boundedInteger(data?.maximumWindowDays, "maximumWindowDays", 1, 365),
    confirmationPolicy,
    enabled: data?.enabled !== false,
  };
}

function publicLocationForAppointment(publicDoctor, locationId, modality) {
  if (modality === "telemedicine") return { id: locationId, label: "Teleconsulta" };
  const legacy = publicDoctor?.location && typeof publicDoctor.location === "object" ? publicDoctor.location : null;
  const locations = Array.isArray(publicDoctor?.locations)
    ? publicDoctor.locations.filter((item) => item && typeof item === "object")
    : [];
  const matching = locations.find((item) => item.id === locationId);
  const selected = matching || (legacy && (legacy.id === locationId || locationId === "principal") ? legacy : null);
  if (!selected) {
    throw new functionsV1.https.HttpsError("failed-precondition", "Local de atendimento não corresponde ao tipo de consulta.");
  }
  const label = typeof selected.name === "string" && selected.name.trim()
    ? selected.name.trim()
    : "Local de atendimento";
  return { id: locationId, label };
}

function isoTimestamp(value) {
  if (!value) return null;
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function patientAppointmentDTO(id, appointment) {
  const modality = appointment.modality === "telemedicine" ? "telemedicine" : "in_person";
  const validStatuses = new Set(["requested", "confirmed", "declined", "reschedule_proposed", "reschedule_requested", "cancel_requested", "cancelled", "completed", "no_show"]);
  return {
    id,
    doctorId: typeof appointment.doctorId === "string" ? appointment.doctorId : "",
    doctorName: typeof appointment.doctorName === "string" ? appointment.doctorName : "Perfil médico",
    doctorSlug: typeof appointment.doctorSlug === "string" ? appointment.doctorSlug : "",
    typeLabel: typeof appointment.typeLabel === "string" ? appointment.typeLabel : "Consulta",
    typeId: typeof appointment.typeId === "string" ? appointment.typeId : "",
    modality,
    startsAt: isoTimestamp(appointment.startsAt),
    endsAt: isoTimestamp(appointment.endsAt),
    timezone: typeof appointment.timezone === "string" ? appointment.timezone : "America/Sao_Paulo",
    locationLabel: typeof appointment.locationLabel === "string" ? appointment.locationLabel : "Local a confirmar",
    cancellationPolicy: typeof appointment.cancellationPolicy === "string" ? appointment.cancellationPolicy : "Consulte condições com o médico.",
    cancellationNoticeMinutes: Number.isInteger(appointment.cancellationNoticeMinutes) ? appointment.cancellationNoticeMinutes : 0,
    priceCents: Number.isInteger(appointment.priceCents) ? appointment.priceCents : null,
    confirmationPolicy: appointment.confirmationPolicy === "immediate" ? "immediate" : "manual",
    status: validStatuses.has(appointment.status) ? appointment.status : "requested",
    requestedAt: isoTimestamp(appointment.requestedAt),
    confirmedAt: isoTimestamp(appointment.confirmedAt),
    cancelledAt: isoTimestamp(appointment.cancelledAt),
    proposedStartsAt: isoTimestamp(appointment.proposedStartsAt),
    proposedEndsAt: isoTimestamp(appointment.proposedEndsAt),
  };
}

function appointmentTime(value, name) {
  const date = new Date(requiredString(value, name));
  if (Number.isNaN(date.getTime())) throw new functionsV1.https.HttpsError("invalid-argument", `${name} inválido.`);
  return date;
}

async function activeProfessionalAccount(transaction, uid) {
  const accountRef = db.collection("professionalAccounts").doc(uid);
  const tombstoneRef = db.collection("deletedUsers").doc(uid);
  const [accountSnap, tombstoneSnap] = await Promise.all([transaction.get(accountRef), transaction.get(tombstoneRef)]);
  if (tombstoneSnap.exists && tombstoneIsActive(tombstoneSnap.data())) {
    throw new functionsV1.https.HttpsError("failed-precondition", "Esta conta está em processo de exclusão.");
  }
  if (!accountSnap.exists || accountSnap.data().status !== "active" || typeof accountSnap.data().doctorId !== "string") {
    throw new functionsV1.https.HttpsError("permission-denied", "Conta profissional não autorizada.");
  }
  return accountSnap.data();
}

function enqueueOptedInNotifications(transaction, preferenceSnap, { event, recipientUid, subjectRef, now }) {
  let preferences;
  try { preferences = preferenceSnap?.exists ? preferencesFromDocument(preferenceSnap.data()) : defaultPreferences(); } catch { preferences = defaultPreferences(); }
  const channels = enabledChannels(preferences, event);
  for (const channel of channels) {
    const id = digest(JSON.stringify({ event, channel, recipientUid, subjectRef }));
    transaction.create(db.collection("notificationOutbox").doc(id), notificationOutboxRecord({ id, event, channel, recipientUid, subjectRef, now }));
  }
  return channels.length;
}

/* ==================================================================
 * Appointment orchestration
 * ------------------------------------------------------------------
 * Firestore is the source of truth. Google Calendar receives only an
 * outbox task after a confirmed transaction; it is never called inside
 * the transaction and never receives patient or health information.
 * ================================================================== */
exports.listPublicAppointmentOptions = functionsV1.https.onCall(async (data) => {
  const slug = requiredString(data?.slug, "slug");
  const publicDoctorSnap = await db.collection("publicDoctors")
    .where("slug", "==", slug)
    .where("published", "==", true)
    .where("publicReadSafe", "==", true)
    .limit(1)
    .get();
  const publicDoctor = publicDoctorSnap.docs[0];
  if (!publicDoctor) throw new functionsV1.https.HttpsError("not-found", "Perfil médico não encontrado.");

  const doctorId = publicDoctor.id;
  const [typesSnap, slotsSnap, availabilitySnap] = await Promise.all([
    db.collection("doctors").doc(doctorId).collection("appointmentTypes").get(),
    db.collection("doctors").doc(doctorId).collection("slots").where("status", "==", "open").limit(100).get(),
    db.collection("calendarAvailability").doc(doctorId).get(),
  ]);
  const types = new Map(typesSnap.docs.map((item) => [item.id, { id: item.id, ...item.data() }]));
  const availability = availabilitySnap.exists ? availabilitySnap.data() : null;
  const calendarAvailable = calendarIsFresh(availability);
  const slots = calendarAvailable
    ? slotsSnap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((slot) => {
      const type = types.get(slot.appointmentTypeId);
      return slotIsEligible(slot, type) && calendarSlotIsAvailable(availability, slot);
    }).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    : [];
  const offeredTypeIds = new Set(slots.map((slot) => slot.appointmentTypeId));
  const publicDoctorData = publicDoctor.data();
  return {
    doctorId,
    doctorName: publicDoctor.data().name,
    doctorSlug: publicDoctor.data().slug,
    calendarAvailable,
    types: [...types.values()].filter((type) => type.enabled !== false && offeredTypeIds.has(type.id)).map((type) => {
      const modality = type.modality || "in_person";
      const location = publicLocationForAppointment(publicDoctorData, type.locationId, modality);
      return {
        id: type.id,
        label: type.label,
        modality,
        locationLabel: location.label,
        confirmationPolicy: type.confirmationPolicy,
        cancellationPolicy: type.cancellationPolicy || "Cancelamento pode ser solicitado até o início do atendimento.",
        cancellationNoticeMinutes: Number.isInteger(type.cancellationNoticeMinutes) ? type.cancellationNoticeMinutes : 0,
        priceCents: Number.isInteger(type.priceCents) ? type.priceCents : null,
      };
    }),
    slots: slots.map((slot) => ({ id: slot.id, typeId: slot.appointmentTypeId, startsAt: slot.startsAt, endsAt: slot.endsAt })),
  };
});

exports.saveProfessionalAppointmentType = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const professional = await activeProfessionalAccount(transaction, context.auth.uid);
    const typeId = data?.typeId ? requiredString(data.typeId, "typeId") : db.collection("doctors").doc(professional.doctorId).collection("appointmentTypes").doc().id;
    const typeRef = db.collection("doctors").doc(professional.doctorId).collection("appointmentTypes").doc(typeId);
    const typeSnap = await transaction.get(typeRef);
    const input = appointmentTypeInput(data, typeSnap.exists ? typeSnap.data() : {});
    transaction.set(typeRef, { ...input, updatedAt: now }, { merge: true });
    return { id: typeId, ...input };
  });
});

exports.createProfessionalAppointmentSlot = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const typeId = requiredString(data?.typeId, "typeId");
  const startsAt = appointmentTime(data?.startsAt, "startsAt");
  const endsAt = appointmentTime(data?.endsAt, "endsAt");
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const professional = await activeProfessionalAccount(transaction, context.auth.uid);
    const typeRef = db.collection("doctors").doc(professional.doctorId).collection("appointmentTypes").doc(typeId);
    const typeSnap = await transaction.get(typeRef);
    if (!typeSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Tipo de consulta não encontrado.");
    const appointmentType = { id: typeSnap.id, ...typeSnap.data() };
    const slot = { appointmentTypeId: typeId, locationId: appointmentType.locationId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), status: "open" };
    if (!slotIsEligible(slot, appointmentType, now)) throw new functionsV1.https.HttpsError("failed-precondition", "Horário fora das regras da agenda.");
    const slotRef = db.collection("doctors").doc(professional.doctorId).collection("slots").doc();
    transaction.create(slotRef, { ...slot, createdAt: now, updatedAt: now, version: 1 });
    return { id: slotRef.id, ...slot };
  });
});

const createAppointmentRequestHandler = async (data, context) => {
  const patientUid = await activeAccount(context, "Faça login para solicitar uma consulta.");
  assertExpectedAccount(data, patientUid);
  requireVerifiedEmail(context);

  const doctorId = requiredString(data?.doctorId, "doctorId");
  const typeId = requiredString(data?.typeId, "typeId");
  const idempotencyKey = requiredString(data?.idempotencyKey, "idempotencyKey");
  const slotId = requiredString(data?.slotId, "slotId");
  const now = new Date();
  const appointmentRef = db.collection("appointments").doc();
  const typeRef = db.collection("doctors").doc(doctorId).collection("appointmentTypes").doc(typeId);
  const slotRef = db.collection("doctors").doc(doctorId).collection("slots").doc(slotId);
  const publicDoctorRef = db.collection("publicDoctors").doc(doctorId);
  const availabilityRef = db.collection("calendarAvailability").doc(doctorId);
  const preferenceRef = db.collection("notificationPreferences").doc(patientUid);
  const idempotencyRef = db.collection("appointmentIdempotency").doc(`${patientUid}_${digest(idempotencyKey)}`);
  const quotaDate = now.toISOString().slice(0, 10);
  const quotaRef = db.collection("appointmentRateLimits").doc(`${patientUid}_${quotaDate}`);

  return db.runTransaction(async (transaction) => {
    const [idempotencySnap, typeSnap, slotSnap, availabilitySnap, preferenceSnap, publicDoctorSnap, quotaSnap] = await Promise.all([
      transaction.get(idempotencyRef),
      transaction.get(typeRef),
      transaction.get(slotRef),
      transaction.get(availabilityRef),
      transaction.get(preferenceRef),
      transaction.get(publicDoctorRef),
      transaction.get(quotaRef),
    ]);
    if (!publicDoctorSnap.exists || publicDoctorSnap.data().published !== true || publicDoctorSnap.data().publicReadSafe !== true) throw new functionsV1.https.HttpsError("failed-precondition", "Perfil médico não está disponível para agendamento.");
    if (!typeSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Tipo de consulta não encontrado.");

    const appointmentType = { id: typeSnap.id, ...typeSnap.data() };
    const slot = slotSnap?.exists ? { id: slotSnap.id, ...slotSnap.data() } : null;
    const requestFingerprint = digest(JSON.stringify({ doctorId, typeId, slotId, patientUid, confirmationPolicy: appointmentType.confirmationPolicy }));
    let existingIdempotency = idempotencySnap.exists ? idempotencySnap.data() : null;
    if (idempotencyIsActive(existingIdempotency, now) && existingIdempotency.requestFingerprint === requestFingerprint) {
      const replaySnap = await transaction.get(db.collection("appointments").doc(existingIdempotency.appointmentId));
      if (replaySnap.exists && replaySnap.data().patientUid === patientUid) {
        return { appointmentId: replaySnap.id, status: replaySnap.data().status, replayed: true };
      }
      existingIdempotency = null;
    }
    const decision = createReservationDecision({
      requestFingerprint,
      appointmentId: appointmentRef.id,
      existingIdempotency,
      slot,
      appointmentType,
      calendarSnapshot: availabilitySnap.exists ? availabilitySnap.data() : null,
      now,
    });
    if (decision.kind === "replay") throw new functionsV1.https.HttpsError("aborted", "Não foi possível recuperar a solicitação anterior.");
    if (decision.kind === "reject") throw decisionError(decision);
    const quota = appointmentRequestQuotaDecision(quotaSnap.exists ? quotaSnap.data() : null, now);
    if (!quota.allowed) throw new functionsV1.https.HttpsError("resource-exhausted", "Limite diário de solicitações atingido.");

    const publicDoctor = publicDoctorSnap.data();
    const modality = appointmentType.modality || "in_person";
    const location = publicLocationForAppointment(publicDoctor, appointmentType.locationId, modality);

    const appointment = {
      doctorId,
      doctorName: publicDoctor.name,
      doctorSlug: publicDoctor.slug,
      typeId,
      typeLabel: appointmentType.label,
      modality,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      timezone: "America/Sao_Paulo",
      locationId: location.id,
      locationLabel: location.label,
      cancellationPolicy: appointmentType.cancellationPolicy || "Cancelamento pode ser solicitado até o início do atendimento.",
      cancellationNoticeMinutes: Number.isInteger(appointmentType.cancellationNoticeMinutes) ? appointmentType.cancellationNoticeMinutes : 0,
      priceCents: Number.isInteger(appointmentType.priceCents) ? appointmentType.priceCents : null,
      patientUid,
      patientName: typeof context.auth?.token?.name === "string" && context.auth.token.name.trim()
        ? context.auth.token.name.trim()
        : (context.auth?.token?.email || "Paciente"),
      patientEmail: context.auth?.token?.email || null,
      requestedSlotId: slotId,
      status: decision.appointment.status,
      confirmationPolicy: appointmentType.confirmationPolicy,
      requestedAt: now,
      ...(decision.appointment.status === "confirmed" ? { confirmedAt: now, slotId } : {}),
      version: 1,
    };
    transaction.create(appointmentRef, appointment);
    if (decision.slotPatch && slotRef) transaction.update(slotRef, { status: decision.slotPatch.status, appointmentId: appointmentRef.id, updatedAt: now, version: FieldValue.increment(1) });
    if (decision.integrationOutbox) transaction.create(db.collection("calendarOutbox").doc(decision.integrationOutbox.id), { ...decision.integrationOutbox, appointmentVersion: 1, doctorId, state: "pending", attempts: 0, createdAt: now });
    if (appointment.status === "confirmed") enqueueOptedInNotifications(transaction, preferenceSnap, { event: "appointment_confirmed", recipientUid: patientUid, subjectRef: appointmentRef.id, now });
    transaction.set(idempotencyRef, { patientUid, requestFingerprint, appointmentId: appointmentRef.id, expiresAt: new Date(now.getTime() + APPOINTMENT_IDEMPOTENCY_MS) });
    transaction.set(quotaRef, { patientUid, date: quotaDate, count: quota.count, expiresAt: quota.expiresAt, updatedAt: now });
    return { appointmentId: appointmentRef.id, status: appointment.status, replayed: false };
  });
};
exports.createAppointmentRequest = functionsV1.https.onCall(createAppointmentRequestHandler);
exports.createNativeAppointmentRequest = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(createAppointmentRequestHandler);

exports.decideAppointmentRequest = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const appointmentId = requiredString(data?.appointmentId, "appointmentId");
  const decision = requiredString(data?.decision, "decision");
  if (decision !== "accept" && decision !== "decline") throw new functionsV1.https.HttpsError("invalid-argument", "Decisão inválida.");
  const appointmentRef = db.collection("appointments").doc(appointmentId);
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const appointmentSnap = await transaction.get(appointmentRef);
    if (!appointmentSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Solicitação não encontrada.");
    const appointment = appointmentSnap.data();
    const professional = await activeProfessionalAccount(transaction, context.auth.uid);
    if (professional.doctorId !== appointment.doctorId) throw new functionsV1.https.HttpsError("permission-denied", "Perfil médico não autorizado.");

    if (decision === "decline") {
      if (!canTransitionAppointment(appointment.status, "declined")) throw new functionsV1.https.HttpsError("failed-precondition", "Solicitação não pode ser recusada neste estado.");
      transaction.update(appointmentRef, { status: "declined", decidedAt: now, version: FieldValue.increment(1) });
      return { appointmentId, status: "declined" };
    }

    if (appointment.status === "confirmed") return { appointmentId, status: "confirmed", replayed: true };
    if (!canTransitionAppointment(appointment.status, "confirmed") || !appointment.requestedSlotId) throw new functionsV1.https.HttpsError("failed-precondition", "Solicitação não pode ser confirmada sem horário selecionado.");
    const typeRef = db.collection("doctors").doc(appointment.doctorId).collection("appointmentTypes").doc(appointment.typeId);
    const slotRef = db.collection("doctors").doc(appointment.doctorId).collection("slots").doc(appointment.requestedSlotId);
    const availabilityRef = db.collection("calendarAvailability").doc(appointment.doctorId);
    const preferenceRef = db.collection("notificationPreferences").doc(appointment.patientUid);
    const [typeSnap, slotSnap, availabilitySnap, preferenceSnap] = await Promise.all([transaction.get(typeRef), transaction.get(slotRef), transaction.get(availabilityRef), transaction.get(preferenceRef)]);
    const appointmentType = typeSnap.exists ? { id: typeSnap.id, ...typeSnap.data() } : null;
    const slot = slotSnap.exists ? { id: slotSnap.id, ...slotSnap.data() } : null;
    const availability = availabilitySnap.exists ? availabilitySnap.data() : null;
    if (!calendarIsFresh(availability, now) || !slotIsEligible(slot, appointmentType, now) || !calendarSlotIsAvailable(availability, slot)) throw new functionsV1.https.HttpsError("failed-precondition", "Agenda ou horário precisa ser confirmado novamente.");
    transaction.update(slotRef, { status: "reserved", appointmentId, updatedAt: now, version: FieldValue.increment(1) });
    const nextVersion = Number(appointment.version || 1) + 1;
    transaction.update(appointmentRef, { status: "confirmed", slotId: slotRef.id, confirmedAt: now, decidedAt: now, version: nextVersion });
    transaction.create(db.collection("calendarOutbox").doc(`${appointmentId}:confirmed`), { id: `${appointmentId}:confirmed`, action: "create", medarioAppointmentId: appointmentId, appointmentVersion: nextVersion, doctorId: appointment.doctorId, startsAt: appointment.startsAt || slot.startsAt, endsAt: appointment.endsAt || slot.endsAt, state: "pending", attempts: 0, createdAt: now });
    enqueueOptedInNotifications(transaction, preferenceSnap, { event: "appointment_confirmed", recipientUid: appointment.patientUid, subjectRef: appointmentId, now });
    return { appointmentId, status: "confirmed", replayed: false };
  });
});

const listMyAppointmentsHandler = async (data, context) => {
  const uid = await activeAccount(context, "Faça login para ver seus agendamentos.");
  assertExpectedAccount(data, uid);
  const pageSize = data?.limit === undefined ? 20 : boundedInteger(data.limit, "limit", 1, 50);
  let query = db.collection("appointments")
    .where("patientUid", "==", uid)
    .orderBy("requestedAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(pageSize);
  if (data?.cursor !== undefined) {
    const cursorTime = appointmentTime(data.cursor?.requestedAt, "cursor.requestedAt");
    const cursorId = requiredString(data.cursor?.id, "cursor.id");
    query = query.startAfter(Timestamp.fromDate(cursorTime), cursorId);
  }
  const snapshot = await query.get();
  const items = snapshot.docs.map((document) => patientAppointmentDTO(document.id, document.data()));
  const last = snapshot.docs.at(-1);
  return {
    items,
    nextCursor: snapshot.size === pageSize && last
      ? { id: last.id, requestedAt: isoTimestamp(last.data().requestedAt) }
      : null,
  };
};
exports.listMyAppointments = functionsV1.https.onCall(listMyAppointmentsHandler);
exports.listMyNativeAppointments = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(listMyAppointmentsHandler);

const requestAppointmentCancellationHandler = async (data, context) => {
  const uid = await activeAccount(context, "Faça login para cancelar seu agendamento.");
  assertExpectedAccount(data, uid);
  const appointmentId = requiredString(data?.appointmentId, "appointmentId");
  const appointmentRef = db.collection("appointments").doc(appointmentId);
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const appointmentSnap = await transaction.get(appointmentRef);
    if (!appointmentSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Agendamento não encontrado.");
    const appointment = { id: appointmentSnap.id, ...appointmentSnap.data() };
    if (appointment.patientUid !== uid) throw new functionsV1.https.HttpsError("permission-denied", "Agendamento não pertence a esta conta.");
    const slotRef = typeof appointment.requestedSlotId === "string"
      ? db.collection("doctors").doc(appointment.doctorId).collection("slots").doc(appointment.requestedSlotId)
      : null;
    const slotSnap = slotRef ? await transaction.get(slotRef) : null;
    const decision = cancellationDecision(appointment, slotSnap?.exists ? slotSnap.data() : null);
    if (decision.kind === "replay") return { appointmentId, status: "cancelled", replayed: true };
    if (decision.kind === "reject") {
      const code = decision.code === "not_found" ? "not-found" : "failed-precondition";
      throw new functionsV1.https.HttpsError(code, "Este agendamento não pode ser cancelado neste estado.");
    }

    transaction.update(appointmentRef, { status: "cancelled", cancelledAt: now, updatedAt: now, version: FieldValue.increment(1) });
    if (decision.slotPatch && slotRef) {
      transaction.update(slotRef, { status: decision.slotPatch.status, appointmentId: FieldValue.delete(), updatedAt: now, version: FieldValue.increment(1) });
    }
    if (decision.integrationOutbox) {
      transaction.set(db.collection("calendarOutbox").doc(decision.integrationOutbox.id), {
        ...decision.integrationOutbox,
        doctorId: appointment.doctorId,
        state: "pending",
        attempts: 0,
        createdAt: now,
      });
    }
    return { appointmentId, status: "cancelled", replayed: false };
  });
};
exports.requestAppointmentCancellation = functionsV1.https.onCall(requestAppointmentCancellationHandler);
exports.requestNativeAppointmentCancellation = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(requestAppointmentCancellationHandler);

const requestAppointmentRescheduleHandler = async (data, context) => {
  const uid = await activeAccount(context, "Faça login para remarcar seu agendamento.");
  assertExpectedAccount(data, uid);
  requireVerifiedEmail(context);
  const appointmentId = requiredString(data?.appointmentId, "appointmentId");
  const newSlotId = requiredString(data?.slotId, "slotId");
  const appointmentRef = db.collection("appointments").doc(appointmentId);
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const appointmentSnap = await transaction.get(appointmentRef);
    if (!appointmentSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Agendamento não encontrado.");
    const appointment = { id: appointmentSnap.id, ...appointmentSnap.data() };
    if (appointment.patientUid !== uid) throw new functionsV1.https.HttpsError("permission-denied", "Agendamento não pertence a esta conta.");
    if (appointment.status === "reschedule_requested" && appointment.proposedSlotId === newSlotId) {
      return { appointmentId, status: "reschedule_requested", replayed: true };
    }
    if (appointment.status !== "confirmed" || !appointment.slotId || newSlotId === appointment.slotId) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Este agendamento não pode ser remarcado neste estado.");
    }
    const oldSlotRef = db.collection("doctors").doc(appointment.doctorId).collection("slots").doc(appointment.slotId);
    const newSlotRef = db.collection("doctors").doc(appointment.doctorId).collection("slots").doc(newSlotId);
    const typeRef = db.collection("doctors").doc(appointment.doctorId).collection("appointmentTypes").doc(appointment.typeId);
    const availabilityRef = db.collection("calendarAvailability").doc(appointment.doctorId);
    const [oldSlotSnap, newSlotSnap, typeSnap, availabilitySnap] = await Promise.all([
      transaction.get(oldSlotRef),
      transaction.get(newSlotRef),
      transaction.get(typeRef),
      transaction.get(availabilityRef),
    ]);
    const oldSlot = oldSlotSnap.exists ? oldSlotSnap.data() : null;
    const newSlot = newSlotSnap.exists ? { id: newSlotSnap.id, ...newSlotSnap.data() } : null;
    const appointmentType = typeSnap.exists ? { id: typeSnap.id, ...typeSnap.data() } : null;
    const availability = availabilitySnap.exists ? availabilitySnap.data() : null;
    const cancellation = cancellationDecision(appointment, oldSlot, now);
    if (cancellation.kind !== "cancel") throw new functionsV1.https.HttpsError("failed-precondition", "A política deste agendamento não permite remarcação agora.");
    if (!calendarIsFresh(availability, now) || !slotIsEligible(newSlot, appointmentType, now) || !calendarSlotIsAvailable(availability, newSlot)) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Novo horário não está mais disponível.");
    }

    if (appointment.confirmationPolicy === "manual") {
      transaction.update(appointmentRef, {
        status: "reschedule_requested",
        proposedSlotId: newSlotId,
        proposedStartsAt: new Date(newSlot.startsAt),
        proposedEndsAt: new Date(newSlot.endsAt),
        rescheduleRequestedAt: now,
        updatedAt: now,
        version: FieldValue.increment(1),
      });
      return { appointmentId, status: "reschedule_requested", replayed: false };
    }
    if (appointment.confirmationPolicy !== "immediate") throw new functionsV1.https.HttpsError("failed-precondition", "Política de confirmação inválida.");

    const nextVersion = Number(appointment.version || 1) + 1;
    transaction.update(oldSlotRef, { status: "open", appointmentId: FieldValue.delete(), updatedAt: now, version: FieldValue.increment(1) });
    transaction.update(newSlotRef, { status: "reserved", appointmentId, updatedAt: now, version: FieldValue.increment(1) });
    transaction.update(appointmentRef, {
      requestedSlotId: newSlotId,
      slotId: newSlotId,
      startsAt: new Date(newSlot.startsAt),
      endsAt: new Date(newSlot.endsAt),
      rescheduledAt: now,
      updatedAt: now,
      version: nextVersion,
    });
    transaction.create(db.collection("calendarOutbox").doc(`${appointmentId}:rescheduled:${nextVersion}`), {
      id: `${appointmentId}:rescheduled:${nextVersion}`,
      action: "reschedule",
      medarioAppointmentId: appointmentId,
      appointmentVersion: nextVersion,
      doctorId: appointment.doctorId,
      startsAt: newSlot.startsAt,
      endsAt: newSlot.endsAt,
      state: "pending",
      attempts: 0,
      createdAt: now,
    });
    return { appointmentId, status: "confirmed", replayed: false };
  });
};
exports.requestAppointmentReschedule = functionsV1.https.onCall(requestAppointmentRescheduleHandler);
exports.requestNativeAppointmentReschedule = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(requestAppointmentRescheduleHandler);

exports.decideAppointmentReschedule = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const appointmentId = requiredString(data?.appointmentId, "appointmentId");
  const decision = requiredString(data?.decision, "decision");
  if (decision !== "accept" && decision !== "decline") throw new functionsV1.https.HttpsError("invalid-argument", "Decisão inválida.");
  const appointmentRef = db.collection("appointments").doc(appointmentId);
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const appointmentSnap = await transaction.get(appointmentRef);
    if (!appointmentSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Agendamento não encontrado.");
    const appointment = { id: appointmentSnap.id, ...appointmentSnap.data() };
    const professional = await activeProfessionalAccount(transaction, context.auth.uid);
    if (professional.doctorId !== appointment.doctorId) throw new functionsV1.https.HttpsError("permission-denied", "Perfil médico não autorizado.");
    if (appointment.status !== "reschedule_requested" || !appointment.proposedSlotId || !appointment.slotId) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Não existe remarcação pendente.");
    }
    if (decision === "decline") {
      transaction.update(appointmentRef, {
        status: "confirmed",
        proposedSlotId: FieldValue.delete(),
        proposedStartsAt: FieldValue.delete(),
        proposedEndsAt: FieldValue.delete(),
        rescheduleRequestedAt: FieldValue.delete(),
        rescheduleDeclinedAt: now,
        updatedAt: now,
        version: FieldValue.increment(1),
      });
      return { appointmentId, status: "confirmed", decision: "declined" };
    }
    const oldSlotRef = db.collection("doctors").doc(appointment.doctorId).collection("slots").doc(appointment.slotId);
    const newSlotRef = db.collection("doctors").doc(appointment.doctorId).collection("slots").doc(appointment.proposedSlotId);
    const typeRef = db.collection("doctors").doc(appointment.doctorId).collection("appointmentTypes").doc(appointment.typeId);
    const availabilityRef = db.collection("calendarAvailability").doc(appointment.doctorId);
    const [oldSlotSnap, newSlotSnap, typeSnap, availabilitySnap] = await Promise.all([
      transaction.get(oldSlotRef), transaction.get(newSlotRef), transaction.get(typeRef), transaction.get(availabilityRef),
    ]);
    const newSlot = newSlotSnap.exists ? { id: newSlotSnap.id, ...newSlotSnap.data() } : null;
    const type = typeSnap.exists ? { id: typeSnap.id, ...typeSnap.data() } : null;
    const availability = availabilitySnap.exists ? availabilitySnap.data() : null;
    if (oldSlotSnap.data()?.appointmentId !== appointmentId || oldSlotSnap.data()?.status !== "reserved") {
      throw new functionsV1.https.HttpsError("failed-precondition", "Reserva original inconsistente.");
    }
    if (!calendarIsFresh(availability, now) || !slotIsEligible(newSlot, type, now) || !calendarSlotIsAvailable(availability, newSlot)) {
      throw new functionsV1.https.HttpsError("failed-precondition", "Novo horário não está mais disponível.");
    }
    const nextVersion = Number(appointment.version || 1) + 1;
    transaction.update(oldSlotRef, { status: "open", appointmentId: FieldValue.delete(), updatedAt: now, version: FieldValue.increment(1) });
    transaction.update(newSlotRef, { status: "reserved", appointmentId, updatedAt: now, version: FieldValue.increment(1) });
    transaction.update(appointmentRef, {
      status: "confirmed",
      requestedSlotId: appointment.proposedSlotId,
      slotId: appointment.proposedSlotId,
      startsAt: new Date(newSlot.startsAt),
      endsAt: new Date(newSlot.endsAt),
      proposedSlotId: FieldValue.delete(),
      proposedStartsAt: FieldValue.delete(),
      proposedEndsAt: FieldValue.delete(),
      rescheduleRequestedAt: FieldValue.delete(),
      rescheduledAt: now,
      updatedAt: now,
      version: nextVersion,
    });
    transaction.create(db.collection("calendarOutbox").doc(`${appointmentId}:rescheduled:${nextVersion}`), {
      id: `${appointmentId}:rescheduled:${nextVersion}`,
      action: "reschedule",
      medarioAppointmentId: appointmentId,
      appointmentVersion: nextVersion,
      doctorId: appointment.doctorId,
      startsAt: newSlot.startsAt,
      endsAt: newSlot.endsAt,
      state: "pending",
      attempts: 0,
      createdAt: now,
    });
    return { appointmentId, status: "confirmed", decision: "accepted" };
  });
});

/* ==================================================================
 * Medário Pro
 * ------------------------------------------------------------------
 * Profile changes are proposed for review. The public doctor document
 * stays unchanged until a backoffice user with medarioAdmin approves.
 * Lead aggregates intentionally exclude raw queries, health content and
 * exact visitor location.
 * ================================================================== */
exports.requestProfessionalProfileChange = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  let fields;
  try {
    fields = profileChangesFrom(data?.fields);
  } catch {
    throw new functionsV1.https.HttpsError("invalid-argument", "Alteração de perfil inválida.");
  }
  const requestRef = db.collection("profileChangeRequests").doc();
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const professional = await activeProfessionalAccount(transaction, context.auth.uid);
    transaction.create(requestRef, { doctorId: professional.doctorId, professionalUid: context.auth.uid, status: "pending", fields, requestedAt: now });
    return { requestId: requestRef.id, status: "pending" };
  });
});

exports.reviewProfessionalProfileChange = functionsV1.https.onCall(async (data, context) => {
  await activeAccount(context, "Faça login para revisar alterações.");
  if (context.auth?.token?.medarioAdmin !== true) throw new functionsV1.https.HttpsError("permission-denied", "Revisão não autorizada.");
  const requestId = requiredString(data?.requestId, "requestId");
  const decision = requiredString(data?.decision, "decision");
  if (decision !== "approve" && decision !== "reject") throw new functionsV1.https.HttpsError("invalid-argument", "Decisão inválida.");
  const requestRef = db.collection("profileChangeRequests").doc(requestId);
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Alteração não encontrada.");
    const request = requestSnap.data();
    if (request.status !== "pending") throw new functionsV1.https.HttpsError("failed-precondition", "Alteração já foi revisada.");
    const preferenceRef = db.collection("notificationPreferences").doc(request.professionalUid);
    const preferenceSnap = await transaction.get(preferenceRef);
    if (decision === "approve") {
      transaction.set(db.collection("doctors").doc(request.doctorId), { ...request.fields, updatedAt: now }, { merge: true });
      enqueueOptedInNotifications(transaction, preferenceSnap, { event: "profile_updated", recipientUid: request.professionalUid, subjectRef: requestId, now });
    }
    transaction.update(requestRef, { status: decision === "approve" ? "approved" : "rejected", reviewedAt: now, reviewerUid: context.auth.uid });
    transaction.create(requestRef.collection("audit").doc(), { at: now, decision, reviewerUid: context.auth.uid });
    return { requestId, status: decision === "approve" ? "approved" : "rejected" };
  });
});

exports.getProfessionalDashboard = functionsV1.https.onCall(async (_data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const professional = await db.runTransaction((transaction) => activeProfessionalAccount(transaction, context.auth.uid));
  const [doctorSnap, calendarSnap, metricsSnap, appointmentsSnap, changesSnap, typesSnap, slotsSnap] = await Promise.all([
    db.collection("doctors").doc(professional.doctorId).get(),
    db.collection("calendarConnections").doc(professional.doctorId).get(),
    db.collection("professionalLeadMetrics").doc(professional.doctorId).get(),
    db.collection("appointments").where("doctorId", "==", professional.doctorId).orderBy("requestedAt", "desc").limit(20).get(),
    db.collection("profileChangeRequests").where("doctorId", "==", professional.doctorId).where("status", "==", "pending").limit(20).get(),
    db.collection("doctors").doc(professional.doctorId).collection("appointmentTypes").get(),
    db.collection("doctors").doc(professional.doctorId).collection("slots").where("status", "==", "open").limit(50).get(),
  ]);
  const calendar = calendarSnap.exists ? calendarSnap.data() : {};
  let metrics;
  try { metrics = leadMetricsFrom(metricsSnap.exists ? metricsSnap.data() : {}); } catch { metrics = leadMetricsFrom({}); }
  return {
    doctorId: professional.doctorId,
    profile: doctorSnap.exists ? doctorSnap.data() : null,
    calendar: { status: calendar.status || "not_connected", integrationCalendarId: calendar.integrationCalendarId || null, connectedAt: calendar.connectedAt || null, revokedAt: calendar.revokedAt || null },
    leadMetrics: metrics,
    appointments: appointmentsSnap.docs.map((item) => ({
      id: item.id,
      status: item.data().status,
      typeLabel: item.data().typeLabel || null,
      modality: item.data().modality || null,
      startsAt: item.data().startsAt || null,
      endsAt: item.data().endsAt || null,
      proposedStartsAt: item.data().proposedStartsAt || null,
      proposedEndsAt: item.data().proposedEndsAt || null,
      requestedAt: item.data().requestedAt || null,
      confirmedAt: item.data().confirmedAt || null,
      patient: item.data().patientDeleted === true ? null : {
        name: item.data().patientName || "Paciente",
        email: item.data().patientEmail || null,
      },
    })),
    appointmentTypes: typesSnap.docs.map((item) => ({
      id: item.id,
      label: item.data().label,
      locationId: item.data().locationId,
      modality: item.data().modality || "in_person",
      confirmationPolicy: item.data().confirmationPolicy,
      cancellationPolicy: item.data().cancellationPolicy || null,
      cancellationNoticeMinutes: Number.isInteger(item.data().cancellationNoticeMinutes) ? item.data().cancellationNoticeMinutes : 0,
      priceCents: Number.isInteger(item.data().priceCents) ? item.data().priceCents : null,
      durationMinutes: item.data().durationMinutes,
      bufferMinutes: item.data().bufferMinutes,
      minimumLeadMinutes: item.data().minimumLeadMinutes,
      maximumWindowDays: item.data().maximumWindowDays,
      enabled: item.data().enabled !== false,
    })),
    openSlots: slotsSnap.docs.map((item) => ({ id: item.id, typeId: item.data().appointmentTypeId, startsAt: item.data().startsAt, endsAt: item.data().endsAt })),
    pendingChanges: changesSnap.docs.map((item) => ({ id: item.id, status: item.data().status, requestedAt: item.data().requestedAt, fields: item.data().fields })),
  };
});

exports.revokeProfessionalCalendarConnection = functionsV1.https.onCall(async (_data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const now = new Date();
  return db.runTransaction(async (transaction) => {
    const professional = await activeProfessionalAccount(transaction, context.auth.uid);
    const connectionRef = db.collection("calendarConnections").doc(professional.doctorId);
    transaction.set(connectionRef, { status: "revoked", revokedAt: now, updatedAt: now }, { merge: true });
    return { status: "revoked" };
  });
});

exports.syncProfessionalCalendarAvailability = functionsV1.runWith({ secrets: ["MEDARIO_CALENDAR_TOKEN_KEY", "MEDARIO_GOOGLE_OAUTH_CLIENT_ID", "MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET"] }).https.onCall(async (_data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login como médico.");
  const professional = await db.runTransaction((transaction) => activeProfessionalAccount(transaction, context.auth.uid));
  try {
    const availability = await refreshCalendarAvailability(professional.doctorId);
    return { status: "available", fetchedAt: availability.fetchedAt };
  } catch {
    throw new functionsV1.https.HttpsError("unavailable", "Não foi possível atualizar a agenda agora.");
  }
});

const calendarSecretOptions = { secrets: ["MEDARIO_CALENDAR_TOKEN_KEY", "MEDARIO_GOOGLE_OAUTH_CLIENT_ID", "MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET"] };

exports.deliverCalendarOutbox = functionsV1.runWith({ ...calendarSecretOptions, failurePolicy: true }).firestore.document("calendarOutbox/{outboxId}").onCreate(async (item) => {
  try {
    await deliverCalendarOutboxItem(item);
  } catch (error) {
    logger.error("calendar outbox delivery failed", { outboxId: item.id, code: error instanceof Error ? error.message : "unknown" });
    await item.ref.update({ state: "retry", attempts: FieldValue.increment(1), updatedAt: new Date() });
    throw error;
  }
});

exports.processCalendarOutbox = functionsV1.runWith({ secrets: ["MEDARIO_CALENDAR_TOKEN_KEY", "MEDARIO_GOOGLE_OAUTH_CLIENT_ID", "MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET"] }).https.onCall(async (_data, context) => {
  await activeAccount(context, "Faça login para processar a agenda.");
  if (context.auth?.token?.medarioAdmin !== true) throw new functionsV1.https.HttpsError("permission-denied", "Processamento não autorizado.");
  const pending = await db.collection("calendarOutbox").where("state", "in", ["pending", "retry"]).limit(25).get();
  let delivered = 0;
  for (const item of pending.docs) {
    try {
      await deliverCalendarOutboxItem(item); delivered += 1;
    } catch (error) {
      logger.error("calendar outbox delivery failed", { outboxId: item.id, code: error instanceof Error ? error.message : "unknown" });
      await item.ref.update({ state: "retry", attempts: FieldValue.increment(1), updatedAt: new Date() });
    }
  }
  return { processed: pending.size, delivered };
});

const getNotificationPreferencesHandler = async (_data, context) => {
  const uid = await activeAccount(context, "Faça login para ver preferências.");
  const snap = await db.collection("notificationPreferences").doc(uid).get();
  try { return snap.exists ? preferencesFromDocument(snap.data()) : defaultPreferences(); } catch { return defaultPreferences(); }
};
exports.getNotificationPreferences = functionsV1.https.onCall(getNotificationPreferencesHandler);
exports.getNativeNotificationPreferences = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(getNotificationPreferencesHandler);

const updateNotificationPreferencesHandler = async (data, context, requireExpectedUid = false) => {
  const uid = await activeAccount(context, "Faça login para alterar preferências.");
  if (requireExpectedUid) assertExpectedAccount(data, uid);
  let preferences;
  try { preferences = preferencesFrom(data?.preferences); } catch { throw new functionsV1.https.HttpsError("invalid-argument", "Preferências de notificação inválidas."); }
  await db.collection("notificationPreferences").doc(uid).set({ ...preferences, updatedAt: new Date(), version: 1 });
  return preferences;
};
exports.updateNotificationPreferences = functionsV1.https.onCall(updateNotificationPreferencesHandler);
exports.updateNativeNotificationPreferences = functionsV1.runWith({ enforceAppCheck: true }).https.onCall((data, context) => updateNotificationPreferencesHandler(data, context, true));

exports.registerNativePushEndpoint = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para ativar notificações.");
  assertExpectedAccount(data, uid);
  if (typeof data?.token !== "string") throw new functionsV1.https.HttpsError("invalid-argument", "Token de notificação inválido.");
  const token = data.token.trim();
  if (token.length < 20 || token.length > 4096) throw new functionsV1.https.HttpsError("invalid-argument", "Token de notificação inválido.");
  const installationId = requiredString(data?.installationId, "installationId");
  const tokenHash = digest(token);
  const endpointRef = db.collection("notificationEndpoints").doc(uid);
  const matching = await db.collection("notificationEndpoints").where("tokenHash", "==", tokenHash).limit(10).get();
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    matching.docs.filter((item) => item.id !== uid).forEach((item) => transaction.delete(item.ref));
    transaction.set(endpointRef, {
      recipientUid: uid,
      platform: "ios",
      token,
      tokenHash,
      installationId,
      state: "active",
      updatedAt: now,
      version: 1,
    });
  });
  return { state: "active" };
});

exports.unregisterNativePushEndpoint = functionsV1.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para desativar notificações.");
  assertExpectedAccount(data, uid);
  await db.collection("notificationEndpoints").doc(uid).delete();
  return { state: "removed" };
});

exports.revokeNotificationChannel = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para revogar um canal.");
  const channel = requiredString(data?.channel, "channel");
  if (!["email", "whatsapp", "push"].includes(channel)) throw new functionsV1.https.HttpsError("invalid-argument", "Canal inválido.");
  const ref = db.collection("notificationPreferences").doc(uid);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    let preferences;
    try { preferences = snap.exists ? preferencesFromDocument(snap.data()) : defaultPreferences(); } catch { preferences = defaultPreferences(); }
    for (const event of Object.keys(preferences)) preferences[event][channel] = false;
    transaction.set(ref, { ...preferences, updatedAt: new Date(), version: 1 });
    return preferences;
  });
});

async function deliverNotificationOutboxItem(item) {
  const record = item.data();
  const preferenceRef = db.collection("notificationPreferences").doc(record.recipientUid);
  const endpointRef = db.collection("notificationEndpoints").doc(record.recipientUid);
  const claim = await db.runTransaction(async (transaction) => {
    const [current, preferenceSnap, endpointSnap] = await Promise.all([
      transaction.get(item.ref), transaction.get(preferenceRef), transaction.get(endpointRef),
    ]);
    if (!current.exists || !["pending", "retry"].includes(current.data().state)) return null;
    let preferences;
    try { preferences = preferenceSnap.exists ? preferencesFromDocument(preferenceSnap.data()) : defaultPreferences(); } catch { preferences = defaultPreferences(); }
    if (record.channel !== "push") {
      transaction.update(item.ref, { state: providerlessDeliveryState(preferences, record.event, record.channel), attempts: FieldValue.increment(1), updatedAt: new Date() });
      return null;
    }
    if (preferences[record.event]?.push !== true) {
      transaction.update(item.ref, { state: "suppressed_revoked", attempts: FieldValue.increment(1), updatedAt: new Date() });
      return null;
    }
    const endpoint = endpointSnap.exists ? endpointSnap.data() : null;
    if (!endpoint || endpoint.state !== "active" || endpoint.platform !== "ios" || typeof endpoint.token !== "string") {
      transaction.update(item.ref, { state: "blocked_endpoint_unavailable", attempts: FieldValue.increment(1), updatedAt: new Date() });
      return null;
    }
    transaction.update(item.ref, { state: "delivering", attempts: FieldValue.increment(1), updatedAt: new Date() });
    return { token: endpoint.token, tokenHash: endpoint.tokenHash, message: safePushMessage(record.event) };
  });
  if (!claim) return false;
  try {
    const messageId = await admin.messaging().send({
      token: claim.token,
      notification: { title: claim.message.title, body: claim.message.body },
      data: { event: record.event, destination: claim.message.destination },
      apns: { payload: { aps: { sound: "default" } } },
    });
    await item.ref.update({ state: "delivered", providerMessageId: messageId, deliveredAt: new Date(), updatedAt: new Date() });
    return true;
  } catch (error) {
    const code = typeof error?.code === "string" ? error.code : "messaging/unknown-error";
    const invalid = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(code);
    await db.runTransaction(async (transaction) => {
      const endpointSnap = await transaction.get(endpointRef);
      if (invalid && endpointSnap.exists && endpointSnap.data().tokenHash === claim.tokenHash) transaction.delete(endpointRef);
      transaction.update(item.ref, { state: invalid ? "failed_invalid_endpoint" : "retry", failureCode: code, updatedAt: new Date() });
    });
    if (!invalid) throw error;
    return false;
  }
}

exports.deliverNotificationOutbox = functionsV1.runWith({ failurePolicy: true }).firestore.document("notificationOutbox/{outboxId}").onCreate(async (item) => {
  await deliverNotificationOutboxItem(item);
});

exports.processNotificationOutbox = functionsV1.https.onCall(async (_data, context) => {
  await activeAccount(context, "Faça login para processar notificações.");
  if (context.auth?.token?.medarioAdmin !== true) throw new functionsV1.https.HttpsError("permission-denied", "Processamento não autorizado.");
  const pending = await db.collection("notificationOutbox").where("state", "in", ["pending", "retry"]).limit(50).get();
  let delivered = 0;
  for (const item of pending.docs) if (await deliverNotificationOutboxItem(item)) delivered += 1;
  return { processed: pending.size, delivered, pushProviderConfigured: true };
});

/* ==================================================================
 * Authenticated saved items
 * ------------------------------------------------------------------
 * Visitors remain local-only. Sync is an explicit authenticated action
 * and stores only objective criteria, never raw search or health text.
 * ================================================================== */
exports.listSavedItems = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para sincronizar itens.");
  assertExpectedAccount(data, uid);
  const base = db.collection("users").doc(uid);
  const [favorites, searches] = await Promise.all([base.collection("favorites").orderBy("createdAt", "desc").limit(100).get(), base.collection("savedSearches").orderBy("updatedAt", "desc").limit(50).get()]);
  return {
    favorites: favorites.docs.map((item) => ({ doctorId: item.id, createdAt: item.data().createdAt || null })),
    searches: searches.docs.flatMap((item) => {
      try {
        return [{ id: item.id, criteria: savedSearchCriteriaFrom(item.data().criteria), alertEnabled: item.data().alertEnabled === true, createdAt: item.data().createdAt || null, updatedAt: item.data().updatedAt || null }];
      } catch {
        return [];
      }
    }),
  };
});

exports.favoriteDoctor = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para sincronizar itens.");
  assertExpectedAccount(data, uid);
  const doctorId = requiredString(data?.doctorId, "doctorId");
  const doctorRef = db.collection("publicDoctors").doc(doctorId);
  const favoriteRef = db.collection("users").doc(uid).collection("favorites").doc(doctorId);
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    const favorites = db.collection("users").doc(uid).collection("favorites");
    const [doctorSnap, existingFavorite, existingFavorites] = await Promise.all([
      transaction.get(doctorRef),
      transaction.get(favoriteRef),
      transaction.get(favorites.limit(101)),
    ]);
    if (!doctorSnap.exists || doctorSnap.data()?.published !== true || doctorSnap.data()?.publicReadSafe !== true) throw new functionsV1.https.HttpsError("not-found", "Perfil médico não encontrado.");
    if (!existingFavorite.exists && existingFavorites.size >= 100) throw new functionsV1.https.HttpsError("resource-exhausted", "Limite de favoritos atingido.");
    transaction.set(favoriteRef, { doctorId, createdAt: now, updatedAt: now, version: 1 }, { merge: true });
  });
  return { doctorId, favorited: true };
});

exports.unfavoriteDoctor = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para sincronizar itens.");
  assertExpectedAccount(data, uid);
  const doctorId = requiredString(data?.doctorId, "doctorId");
  await db.collection("users").doc(uid).collection("favorites").doc(doctorId).delete();
  return { doctorId, favorited: false };
});

exports.saveAccountSearch = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para sincronizar itens.");
  assertExpectedAccount(data, uid);
  let criteria;
  try { criteria = savedSearchCriteriaFrom(data?.criteria); } catch { throw new functionsV1.https.HttpsError("invalid-argument", "Critérios de busca salva inválidos."); }
  const alertEnabled = data?.alertEnabled === true;
  const searches = db.collection("users").doc(uid).collection("savedSearches");
  const now = new Date();
  const searchRef = searches.doc();
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(searches.limit(51));
    if (existing.size >= 50) throw new functionsV1.https.HttpsError("resource-exhausted", "Limite de buscas salvas atingido.");
    transaction.create(searchRef, savedSearchRecord({ id: searchRef.id, criteria, alertEnabled, now }));
  });
  return { id: searchRef.id, criteria, alertEnabled };
});

exports.removeAccountSearch = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para sincronizar itens.");
  assertExpectedAccount(data, uid);
  const searchId = requiredString(data?.searchId, "searchId");
  await db.collection("users").doc(uid).collection("savedSearches").doc(searchId).delete();
  return { searchId, removed: true };
});

exports.setSavedSearchAlert = functionsV1.https.onCall(async (data, context) => {
  const uid = await activeAccount(context, "Faça login para sincronizar itens.");
  assertExpectedAccount(data, uid);
  const searchId = requiredString(data?.searchId, "searchId");
  if (typeof data?.alertEnabled !== "boolean") throw new functionsV1.https.HttpsError("invalid-argument", "Preferência de alerta inválida.");
  const ref = db.collection("users").doc(uid).collection("savedSearches").doc(searchId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new functionsV1.https.HttpsError("not-found", "Busca salva não encontrada.");
    transaction.update(ref, { alertEnabled: data.alertEnabled, updatedAt: new Date(), version: FieldValue.increment(1) });
  });
  return { searchId, alertEnabled: data.alertEnabled };
});

/* ------------------------------------------------------------------
 * Specialty extraction
 * ------------------------------------------------------------------
 * Tries to match a known specialty from the free-text search query.
 * Returns the lowercase specialty slug or null if no match is found.
 * In production this could be replaced by a more sophisticated NLP
 * lookup or a Firestore `specialties` table scan.
 */
const SPECIALTY_KEYWORDS = [
  "cardiolog", "dermatolog", "ginecolog", "neurolog", "ortoped",
  "pediatr", "psiquiatr", "endocrinolog", "gastroenterolog",
  "oftalmolog", "otorrinolaringolog", "urolog", "reumatolog",
  "oncolog", "radiolog", "anestesiol", "clinica geral", "clinico geral",
  "geral", "infectolog", "alergolog", "nutrolog", "fisiatr", "fisioterap",
  "acupuntura", "homeopat", "medicina do trabalho", "medicina esportiva",
  "geriatria", "nefrolog", "pneumolog", "hematolog"
];

function extractSpecialty(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  // Sort keywords by length descending so longest match wins
  const sorted = [...SPECIALTY_KEYWORDS].sort((a, b) => b.length - a.length);
  for (const keyword of sorted) {
    // Use word boundary to avoid 'urolog' matching inside 'neurolog'
    const re = new RegExp("\\b" + keyword, "i");
    if (re.test(q)) {
      return keyword.replace(/\s+/g, "_");
    }
  }
  return null;
}

/* ==================================================================
 * 1. onSearchEvent
 * ==================================================================
 * Triggered when a new document is created in
 *   users/{uid}/search_events/{eventId}
 *
 * Steps:
 *   a. Read the search_event doc → extract specialty from query.
 *   b. If a specialty is found, increment the interest counter in
 *      users/{uid}/interests/{specialty} and update last_searched.
 *   c. Delete the search_event doc (data minimisation — no raw
 *      search history is retained, per LGPD Art. 15 / Art. 16).
 * ================================================================== */
exports.onSearchEvent = functionsV1.firestore
  .document("users/{uid}/search_events/{eventId}")
  .onCreate(async (snap, context) => {
    const { uid } = context.params;

    if (!snap) {
      logger.warn("onSearchEvent: event data unavailable.");
      return;
    }

    const { query, timestamp } = snap.data();
    const specialty = extractSpecialty(query);
    const userRef = db.collection("users").doc(uid);
    const result = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists || userSnap.data()?.consent_preferences !== true) {
        transaction.delete(snap.ref);
        return "discarded";
      }
      if (specialty) {
        transaction.set(userRef.collection("interests").doc(specialty), {
          specialty,
          count: FieldValue.increment(1),
          last_searched: timestamp || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      // Consent and derived write share one transaction, closing revocation races.
      transaction.delete(snap.ref);
      return specialty ? "incremented" : "unmatched";
    });

    if (result === "discarded") logger.info("onSearchEvent: discarded event without health consent.");
    else if (result === "incremented") logger.info("onSearchEvent: updated consented derived interest.");
    else logger.info(unmatchedSearchLogMessage());
    logger.info("onSearchEvent: deleted raw search event.");
  });

exports.onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  const userRef = db.collection("users").doc(user.uid);
  const tombstoneRef = db.collection("deletedUsers").doc(user.uid);
  const blocked = await db.runTransaction(async (transaction) => {
    const [snapshot, tombstone] = await Promise.all([transaction.get(userRef), transaction.get(tombstoneRef)]);
    if (tombstone.exists && tombstoneIsActive(tombstone.data())) return true;
    const patch = missingUserProfileFields(snapshot.exists ? snapshot.data() : null, user, new Date());
    if (Object.keys(patch).length) transaction.set(userRef, patch, { merge: true });
    return false;
  });
  if (blocked) {
    await admin.auth().revokeRefreshTokens(user.uid);
    await admin.auth().deleteUser(user.uid);
    logger.info("onUserCreate: rejected recreation during deletion window.");
  }
});

exports.revokeHealthConsent = functionsV1.https.onCall(async (_data, context) => {
  const uid = await activeAccount(context, "Faça login para revogar o consentimento.");
  const userRef = db.collection("users").doc(uid);

  await executeHealthConsentRevocation({
    // Persist revocation before touching derived health data. New events are rejected immediately.
    disableConsent: () => userRef.set({ consent_preferences: false, consent_at: new Date() }, { merge: true }),
    deleteHealthData: () => Promise.all([
      db.recursiveDelete(userRef.collection("search_events")),
      db.recursiveDelete(userRef.collection("interests")),
    ]),
    clearAffinity: () => userRef.set({
      affinity: FieldValue.delete(),
      affinityUpdatedAt: FieldValue.delete(),
      updated_at: new Date(),
    }, { merge: true }),
  });
  return { consentPreferences: false };
});

exports.deleteMyAccount = functionsV1.https.onCall(async (_data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para excluir sua conta.");
  if (!authTimeIsRecent(context.auth.token?.auth_time, Math.floor(Date.now() / 1000))) {
    throw new functionsV1.https.HttpsError("failed-precondition", "Entre novamente antes de excluir sua conta.");
  }

  // Auth is deliberately last: a retry remains authorized while any cleanup step fails.
  await executeAccountDeletion(uid, {
    ensureTombstone: ensureDeletionTombstone,
    revokeRefreshTokens: (userId) => admin.auth().revokeRefreshTokens(userId),
    cleanupUserData,
    deleteAuthUser: (userId) => admin.auth().deleteUser(userId),
  });
  return { deleted: true };
});

/* ==================================================================
 * 2. computeAffinity
 * ==================================================================
 * Triggered when any interest document is written (created/updated/
 * deleted) in
 *   users/{uid}/interests/{interestId}
 *
 * Recomputes the user's affinity profile:
 *   - Reads ALL interest docs for the user.
 *   - Normalises counts to 0–1 scores (top specialty = 1.0, others
 *     proportional).
 *   - Writes the resulting map to users/{uid}.affinity.
 * ================================================================== */
exports.computeAffinity = functionsV1.firestore
  .document("users/{uid}/interests/{interestId}")
  .onWrite(async (_change, context) => {
    const { uid } = context.params;
    const userRef = db.collection("users").doc(uid);
    const result = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) return { kind: "skip" };
      const interestsSnap = await transaction.get(userRef.collection("interests"));
      const decision = affinityDecision(
        userSnap.data(),
        interestsSnap.docs.map((document) => ({ id: document.id, ...document.data() }))
      );
      if (decision.kind === "clear") {
        transaction.update(userRef, {
          affinity: FieldValue.delete(),
          affinityUpdatedAt: FieldValue.delete(),
        });
      } else if (decision.kind === "update") {
        transaction.update(userRef, {
          affinity: decision.affinity,
          affinityUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
      return decision;
    });

    if (result.kind === "skip") logger.info("computeAffinity: deleted account skipped.");
    else if (result.kind === "clear") logger.info("computeAffinity: consent absent or no interests; cleared affinity.");
    else logger.info("computeAffinity: updated consented affinity.");
  });

/* ==================================================================
 * 3. onUserDelete
 * ==================================================================
 * Triggered when a user account is deleted from Firebase Auth.
 *
 * Full data cleanup (LGPD Art. 18 — right to erasure):
 *   a. Delete all docs in users/{uid}/interests
 *   b. Delete all docs in users/{uid}/search_events
 *   c. Delete saved items: users/{uid}/favorites + savedSearches
 *   d. Delete the user document itself: users/{uid}
 * ================================================================== */
exports.onUserDelete = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;

  if (!uid) {
    logger.warn("onUserDelete: no uid in event, skipping.");
    return;
  }

  await ensureDeletionTombstone(uid);
  await cleanupUserData(uid);

  logger.info("onUserDelete: full cleanup complete.");
});

exports.finalizeDeletedUsers = functionsV1.pubsub.schedule("every 15 minutes").onRun(async () => {
  const now = Timestamp.now();
  const due = await db.collection("deletedUsers").where("finalizeAfter", "<=", now).limit(100).get();
  const result = await executeDeletionFinalizationBatch(due.docs, async (tombstone) => {
    await executeDeletionFinalizer(tombstone.id, {
      cleanupUserData,
      deleteTombstone: (uid) => db.collection("deletedUsers").doc(uid).delete(),
    });
  });
  const [expiredIdempotency, expiredRateLimits] = await Promise.all([
    deleteQueryDocuments(db.collection("appointmentIdempotency").where("expiresAt", "<=", now)),
    deleteQueryDocuments(db.collection("appointmentRateLimits").where("expiresAt", "<=", now)),
  ]);
  logger.info("finalizeDeletedUsers: completed deletion finalization.", {
    ...result,
    expiredIdempotency: expiredIdempotency.length,
    expiredRateLimits: expiredRateLimits.length,
  });
  return null;
});
