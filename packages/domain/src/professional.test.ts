import { describe, expect, it } from "vitest";

import {
  aggregateAnonymousLeads,
  createIdentifiedLead,
  professionalAccountOwnsDoctor,
  publicProfileSnapshot,
  revokeGoogleCalendarAuthorization,
} from "./professional";

describe("Medario Pro contracts", () => {
  it("keeps a professional account scoped to its single doctor profile", () => {
    expect(professionalAccountOwnsDoctor({ doctorId: "doctor-1" }, "doctor-1")).toBe(true);
    expect(professionalAccountOwnsDoctor({ doctorId: "doctor-1" }, "doctor-2")).toBe(false);
  });

  it("keeps the confirmed public profile while a proposed change is under review", () => {
    const confirmed = {
      address: "Rua das Palmeiras, 245",
      whatsApp: "+5547999999999",
    };
    const proposed = {
      address: "Avenida Beira Rio, 42",
      whatsApp: "+5547888888888",
    };

    expect(publicProfileSnapshot(confirmed, proposed)).toEqual(confirmed);
  });

  it("returns anonymous lead metrics without query, symptoms, or exact location", () => {
    const metric = aggregateAnonymousLeads(
      [
        {
          doctorId: "doctor-1",
          query: "dor no peito",
          symptoms: ["dor"],
          exactLocation: { latitude: -26.3, longitude: -48.8 },
        },
        { doctorId: "doctor-2" },
        { doctorId: "doctor-1" },
      ] as unknown as Array<{ doctorId: string }>,
      "doctor-1",
    );

    expect(metric).toEqual({ doctorId: "doctor-1", count: 2 });
    expect(metric).not.toHaveProperty("query");
    expect(metric).not.toHaveProperty("symptoms");
    expect(metric).not.toHaveProperty("exactLocation");
  });

  it("requires an explicit patient action before creating an identified lead", () => {
    expect(() => createIdentifiedLead("profile_view", "patient-1")).toThrow();
    expect(createIdentifiedLead("appointment_request", "patient-1")).toEqual({
      patientId: "patient-1",
      action: "appointment_request",
    });
  });

  it("lets a doctor revoke a Google Calendar authorization", () => {
    const revoked = revokeGoogleCalendarAuthorization({
      doctorId: "doctor-1",
      integrationCalendarId: "medario-integration",
      status: "active",
    });

    expect(revoked).toEqual({
      doctorId: "doctor-1",
      integrationCalendarId: "medario-integration",
      status: "revoked",
    });
  });
});
