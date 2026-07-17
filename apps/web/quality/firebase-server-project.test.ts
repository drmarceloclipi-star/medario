import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseAdmin = vi.hoisted(() => ({
  applicationDefault: vi.fn(() => ({ type: "application-default" })),
  getApps: vi.fn<() => Array<{ name: string }>>(() => []),
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  initializeApp: vi.fn(() => ({ type: "firebase-admin-app" })),
}));

vi.mock("firebase-admin/app", () => ({
  applicationDefault: firebaseAdmin.applicationDefault,
  getApps: firebaseAdmin.getApps,
  initializeApp: firebaseAdmin.initializeApp,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: firebaseAdmin.getFirestore,
}));

import { adminFirestore } from "../../../packages/firebase/src/server";

describe("Firebase Admin project isolation", () => {
  const originalFirebaseProjectId = process.env.FIREBASE_PROJECT_ID;
  const originalPublicProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  beforeEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    vi.clearAllMocks();
    firebaseAdmin.getApps.mockReturnValue([]);
  });

  afterEach(() => {
    if (originalFirebaseProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = originalFirebaseProjectId;
    if (originalPublicProjectId === undefined) delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    else process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = originalPublicProjectId;
  });

  it("defaults server reads to the Medário Firebase project", () => {
    adminFirestore();

    expect(firebaseAdmin.initializeApp).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "medario-doctor",
    }), "medario-server");
  });

  it("does not reuse an Admin app owned by another project", () => {
    firebaseAdmin.getApps.mockReturnValue([{ name: "foreign-app" }]);

    adminFirestore();

    expect(firebaseAdmin.initializeApp).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "medario-doctor",
    }), "medario-server");
  });
});
