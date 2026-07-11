import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { DirectoryPage, DirectoryQuery, PublicDirectoryReader, PublicProfile } from "@medario/domain";

type PublicDirectoryServerOptions = {
  firestore?: Firestore;
};

function adminFirestore() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const app = getApps()[0] ?? initializeApp({ credential: applicationDefault(), ...(projectId ? { projectId } : {}) });
  return getFirestore(app);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function dateValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return "";
}

function firstString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" ? first : fallback;
  }
  if (value && typeof value === "object" && "name" in value) return stringValue(value.name, fallback);
  if (value && typeof value === "object" && "href" in value) return stringValue(value.href, fallback);
  return fallback;
}

function fresh(value: unknown) {
  const timestamp = Date.parse(dateValue(value));
  return Number.isFinite(timestamp) && Date.now() - timestamp <= 5 * 60 * 1000;
}

function safeAvailability(record: Record<string, unknown>, availability: Record<string, unknown>) {
  const freshness = availability.updatedAt ?? availability.updated_at ?? record.availabilityUpdatedAt ?? record.availability_updated_at;
  if (!fresh(freshness)) return "Disponibilidade a confirmar";
  if (availability.confirmed === true && typeof availability.nextAvailableAt === "string") return `Vaga confirmada · ${availability.nextAvailableAt}`;
  if (availability.acceptsNewPatients === true) return "Aceita novos pacientes";
  return "Disponibilidade a confirmar";
}

function mapProfile(id: string, record: Record<string, unknown>): PublicProfile {
  const location = (record.location && typeof record.location === "object" ? record.location : {}) as Record<string, unknown>;
  const contacts = (record.contacts && typeof record.contacts === "object" ? record.contacts : {}) as Record<string, unknown>;
  const rawInsurances = Array.isArray(record.insurances) ? record.insurances : [];
  const rawModalities = Array.isArray(record.modalities) ? record.modalities : Array.isArray(record.appointmentTypes) ? record.appointmentTypes : [];
  const availability = record.availability && typeof record.availability === "object" ? record.availability as Record<string, unknown> : {};
  const slug = stringValue(record.slug, id);
  const phone = firstString(contacts.phone ?? record.phone, "");
  const whatsApp = firstString(contacts.whatsApp ?? contacts.whatsapp ?? record.whatsApp, "");
  const phoneVerified = booleanValue((contacts.phone as Record<string, unknown> | undefined)?.verified);
  const whatsAppVerified = booleanValue((contacts.whatsApp as Record<string, unknown> | undefined)?.verified ?? (contacts.whatsapp as Record<string, unknown> | undefined)?.verified);

  return {
    slug,
    name: stringValue(record.name, "Perfil médico"),
    specialty: firstString(record.specialty ?? record.specialties, "Especialidade não informada"),
    crm: stringValue(record.crm),
    ...(stringValue(record.rqe) ? { rqe: stringValue(record.rqe) } : {}),
    bio: stringValue(record.bio),
    verified: booleanValue(record.verified, record.verificationStatus === "verified"),
    claimed: booleanValue(record.claimed),
    updatedAt: dateValue(record.updatedAt ?? record.updated_at),
    ...(stringValue(record.pendingChange ?? record.pending_change) ? { pendingChange: stringValue(record.pendingChange ?? record.pending_change) } : {}),
    location: {
      name: stringValue(location.name, "Local de atendimento"),
      address: stringValue(location.address ?? location.addressLine),
      district: stringValue(location.district),
      city: stringValue(location.city, "Joinville"),
      state: stringValue(location.state, "SC"),
      authorized: booleanValue(location.authorized),
    },
    insurances: rawInsurances.map((item) => {
      if (typeof item === "string") return { name: item, confirmed: false };
      const candidate = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return { name: stringValue(candidate.name), confirmed: booleanValue(candidate.confirmed, candidate.status === "confirmed") };
    }).filter((item) => item.name),
    modalities: rawModalities.map((item) => item === "telemedicine" || item === "Teleconsulta externa" ? "Teleconsulta externa" : "Presencial"),
    availability: safeAvailability(record, availability),
    contacts: {
      whatsApp: { verified: whatsAppVerified, href: whatsAppVerified ? (whatsApp.startsWith("http") ? whatsApp : whatsApp ? `https://wa.me/${whatsApp.replace(/\D/g, "")}` : "#") : "#" },
      phone: { verified: phoneVerified, href: phoneVerified ? (phone.startsWith("tel:") ? phone : phone ? `tel:${phone.replace(/\D/g, "")}` : "#") : "#" },
    },
  };
}

function matches(profile: PublicProfile, query: DirectoryQuery) {
  if (query.city && profile.location.city.toLowerCase() !== query.city.toLowerCase()) return false;
  if (query.specialty && profile.specialty.toLowerCase() !== query.specialty.toLowerCase()) return false;
  if (query.insurance && !profile.insurances.some((item) => item.name.toLowerCase() === query.insurance?.toLowerCase())) return false;
  if (query.modality && !profile.modalities.some((item) => query.modality === "telemedicine" ? item === "Teleconsulta externa" : item === "Presencial")) return false;
  return true;
}

export function createPublicDirectoryReader(options: PublicDirectoryServerOptions = {}): PublicDirectoryReader {
  const firestore = options.firestore ?? adminFirestore();
  return {
    async getBySlug(slug) {
      const snapshot = await firestore.collection("publicDoctors").where("slug", "==", slug).where("published", "==", true).limit(1).get();
      const document = snapshot.docs[0];
      return document ? mapProfile(document.id, document.data()) : null;
    },
    async list(query) {
      const snapshot = await firestore.collection("publicDoctors").where("published", "==", true).orderBy("slug").get();
      const filtered = snapshot.docs.map((document) => mapProfile(document.id, document.data())).filter((profile) => matches(profile, query));
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
      const offset = Math.max(Number.parseInt(query.cursor ?? "0", 10) || 0, 0);
      const profiles = filtered.slice(offset, offset + limit);
      const hasMore = offset + limit < filtered.length;
      const result: DirectoryPage = { profiles, hasMore, ...(hasMore ? { nextCursor: String(offset + limit) } : {}) };
      return result;
    },
  };
}
