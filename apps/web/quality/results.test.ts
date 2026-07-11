import { describe, expect, it } from "vitest";

import type { PublicProfile } from "@medario/domain";

import { directoryDoctorFromPublicProfile, searchDirectory } from "../app/results";

describe("intelligent results", () => {
  it("keeps sponsored profiles separate from organic ordering", () => {
    const results = searchDirectory({ filters: { specialty: "psiquiatria", city: "joinville" } }, "relevance", false);

    expect(results.organic.every((doctor) => !doctor.sponsored)).toBe(true);
    expect(results.sponsored.every((doctor) => doctor.sponsored)).toBe(true);
    expect(results.organic.map((doctor) => doctor.name)).toContain("Dra. Marina Alves");
  });

  it("does not expose distance without authorized patient location", () => {
    const results = searchDirectory({ filters: { specialty: "psiquiatria" } }, "distance", false);

    expect(results.organic.every((doctor) => doctor.distanceKm === undefined)).toBe(true);
  });

  it("sorts organic profiles by freshness when requested", () => {
    const results = searchDirectory({ filters: { specialty: "psiquiatria" } }, "updated", true);

    expect(results.organic[0]?.name).toBe("Dra. Helena Costa");
  });

  it("preserves authorized public coordinates for map rendering", () => {
    const profile: PublicProfile = {
      slug: "doctor-map",
      name: "Dra. Mapa",
      specialty: "Cardiologia",
      crm: "CRM/SC 1",
      bio: "Perfil confirmado.",
      verified: true,
      claimed: false,
      updatedAt: "2026-07-10T10:00:00-03:00",
      location: { name: "Clínica", address: "Rua A, 1", district: "Centro", city: "Joinville", state: "SC", authorized: true },
      mapLocation: { latitude: -26.3044, longitude: -48.8461, authorized: true },
      insurances: [],
      modalities: ["Presencial"],
      availability: "Aceita novos pacientes",
      contacts: { whatsApp: { verified: false, href: "#" }, phone: { verified: false, href: "#" } },
    };

    expect(directoryDoctorFromPublicProfile(profile).mapLocation).toEqual(profile.mapLocation);
  });
});
