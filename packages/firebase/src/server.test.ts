import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPublicDirectoryReader } from "./server";

const adminMocks = vi.hoisted(() => ({
  applicationDefault: vi.fn(() => "credential"),
  getApps: vi.fn(() => []),
  getFirestore: vi.fn(),
  initializeApp: vi.fn(() => ({ name: "medario-server" })),
}));

vi.mock("firebase-admin/app", () => ({
  applicationDefault: adminMocks.applicationDefault,
  getApps: adminMocks.getApps,
  initializeApp: adminMocks.initializeApp,
}));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: adminMocks.getFirestore }));

const completeProfile = {
  slug: "test",
  name: "Test Doctor",
  specialty: "Cardiologia",
  crm: "CRM/SC 123",
  rqe: "RQE 456",
  bio: "Test bio",
  verified: true,
  claimed: false,
  updatedAt: "2026-01-01T00:00:00-03:00",
  location: { name: "Consultório", address: "Rua X", district: "Centro", city: "Joinville", state: "SC", authorized: true },
  insurances: [],
  modalities: ["Presencial"],
  availability: "Aceita novos pacientes",
  contacts: { whatsApp: { verified: false, href: "#" }, phone: { verified: true, href: "tel:+554712345678" } },
};

function firestoreWith(records: Array<Record<string, unknown>>) {
  const query = {
    where: vi.fn(),
    limit: vi.fn(),
    get: vi.fn(async () => ({ docs: records.map((record, index) => ({ id: `doc-${index + 1}`, data: () => record })) })),
  };
  query.where.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return { collection: vi.fn(() => query) };
}

describe("createPublicDirectoryReader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the default isolated Firebase Admin reader", async () => {
    adminMocks.getApps.mockReturnValue([]);
    adminMocks.getFirestore.mockReturnValue(firestoreWith([completeProfile]));
    const reader = createPublicDirectoryReader();
    expect((await reader.getBySlug("test"))?.name).toBe("Test Doctor");
    expect(adminMocks.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "medario-doctor" }), "medario-server");
  });

  it("gets a public profile by slug", async () => {
    const reader = createPublicDirectoryReader({ firestore: firestoreWith([completeProfile]) as never });
    const profile = await reader.getBySlug("test");
    expect(profile).toMatchObject({ slug: "test", name: "Test Doctor", specialty: "Cardiologia", crm: "CRM/SC 123", rqe: "RQE 456" });
  });

  it("returns null for unpublished or absent profiles", async () => {
    const reader = createPublicDirectoryReader({ firestore: firestoreWith([]) as never });
    await expect(reader.getBySlug("unpublished")).resolves.toBeNull();
  });

  it("accepts a custom Firestore instance", () => {
    const firestore = firestoreWith([completeProfile]);
    createPublicDirectoryReader({ firestore: firestore as never });
    expect(adminMocks.getFirestore).not.toHaveBeenCalled();
  });

  it("maps sparse profile data to safe defaults", async () => {
    const reader = createPublicDirectoryReader({ firestore: firestoreWith([{ slug: "empty", updatedAt: "2026-01-01T00:00:00-03:00", location: { city: "Joinville", state: "SC", authorized: false } }]) as never });
    const profile = await reader.getBySlug("empty");
    expect(profile).toMatchObject({ name: "Perfil médico", specialty: "Especialidade não informada", crm: "" });
    expect(profile?.rqe).toBeUndefined();
  });
});
