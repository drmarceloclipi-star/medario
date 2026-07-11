import type { Doctor, Specialty } from "./types";

export const psychiatry: Specialty = {
  id: "specialty-psychiatry",
  slug: "psiquiatria",
  name: "Psiquiatria",
};

export const mockDoctors: Doctor[] = [
  {
    id: "doctor-marina-alves",
    slug: "dra-marina-alves",
    name: "Dra. Marina Alves",
    crm: "CRM-SC 12345",
    rqe: "RQE 6789",
    bio: "Psiquiatria clínica com atendimento presencial e por telemedicina.",
    specialties: [psychiatry],
    insurances: ["Unimed", "Particular"],
    languages: ["Português"],
    appointmentTypes: ["in_person", "telemedicine"],
    locations: [
      {
        id: "location-centro-joinville",
        city: "Joinville",
        state: "SC",
        district: "Centro",
      },
    ],
    verificationStatus: "verified",
    sponsored: false,
    availability: {
      acceptsNewPatients: true,
      nextAvailableAt: "2026-07-15T13:00:00-03:00",
    },
  },
];
