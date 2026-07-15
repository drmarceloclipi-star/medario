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
const crypto = require("node:crypto");
const { calendarIsFresh, canTransitionAppointment, createReservationDecision, slotIsEligible } = require("./appointment-policy");
const { busyIntervalsFrom, calendarEventId, calendarSlotIsAvailable } = require("./calendar-policy");
const { defaultPreferences, enabledChannels, notificationOutboxRecord, preferencesFrom, providerlessDeliveryState } = require("./notification-policy");
const { leadMetricsFrom, profileChangesFrom } = require("./professional-policy");
const { savedSearchCriteriaFrom, savedSearchRecord } = require("./saved-items-policy");
const { userSubcollectionsForDeletion } = require("./user-cleanup-policy");
const { unmatchedSearchLogMessage } = require("./privacy");

admin.initializeApp();
const db = admin.firestore();

function requiredString(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new functionsV1.https.HttpsError("invalid-argument", `${name} is required.`);
  }
  return value.trim();
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decryptCalendarToken(record) {
  const key = Buffer.from(process.env.MEDARIO_CALENDAR_TOKEN_KEY || "", "base64");
  if (key.length !== 32 || !record?.ciphertext || !record?.iv || !record?.tag) throw new Error("calendar token unavailable");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

async function googleAccessToken(connection) {
  const refreshToken = decryptCalendarToken(connection.refreshToken);
  const body = new URLSearchParams({ client_id: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_ID || "", client_secret: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET || "", refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
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
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
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
  const startsAt = new Date(task.startsAt); const endsAt = new Date(task.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) throw new Error("calendar event time invalid");
  const event = { summary: `Medário ${task.medarioAppointmentId}`, start: { dateTime: startsAt.toISOString() }, end: { dateTime: endsAt.toISOString() }, extendedProperties: { private: { medarioAppointmentId: task.medarioAppointmentId } } };
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, { method: "PUT", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: JSON.stringify(event) });
  if (!response.ok) throw new Error(`calendar event ${response.status}`);
  await item.ref.update({ state: "delivered", eventId, deliveredAt: new Date(), attempts: admin.firestore.FieldValue.increment(1) });
}

function decisionError(decision) {
  const messages = {
    idempotency_conflict: "A mesma chave não pode representar outra solicitação.",
    calendar_stale: "Disponibilidade da agenda precisa ser confirmada.",
    slot_unavailable: "Este horário não está mais disponível.",
  };
  return new functionsV1.https.HttpsError("failed-precondition", messages[decision.code] || "Solicitação não pode ser concluída.");
}

async function activeProfessionalAccount(transaction, uid) {
  const accountRef = db.collection("professionalAccounts").doc(uid);
  const accountSnap = await transaction.get(accountRef);
  if (!accountSnap.exists || accountSnap.data().status !== "active" || typeof accountSnap.data().doctorId !== "string") {
    throw new functionsV1.https.HttpsError("permission-denied", "Conta profissional não autorizada.");
  }
  return accountSnap.data();
}

function enqueueOptedInNotifications(transaction, preferenceSnap, { event, recipientUid, subjectRef, now }) {
  let preferences;
  try { preferences = preferenceSnap?.exists ? preferencesFrom(preferenceSnap.data()) : defaultPreferences(); } catch { preferences = defaultPreferences(); }
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
exports.createAppointmentRequest = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para solicitar uma consulta.");

  const doctorId = requiredString(data?.doctorId, "doctorId");
  const typeId = requiredString(data?.typeId, "typeId");
  const idempotencyKey = requiredString(data?.idempotencyKey, "idempotencyKey");
  const slotId = data?.slotId ? requiredString(data.slotId, "slotId") : null;
  const patientUid = context.auth.uid;
  const now = new Date();
  const appointmentRef = db.collection("appointments").doc();
  const typeRef = db.collection("doctors").doc(doctorId).collection("appointmentTypes").doc(typeId);
  const slotRef = slotId ? db.collection("doctors").doc(doctorId).collection("slots").doc(slotId) : null;
  const availabilityRef = db.collection("calendarAvailability").doc(doctorId);
  const preferenceRef = db.collection("notificationPreferences").doc(patientUid);
  const idempotencyRef = db.collection("appointmentIdempotency").doc(`${patientUid}_${digest(idempotencyKey)}`);

  return db.runTransaction(async (transaction) => {
    const [idempotencySnap, typeSnap, slotSnap, availabilitySnap, preferenceSnap] = await Promise.all([
      transaction.get(idempotencyRef),
      transaction.get(typeRef),
      slotRef ? transaction.get(slotRef) : Promise.resolve(null),
      transaction.get(availabilityRef),
      transaction.get(preferenceRef),
    ]);
    if (!typeSnap.exists) throw new functionsV1.https.HttpsError("not-found", "Tipo de consulta não encontrado.");

    const appointmentType = { id: typeSnap.id, ...typeSnap.data() };
    const slot = slotSnap?.exists ? { id: slotSnap.id, ...slotSnap.data() } : null;
    const requestFingerprint = digest(JSON.stringify({ doctorId, typeId, slotId, patientUid, confirmationPolicy: appointmentType.confirmationPolicy }));
    const decision = createReservationDecision({
      requestFingerprint,
      appointmentId: appointmentRef.id,
      existingIdempotency: idempotencySnap.exists ? idempotencySnap.data() : null,
      slot,
      appointmentType,
      calendarSnapshot: availabilitySnap.exists ? availabilitySnap.data() : null,
      now,
    });
    if (decision.kind === "replay") return { appointmentId: decision.appointmentId, status: decision.status, replayed: true };
    if (decision.kind === "reject") throw decisionError(decision);

    const appointment = {
      doctorId,
      typeId,
      patientUid,
      requestedSlotId: slotId,
      status: decision.appointment.status,
      confirmationPolicy: appointmentType.confirmationPolicy,
      requestedAt: now,
      ...(decision.appointment.status === "confirmed" ? { confirmedAt: now, slotId } : {}),
      version: 1,
    };
    transaction.create(appointmentRef, appointment);
    if (decision.slotPatch && slotRef) transaction.update(slotRef, { status: decision.slotPatch.status, appointmentId: appointmentRef.id, updatedAt: now, version: admin.firestore.FieldValue.increment(1) });
    if (decision.integrationOutbox) transaction.create(db.collection("calendarOutbox").doc(decision.integrationOutbox.id), { ...decision.integrationOutbox, doctorId, state: "pending", attempts: 0, createdAt: now });
    if (appointment.status === "confirmed") enqueueOptedInNotifications(transaction, preferenceSnap, { event: "appointment_confirmed", recipientUid: patientUid, subjectRef: appointmentRef.id, now });
    transaction.create(idempotencyRef, { requestFingerprint, appointmentId: appointmentRef.id, status: appointment.status, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) });
    return { appointmentId: appointmentRef.id, status: appointment.status, replayed: false };
  });
});

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
      transaction.update(appointmentRef, { status: "declined", decidedAt: now, version: admin.firestore.FieldValue.increment(1) });
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
    transaction.update(slotRef, { status: "reserved", appointmentId, updatedAt: now, version: admin.firestore.FieldValue.increment(1) });
    transaction.update(appointmentRef, { status: "confirmed", slotId: slotRef.id, confirmedAt: now, decidedAt: now, version: admin.firestore.FieldValue.increment(1) });
    transaction.create(db.collection("calendarOutbox").doc(`${appointmentId}:confirmed`), { id: `${appointmentId}:confirmed`, medarioAppointmentId: appointmentId, doctorId: appointment.doctorId, startsAt: slot.startsAt, endsAt: slot.endsAt, state: "pending", attempts: 0, createdAt: now });
    enqueueOptedInNotifications(transaction, preferenceSnap, { event: "appointment_confirmed", recipientUid: appointment.patientUid, subjectRef: appointmentId, now });
    return { appointmentId, status: "confirmed", replayed: false };
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
  const [doctorSnap, calendarSnap, metricsSnap, appointmentsSnap, changesSnap] = await Promise.all([
    db.collection("doctors").doc(professional.doctorId).get(),
    db.collection("calendarConnections").doc(professional.doctorId).get(),
    db.collection("professionalLeadMetrics").doc(professional.doctorId).get(),
    db.collection("appointments").where("doctorId", "==", professional.doctorId).limit(20).get(),
    db.collection("profileChangeRequests").where("doctorId", "==", professional.doctorId).where("status", "==", "pending").limit(20).get(),
  ]);
  const calendar = calendarSnap.exists ? calendarSnap.data() : {};
  let metrics;
  try { metrics = leadMetricsFrom(metricsSnap.exists ? metricsSnap.data() : {}); } catch { metrics = leadMetricsFrom({}); }
  return {
    doctorId: professional.doctorId,
    profile: doctorSnap.exists ? doctorSnap.data() : null,
    calendar: { status: calendar.status || "not_connected", integrationCalendarId: calendar.integrationCalendarId || null, connectedAt: calendar.connectedAt || null, revokedAt: calendar.revokedAt || null },
    leadMetrics: metrics,
    appointments: appointmentsSnap.docs.map((item) => ({ id: item.id, status: item.data().status, requestedAt: item.data().requestedAt || null, confirmedAt: item.data().confirmedAt || null })),
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
    await item.ref.update({ state: "retry", attempts: admin.firestore.FieldValue.increment(1), updatedAt: new Date() });
    throw error;
  }
});

