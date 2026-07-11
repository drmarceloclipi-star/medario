import type { DirectoryPage, PublicDirectoryReader, PublicProfile } from "@medario/domain";

export type { PublicProfile } from "@medario/domain";

const migratedMariana: PublicProfile = {
  slug: "mariana-andrade",
  name: "Dra. Mariana Andrade",
  specialty: "Dermatologia",
  crm: "CRM/SC 12345",
  rqe: "RQE 6789",
  bio: "Dermatologista em Joinville com atendimento presencial e teleconsulta externa. Informações clínicas são discutidas apenas na consulta.",
  verified: true,
  claimed: false,
  updatedAt: "2026-07-07T09:00:00-03:00",
  location: { name: "Consultório Santo Antônio", address: "Rua das Palmeiras, 245", district: "Santo Antônio", city: "Joinville", state: "SC", authorized: true },
  insurances: [{ name: "Unimed", confirmed: true }, { name: "América", confirmed: true }, { name: "SulAmérica", confirmed: true }],
  modalities: ["Presencial", "Teleconsulta externa"],
  availability: "Aceita novos pacientes",
  contacts: { whatsApp: { verified: false, href: "#" }, phone: { verified: true, href: "tel:+554733334444" } },
};

const legacyAliases: Record<string, string> = {
  "dra-marina-alves": "mariana-andrade",
  "marina-alves": "mariana-andrade",
  "mariana-andrade.html": "mariana-andrade",
};

function fixtureReader(): PublicDirectoryReader {
  return {
    async getBySlug(slug) {
      return resolvePublicProfileSlug(slug) === migratedMariana.slug ? migratedMariana : null;
    },
    async list(): Promise<DirectoryPage> {
      return { profiles: [migratedMariana], hasMore: false };
    },
  };
}

export function resolvePublicProfileSlug(slug: string) {
  return legacyAliases[slug] ?? slug;
}

export async function createPublicProfileReader() {
  if (process.env.MEDARIO_PUBLIC_PROFILE_SOURCE === "fixture") return fixtureReader();
  const { createPublicDirectoryReader } = await import("@medario/firebase/server");
  return createPublicDirectoryReader();
}

export async function getPublicProfile(slug: string) {
  const reader = await createPublicProfileReader();
  return reader.getBySlug(resolvePublicProfileSlug(slug));
}
