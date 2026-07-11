import type { AccountPort, AccountPreferences, AuthPort, AuthSession, AuthUser, PatientAccountInput } from "@medario/domain";
import type { User } from "firebase/auth";
import { createFirebaseBrowserClient, type FirebaseClientOptions } from "./index";

function authUser(user: { uid: string; email: string | null; displayName: string | null }): AuthUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

function requiredUser(auth: { currentUser: { uid: string } | null }) {
  if (!auth.currentUser) throw new Error("AUTH_REQUIRED");
  return auth.currentUser;
}

export async function createFirebaseAccountPort(options: FirebaseClientOptions = {}): Promise<AuthPort & AccountPort> {
  const client = await createFirebaseBrowserClient(options);
  const [authRuntime, firestoreRuntime] = await Promise.all([import("firebase/auth"), import("firebase/firestore")]);
  const db = firestoreRuntime.getFirestore(client.app);

  const profileRef = () => firestoreRuntime.doc(db, "users", requiredUser(client.auth).uid);
  const sessionFor = (user: User | null): AuthSession => user ? { status: "signed_in", user: authUser(user) } : { status: "signed_out" };

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
        await authRuntime.updateProfile(result.user, { displayName: input.email.trim().split("@")[0] });
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
      await firestoreRuntime.updateDoc(profileRef(), {
        cidade: input.cidade || null,
        convenio: input.convenio || null,
        tipo_atendimento: input.tipoAtendimento || null,
        idioma: input.idioma || "Português",
        acessibilidade: input.acessibilidade === true,
        updated_at: firestoreRuntime.serverTimestamp(),
      });
    },
    async setHealthConsent(value) {
      await firestoreRuntime.updateDoc(profileRef(), {
        consent_preferences: value,
        consent_at: firestoreRuntime.serverTimestamp(),
      });
    },
    async deleteAccount() {
      await authRuntime.deleteUser(requiredUser(client.auth) as Parameters<typeof authRuntime.deleteUser>[0]);
    },
  };
}