exports.processCalendarOutbox = functionsV1.runWith({ secrets: ["MEDARIO_CALENDAR_TOKEN_KEY", "MEDARIO_GOOGLE_OAUTH_CLIENT_ID", "MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET"] }).https.onCall(async (_data, context) => {
  if (context.auth?.token?.medarioAdmin !== true) throw new functionsV1.https.HttpsError("permission-denied", "Processamento não autorizado.");
  const pending = await db.collection("calendarOutbox").where("state", "in", ["pending", "retry"]).limit(25).get();
  let delivered = 0;
  for (const item of pending.docs) {
    try {
      await deliverCalendarOutboxItem(item); delivered += 1;
    } catch (error) {
      logger.error("calendar outbox delivery failed", { outboxId: item.id, code: error instanceof Error ? error.message : "unknown" });
      await item.ref.update({ state: "retry", attempts: admin.firestore.FieldValue.increment(1), updatedAt: new Date() });
    }
  }
  return { processed: pending.size, delivered };
});

exports.getNotificationPreferences = functionsV1.https.onCall(async (_data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para ver preferências.");
  const snap = await db.collection("notificationPreferences").doc(context.auth.uid).get();
  try { return preferencesFrom(snap.exists ? snap.data() : {}); } catch { return defaultPreferences(); }
});

