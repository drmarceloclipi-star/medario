import type { AccountPort, AccountPreferences, AuthPort, AuthSession, AuthUser, PatientAccountInput } from "@medario/domain";
import type { User } from "firebase/auth";
import { createFirebaseBrowserClient, type FirebaseClientOptions } from "./index";

export type FirebaseAccountPortOptions = FirebaseClientOptions & {
  createClient?: typeof createFirebaseBrowserClient;
  loadAuthRuntime?: () => Promise<typeof import("firebase/auth")>;
  loadFirestoreRuntime?: () => Promise<typeof import("firebase/firestore")>;
};

function authUser(user: { uid: string; email: string | null; displayName: string | null }): AuthUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

function requiredUser(auth: { currentUser: { uid: string; email: string | null } | null }) {
  if (!auth.currentUser) throw new Error("AUTH_REQUIRED");
  return auth.currentUser;
}

export async function createFirebaseAccountPort(options: FirebaseAccountPortOptions = {}): Promise<AuthPort & AccountPort> {
  const client = await (options.createClient ?? createFirebaseBrowserClient)(options);
  const [authRuntime, firestoreRuntime] = await Promise.all([
    (options.loadAuthRuntime ?? (() => import("firebase/auth")))(),
    (options.loadFirestoreRuntime ?? (() => import("firebase/firestore")))(),
  ]);
  const db = firestoreRuntime.getFirestore(client.app);

  const profileRef = () => firestoreRuntime.doc(db, "users", requiredUser(client.auth).uid);
  const sessionFor = (user: User | null): AuthSession => user ? { status: "signed_in", user: authUser(user) } : { status: "signed_out" };
  const writeProfileFields = async (fields: Record<string, unknown>) => {
    const user = requiredUser(client.auth);
    const ref = profileRef();
    await firestoreRuntime.runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) transaction.update(ref, fields);
      else transaction.set(ref, { email: user.email, created_at: firestoreRuntime.serverTimestamp(), ...fields }, { merge: true });
    });
  };

  return {
    subscribe(listener) {
      listener({ status: "loading" });
      return authRuntime.onAuthStateChanged(client.auth, (user) => listener(sessionFor(user)));
    },
    async signInWithEmail(email, password) {
      const result = await authRuntime.signInWithEmailAndPassword(client.auth, email.trim(), password);
      return authUser(result.user);
    },
    async createPatientAccount(input: PatientAccountInput) {
      const result = await authRuntime.createUserWithEmailAndPassword(client.auth, input.email.trim(), input.password);
      try {
        await authRuntime.updateProfile(result.user, { displayName: input.email.trim().split("@")[0] ?? null });
      } catch {
        // Auth account + server-triggered user profile remain valid if display-name enrichment fails.
      }
      return authUser(result.user);
    },
    signOut: () => authRuntime.signOut(client.auth),
    async getProfile() {
      const snapshot = await firestoreRuntime.getDoc(profileRef());
      const data = snapshot.exists() ? snapshot.data() : {};
      return {
        email: typeof data.email === "string" ? data.email : (client.auth.currentUser?.email ?? ""),
        idioma: typeof data.idioma === "string" ? data.idioma : "Português",
        acessibilidade: data.acessibilidade === true,
        consentPreferences: data.consent_preferences === true,
        ...(typeof data.cidade === "string" ? { cidade: data.cidade } : {}),
        ...(typeof data.convenio === "string" ? { convenio: data.convenio } : {}),
        ...(typeof data.tipo_atendimento === "string" ? { tipoAtendimento: data.tipo_atendimento } : {}),
      };
    },
    async updatePreferences(input: AccountPreferences) {
      await writeProfileFields({
        cidade: input.cidade || null,
        convenio: input.convenio || null,
        tipo_atendimento: input.tipoAtendimento || null,
        idioma: input.idioma || "Português",
        acessibilidade: input.acessibilidade === true,
        updated_at: firestoreRuntime.serverTimestamp(),
      });
    },
    async setHealthConsent(value) {
      requiredUser(client.auth);
      if (!value) {
        await client.invoke<undefined, { consentPreferences: false }>("revokeHealthConsent", undefined);
        return;
      }
      await writeProfileFields({
        consent_preferences: true,
        consent_at: firestoreRuntime.serverTimestamp(),
      });
    },
    async deleteAccount(password) {
      const user = requiredUser(client.auth);
      if (password) {
        if (!user.email) throw new Error("REAUTH_EMAIL_REQUIRED");
        const credential = authRuntime.EmailAuthProvider.credential(user.email, password);
        await authRuntime.reauthenticateWithCredential(user as User, credential);
        await (user as User).getIdToken(true);
      }
      await client.invoke<undefined, { deleted: true }>("deleteMyAccount", undefined);
    },
  };
}
