import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "medario-doctor";
const profile = {
  slug: "mariana-andrade",
  published: true,
  name: "Dra. Mariana Andrade",
  specialty: "Dermatologia",
  crm: "CRM/SC 12345",
  rqe: "RQE 6789",
  bio: "Dermatologista em Joinville com atendimento presencial e teleconsulta externa. Informações clínicas são discutidas apenas na consulta.",
  verified: true,
  claimed: false,
  verificationStatus: "verified",
  updatedAt: "2026-07-07T09:00:00-03:00",
  location: { name: "Consultório Santo Antônio", address: "Rua das Palmeiras, 245", district: "Santo Antônio", city: "Joinville", state: "SC", authorized: true },
  insurances: [
    { name: "Unimed", confirmed: true },
    { name: "América", confirmed: true },
    { name: "SulAmérica", confirmed: true },
  ],
  modalities: ["Presencial", "Teleconsulta externa"],
  availability: "Aceita novos pacientes",
  contacts: {
    whatsApp: { verified: false, href: "#" },
    phone: { verified: true, href: "tel:+554733334444" },
  },
  migrationSource: "legacy/medicos/mariana-andrade.html",
};

if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ projectId, paths: ["doctors/doctor-mariana-andrade", "publicDoctors/doctor-mariana-andrade"], profile }, null, 2));
  console.log("Dry run. Pass --apply only after reviewing the payload and confirming production credentials.");
  process.exit(0);
}

const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), projectId });
const { getFirestore } = await import("firebase-admin/firestore");
const db = getFirestore(app);
await db.collection("doctors").doc("doctor-mariana-andrade").set(profile, { merge: true });
await db.collection("publicDoctors").doc("doctor-mariana-andrade").set(profile, { merge: true });
console.log(`Migrated doctors/doctor-mariana-andrade to ${projectId}`);