exports.updateNotificationPreferences = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para alterar preferências.");
  let preferences;
  try { preferences = preferencesFrom(data?.preferences); } catch { throw new functionsV1.https.HttpsError("invalid-argument", "Preferências de notificação inválidas."); }
  await db.collection("notificationPreferences").doc(context.auth.uid).set({ ...preferences, updatedAt: new Date(), version: 1 });
  return preferences;
});

exports.revokeNotificationChannel = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para revogar um canal.");
  const channel = requiredString(data?.channel, "channel");
  if (!["email", "whatsapp", "push"].includes(channel)) throw new functionsV1.https.HttpsError("invalid-argument", "Canal inválido.");
  const ref = db.collection("notificationPreferences").doc(context.auth.uid);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    let preferences;
    try { preferences = preferencesFrom(snap.exists ? snap.data() : {}); } catch { preferences = defaultPreferences(); }
    for (const event of Object.keys(preferences)) preferences[event][channel] = false;
    transaction.set(ref, { ...preferences, updatedAt: new Date(), version: 1 });
    return preferences;
  });
});

exports.processNotificationOutbox = functionsV1.https.onCall(async (_data, context) => {
  if (context.auth?.token?.medarioAdmin !== true) throw new functionsV1.https.HttpsError("permission-denied", "Processamento não autorizado.");
  const pending = await db.collection("notificationOutbox").where("state", "==", "pending").limit(50).get();
  const preferenceRefs = [...new Map(pending.docs.map((item) => [item.data().recipientUid, db.collection("notificationPreferences").doc(item.data().recipientUid)])).values()];
  const preferenceSnaps = preferenceRefs.length ? await db.getAll(...preferenceRefs) : [];
  const preferencesByUid = new Map(preferenceSnaps.map((snap) => [snap.id, snap]));
  const batch = db.batch();
  const now = new Date();
  pending.docs.forEach((item) => {
    const record = item.data();
    const preferenceSnap = preferencesByUid.get(record.recipientUid);
    let preferences;
    try { preferences = preferenceSnap?.exists ? preferencesFrom(preferenceSnap.data()) : defaultPreferences(); } catch { preferences = defaultPreferences(); }
    const state = providerlessDeliveryState(preferences, record.event, record.channel);
    batch.update(item.ref, { state, attempts: admin.firestore.FieldValue.increment(1), updatedAt: now });
  });
  await batch.commit();
  return { processed: pending.size, providerConfigured: false };
});

/* ==================================================================
 * Authenticated saved items
 * ------------------------------------------------------------------
 * Visitors remain local-only. Sync is an explicit authenticated action
 * and stores only objective criteria, never raw search or health text.
 * ================================================================== */
exports.listSavedItems = functionsV1.https.onCall(async (_data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para sincronizar itens.");
  const base = db.collection("users").doc(context.auth.uid);
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
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para sincronizar itens.");
  const doctorId = requiredString(data?.doctorId, "doctorId");
  const doctorRef = db.collection("publicDoctors").doc(doctorId);
  const favoriteRef = db.collection("users").doc(context.auth.uid).collection("favorites").doc(doctorId);
  const now = new Date();
  await db.runTransaction(async (transaction) => {
    const doctorSnap = await transaction.get(doctorRef);
    if (!doctorSnap.exists || doctorSnap.data()?.published !== true) throw new functionsV1.https.HttpsError("not-found", "Perfil médico não encontrado.");
    transaction.set(favoriteRef, { doctorId, createdAt: now, updatedAt: now, version: 1 }, { merge: true });
  });
  return { doctorId, favorited: true };
});

