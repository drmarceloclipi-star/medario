import { describe, expect, it, vi } from "vitest";
import { createFirebaseAccountPort, type FirebaseAccountPortOptions } from "./account";

function harness(signedIn = true) {
  const user = signedIn ? { uid: "user-1", email: "patient@example.com", displayName: "Patient", getIdToken: vi.fn() } : null;
  const invoke = vi.fn().mockResolvedValue({});
  const auth = { currentUser: user };
  const firestoreRuntime = {
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn((_db, collection, id) => ({ collection, id })),
    serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
    runTransaction: vi.fn(async (_db, operation) => operation({
      get: vi.fn().mockResolvedValue({ exists: () => true }),
      update: vi.fn(),
      set: vi.fn(),
    })),
  };
  const authRuntime = {
    onAuthStateChanged: vi.fn(() => vi.fn()),
    signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user }),
    createUserWithEmailAndPassword: vi.fn().mockResolvedValue({ user }),
    updateProfile: vi.fn(),
    signOut: vi.fn(),
    EmailAuthProvider: { credential: vi.fn(() => "credential") },
    reauthenticateWithCredential: vi.fn(),
  };
  const options = {
    createClient: vi.fn().mockResolvedValue({ app: {}, auth, functions: {}, invoke }),
    loadAuthRuntime: vi.fn().mockResolvedValue(authRuntime),
    loadFirestoreRuntime: vi.fn().mockResolvedValue(firestoreRuntime),
  } as unknown as FirebaseAccountPortOptions;
  return { authRuntime, firestoreRuntime, invoke, options };
}

describe("createFirebaseAccountPort", () => {
  it("exposes the complete auth and account contract", async () => {
    const { options } = harness();
    const port = await createFirebaseAccountPort(options);
    for (const method of ["subscribe", "signInWithEmail", "createPatientAccount", "signOut", "getProfile", "updatePreferences", "setHealthConsent", "deleteAccount"] as const) {
      expect(typeof port[method]).toBe("function");
    }
  });

  it("revokes health consent through the server cleanup callable", async () => {
    const { invoke, firestoreRuntime, options } = harness();
    const port = await createFirebaseAccountPort(options);

    await port.setHealthConsent(false);

    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("revokeHealthConsent", undefined);
    expect(firestoreRuntime.runTransaction).not.toHaveBeenCalled();
  });

  it("enables health consent through the owned profile write", async () => {
    const { invoke, firestoreRuntime, options } = harness();
    const port = await createFirebaseAccountPort(options);

    await port.setHealthConsent(true);

    expect(invoke).not.toHaveBeenCalled();
    expect(firestoreRuntime.runTransaction).toHaveBeenCalledOnce();
  });

  it("deletes the account through the recent-auth server callable", async () => {
    const { invoke, authRuntime, options } = harness();
    const port = await createFirebaseAccountPort(options);

    await port.deleteAccount();

    expect(invoke).toHaveBeenCalledWith("deleteMyAccount", undefined);
    expect(authRuntime).not.toHaveProperty("deleteUser");
  });

  it("propagates the callable recent-login requirement to the caller", async () => {
    const { invoke, options } = harness();
    invoke.mockRejectedValueOnce({ code: "functions/failed-precondition", message: "Entre novamente antes de excluir sua conta." });
    const port = await createFirebaseAccountPort(options);

    await expect(port.deleteAccount()).rejects.toMatchObject({ code: "functions/failed-precondition" });
  });

  it("reauthenticates with password, refreshes ID token, then retries deletion", async () => {
    const { invoke, authRuntime, options } = harness();
    const port = await createFirebaseAccountPort(options);

    await port.deleteAccount("correct horse battery staple");

    expect(authRuntime.EmailAuthProvider.credential).toHaveBeenCalledWith("patient@example.com", "correct horse battery staple");
    expect(authRuntime.reauthenticateWithCredential).toHaveBeenCalledOnce();
    const reauthenticatedUser = (authRuntime.reauthenticateWithCredential as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(reauthenticatedUser.getIdToken).toHaveBeenCalledWith(true);
    expect(invoke).toHaveBeenCalledWith("deleteMyAccount", undefined);
  });

  it("rejects sensitive account operations without a signed-in user", async () => {
    const { options } = harness(false);
    const port = await createFirebaseAccountPort(options);
    await expect(port.setHealthConsent(false)).rejects.toThrow("AUTH_REQUIRED");
    await expect(port.deleteAccount()).rejects.toThrow("AUTH_REQUIRED");
  });
});
