import { describe, expect, it } from "vitest";

import {
  createFirebaseBrowserClient,
  createSavedItemsCallableClient,
  FirebaseBrowserOnlyError,
  FirebasePublicConfigurationError,
  type FirebaseRuntime,
} from "@medario/firebase";

const environment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "public-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "medario-doctor.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "medario-doctor",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:702082375310:web:abc",
  NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION: "southamerica-east1",
} as const;

function runtimeMock(calls: string[]): FirebaseRuntime {
  const app = {} as never;
  const auth = {} as never;
  const functions = {} as never;
  return {
    getApps: () => [],
    getApp: () => app,
    initializeApp: () => { calls.push("initializeApp"); return app; },
    getAuth: () => { calls.push("getAuth"); return auth; },
    getFunctions: (_app, region) => { calls.push(`getFunctions:${region ?? "default"}`); return functions; },
    httpsCallable: (_functions, name) => async (data) => { calls.push(`${name}:${JSON.stringify(data)}`); return { data: { name, data } as never }; },
  };
}

describe("Firebase browser adapter", () => {
  it("fails closed before loading a runtime when public configuration is absent", async () => {
    let loaded = false;
    await expect(createFirebaseBrowserClient({ isBrowser: true, loadRuntime: async () => { loaded = true; throw new Error("must not load"); } })).rejects.toBeInstanceOf(FirebasePublicConfigurationError);
    expect(loaded).toBe(false);
  });

  it("does not initialize Firebase during server rendering", async () => {
    await expect(createFirebaseBrowserClient({ environment, isBrowser: false })).rejects.toBeInstanceOf(FirebaseBrowserOnlyError);
  });

  it("initializes lazily in the browser and exposes only typed saved-item callables", async () => {
    const calls: string[] = [];
    const client = await createSavedItemsCallableClient({ environment, isBrowser: true, loadRuntime: async () => runtimeMock(calls) });

    expect(calls).toEqual(["initializeApp", "getFunctions:southamerica-east1", "getAuth"]);
    await client.favoriteDoctor("doctor-1", "user-1");
    await client.saveAccountSearch({ criteria: { city: "joinville" }, alertEnabled: true, expectedUid: "user-1" });

    expect(calls).toContain('favoriteDoctor:{"doctorId":"doctor-1","expectedUid":"user-1"}');
    expect(calls).toContain('saveAccountSearch:{"criteria":{"city":"joinville"},"alertEnabled":true,"expectedUid":"user-1"}');
  });
});