exports.unfavoriteDoctor = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para sincronizar itens.");
  const doctorId = requiredString(data?.doctorId, "doctorId");
  await db.collection("users").doc(context.auth.uid).collection("favorites").doc(doctorId).delete();
  return { doctorId, favorited: false };
});

exports.saveAccountSearch = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para sincronizar itens.");
  let criteria;
  try { criteria = savedSearchCriteriaFrom(data?.criteria); } catch { throw new functionsV1.https.HttpsError("invalid-argument", "Critérios de busca salva inválidos."); }
  const alertEnabled = data?.alertEnabled === true;
  const searches = db.collection("users").doc(context.auth.uid).collection("savedSearches");
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
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para sincronizar itens.");
  const searchId = requiredString(data?.searchId, "searchId");
  await db.collection("users").doc(context.auth.uid).collection("savedSearches").doc(searchId).delete();
  return { searchId, removed: true };
});

exports.setSavedSearchAlert = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functionsV1.https.HttpsError("unauthenticated", "Faça login para sincronizar itens.");
  const searchId = requiredString(data?.searchId, "searchId");
  if (typeof data?.alertEnabled !== "boolean") throw new functionsV1.https.HttpsError("invalid-argument", "Preferência de alerta inválida.");
  const ref = db.collection("users").doc(context.auth.uid).collection("savedSearches").doc(searchId);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) throw new functionsV1.https.HttpsError("not-found", "Busca salva não encontrada.");
    transaction.update(ref, { alertEnabled: data.alertEnabled, updatedAt: new Date(), version: admin.firestore.FieldValue.increment(1) });
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
    const { uid, eventId } = context.params;

    if (!snap) {
      logger.warn(`onSearchEvent: no data for event ${eventId}`);
      return;
    }

    const { query, timestamp } = snap.data();
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.data()?.consent_preferences !== true) {
      await snap.ref.delete();
      logger.info(`onSearchEvent: discarded event ${eventId} without health consent for user ${uid}`);
      return;
    }
    const specialty = extractSpecialty(query);

    if (specialty) {
      const interestRef = db
        .collection("users")
        .doc(uid)
        .collection("interests")
        .doc(specialty);

      // Atomically increment count and stamp last_searched.
      await interestRef.set(
        {
          specialty,
          count: admin.firestore.FieldValue.increment(1),
          last_searched: timestamp || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info(`onSearchEvent: interest "${specialty}" incremented for user ${uid}`);
    } else {
      logger.info(unmatchedSearchLogMessage());
    }

    // Always delete the raw search event (minimisation).
    await snap.ref.delete();
    logger.info(`onSearchEvent: deleted search_event ${eventId} for user ${uid}`);
  });

exports.onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
  await db.collection("users").doc(user.uid).set({
    email: user.email || null,
    cidade: null,
    convenio: null,
    tipo_atendimento: null,
    idioma: "Português",
    acessibilidade: false,
    consent_preferences: false,
    created_at: new Date(),
  }, { merge: true });
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

    // Fetch all interest docs for this user.
    const interestsSnap = await db
      .collection("users")
      .doc(uid)
      .collection("interests")
      .get();

    if (interestsSnap.empty) {
      // All interests were deleted → reset affinity.
      await db.collection("users").doc(uid).set(
        { affinity: {} },
        { merge: true }
      );
      logger.info(`computeAffinity: no interests left for user ${uid}, cleared affinity.`);
      return;
    }

    // Build a map of specialty → count, find the max count.
    const counts = {};
    let maxCount = 0;

    interestsSnap.forEach((doc) => {
      const data = doc.data();
      const count = data.count || 0;
      const specialty = data.specialty || doc.id;
      counts[specialty] = count;
      if (count > maxCount) maxCount = count;
    });

    // Normalise: top specialty = 1.0, others proportional.
    const affinity = {};
    for (const [specialty, count] of Object.entries(counts)) {
      affinity[specialty] = maxCount > 0 ? count / maxCount : 0;
    }

    // Persist the affinity map on the user document.
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          affinity,
          affinityUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    logger.info(
      `computeAffinity: updated affinity for user ${uid} with ${Object.keys(affinity).length} specialties.`
    );
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

  const userRef = db.collection("users").doc(uid);

  for (const subcollection of userSubcollectionsForDeletion()) {
    await deleteSubcollection(userRef, subcollection);
  }

  // Delete the user document after all owned subcollections.
  await userRef.delete();

  logger.info(`onUserDelete: full cleanup complete for user ${uid}`);
});

/* ------------------------------------------------------------------
 * deleteSubcollection — batch delete with retry
 * ------------------------------------------------------------------ */
async function deleteSubcollection(ref, name) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const snap = await ref.collection(name).get();
      if (snap.empty) return;
      const batch = db.batch();
      snap.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      return;
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
