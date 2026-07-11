export type PublicProfile = {
  slug: string;
  name: string;
  specialty: string;
  crm: string;
  rqe: string;
  bio: string;
  verified: boolean;
  claimed: boolean;
  updatedAt: string;
  pendingChange?: string;
  location: { name: string; address: string; district: string; city: string; state: string; authorized: boolean };
  insurances: Array<{ name: string; confirmed: boolean }>;
  modalities: Array<"Presencial" | "Teleconsulta externa">;
  availability: string;
  contacts: { whatsApp: { verified: boolean; href: string }; phone: { verified: boolean; href: string } };
};

const profiles: PublicProfile[] = [{
  slug: "dra-marina-alves",
  name: "Dra. Marina Alves",
  specialty: "Psiquiatria",
  crm: "CRM-SC 12345",
  rqe: "RQE 6789",
  bio: "Psiquiatra com atendimento para adultos, presencial em Joinville e por teleconsulta externa. Informações clínicas são discutidas apenas na consulta.",
  verified: true,
  claimed: true,
  updatedAt: "10 jul 2026",
  pendingChange: "Alteração de horário em revisão. Exibindo o último dado confirmado.",
  location: { name: "Clínica Centro", address: "Rua das Palmeiras, 245", district: "Centro", city: "Joinville", state: "SC", authorized: true },
  insurances: [{ name: "Unimed", confirmed: true }, { name: "Particular", confirmed: true }],
  modalities: ["Presencial", "Teleconsulta externa"],
  availability: "Aceita novos pacientes",
  contacts: { whatsApp: { verified: true, href: "https://wa.me/554733334444" }, phone: { verified: true, href: "tel:+554733334444" } },
}];

const legacyAliases: Record<string, string> = { "marina-alves": "dra-marina-alves" };

export function resolvePublicProfileSlug(slug: string) {
  return legacyAliases[slug] ?? slug;
}

export function getPublicProfile(slug: string) {
  return profiles.find((profile) => profile.slug === resolvePublicProfileSlug(slug));
}

export function publicProfileSlugs() {
  return profiles.map((profile) => profile.slug);
}
