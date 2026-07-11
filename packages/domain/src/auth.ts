export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type AuthSession =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; user: AuthUser };

export type PatientAccountInput = {
  email: string;
  password: string;
  cidade?: string;
  convenio?: string;
  tipoAtendimento?: string;
  idioma?: string;
  acessibilidade?: boolean;
};

export type AccountProfile = {
  email: string;
  cidade?: string;
  convenio?: string;
  tipoAtendimento?: string;
  idioma?: string;
  acessibilidade?: boolean;
  consentPreferences?: boolean;
};

export type AccountPreferences = Pick<AccountProfile, "cidade" | "convenio" | "tipoAtendimento" | "idioma" | "acessibilidade">;

export interface AuthPort {
  subscribe(listener: (session: AuthSession) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  createPatientAccount(input: PatientAccountInput): Promise<AuthUser>;
  signOut(): Promise<void>;
}

export interface AccountPort {
  getProfile(): Promise<AccountProfile | null>;
  updatePreferences(input: AccountPreferences): Promise<void>;
  setHealthConsent(value: boolean): Promise<void>;
  deleteAccount(): Promise<void>;
}
