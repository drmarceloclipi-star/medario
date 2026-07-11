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
const { unmatchedSearchLogMessage } = require("./privacy");

admin.initializeApp();
const db = admin.firestore();

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
 *   c. Delete the user document itself: users/{uid}
 * ================================================================== */
exports.onUserDelete = functionsV1.auth.user().onDelete(async (user) => {
  const uid = user.uid;

  if (!uid) {
    logger.warn("onUserDelete: no uid in event, skipping.");
    return;
  }

  const userRef = db.collection("users").doc(uid);

  // a. Delete interests subcollection
  await deleteSubcollection(userRef, "interests");

  // b. Delete search_events subcollection
  await deleteSubcollection(userRef, "search_events");

  // c. Delete the user document itself
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
