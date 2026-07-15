import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Functions } from "firebase/functions";

export type SavedSearchCriteria = {
  specialty?: string;
  city?: string;
  insurance?: string;
  modality?: "in_person" | "telemedicine";
};

export type AccountFavorite = { doctorId: string; createdAt: unknown | null };
export type AccountSavedSearch = {
  id: string;
  criteria: SavedSearchCriteria;
  alertEnabled: boolean;
  createdAt: unknown | null;
  updatedAt: unknown | null;
};

export type SavedItemsSnapshot = {
  favorites: AccountFavorite[];
  searches: AccountSavedSearch[];
};

export type FirebasePublicEnvironment = {
  [key in
  | "NEXT_PUBLIC_FIREBASE_API_KEY"
  | "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  | "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  | "NEXT_PUBLIC_FIREBASE_APP_ID"
  | "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
  | "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
  | "NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION"
  | "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"]?: string | undefined;
};

const requiredConfiguration = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export class FirebasePublicConfigurationError extends Error {
  constructor(keys: readonly string[]) {
    super(`Firebase public configuration is missing or invalid: ${keys.join(", ")}`);
    this.name = "FirebasePublicConfigurationError";
  }
}

export class FirebaseBrowserOnlyError extends Error {
  constructor() {
    super("Firebase browser client is unavailable during server rendering.");
    this.name = "FirebaseBrowserOnlyError";
  }
}

function validValue(value: string | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 && !/^replace(_with)?/i.test(trimmed);
}

function optionalValue(value: string | undefined) {
  return typeof value === "string" && validValue(value) ? value.trim() : undefined;
}

function publicEnvironmentFromProcess(): FirebasePublicEnvironment {
  return {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION: process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

export function firebasePublicConfigFrom(environment: FirebasePublicEnvironment): FirebaseOptions {
  const invalid = requiredConfiguration.filter((key) => !validValue(environment[key]));
  if (invalid.length) throw new FirebasePublicConfigurationError(invalid);

  const config: FirebaseOptions = {
    apiKey: environment.NEXT_PUBLIC_FIREBASE_API_KEY!.trim(),
    authDomain: environment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!.trim(),
    projectId: environment.NEXT_PUBLIC_FIREBASE_PROJECT_ID!.trim(),
    appId: environment.NEXT_PUBLIC_FIREBASE_APP_ID!.trim(),
  };
  const storageBucket = optionalValue(environment.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const messagingSenderId = optionalValue(environment.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
  if (storageBucket) config.storageBucket = storageBucket;
  if (messagingSenderId) config.messagingSenderId = messagingSenderId;
  const measurementId = optionalValue(environment.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);
  if (measurementId) config.measurementId = measurementId;
  return config;
}

function functionsRegionFrom(environment: FirebasePublicEnvironment) {
  const region = environment.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION;
  if (region === undefined) return undefined;
  if (!/^[a-z]+(?:-[a-z]+)+\d+$/.test(region.trim())) {
    throw new FirebasePublicConfigurationError(["NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION"]);
  }
  return region.trim();
}

export type FirebaseRuntime = {
  getApps: () => FirebaseApp[];
  getApp: () => FirebaseApp;
  initializeApp: (options: FirebaseOptions) => FirebaseApp;
  getAuth: (app: FirebaseApp) => Auth;
  getFunctions: (app: FirebaseApp, region?: string) => Functions;
  httpsCallable: <Request, Response>(functions: Functions, name: string) => (data: Request) => Promise<{ data: Response }>;
};

export async function loadFirebaseRuntime(): Promise<FirebaseRuntime> {
  const [app, auth, functions] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/functions"),
  ]);
  return {
    getApps: app.getApps,
    getApp: app.getApp,
    initializeApp: app.initializeApp,
    getAuth: auth.getAuth,
    getFunctions: functions.getFunctions,
    httpsCallable: functions.httpsCallable,
  };
}

export type FirebaseBrowserClient = {
  app: FirebaseApp;
  auth: Auth;
  functions: Functions;
  invoke: <Request, Response>(name: string, data: Request) => Promise<Response>;
};

export type FirebaseClientOptions = {
  environment?: FirebasePublicEnvironment;
  isBrowser?: boolean;
  loadRuntime?: () => Promise<FirebaseRuntime>;
};

export async function createFirebaseBrowserClient(options: FirebaseClientOptions = {}): Promise<FirebaseBrowserClient> {
  if (options.isBrowser ?? typeof window !== "undefined") {
    const environment = options.environment ?? publicEnvironmentFromProcess();
    const config = firebasePublicConfigFrom(environment);
    const region = functionsRegionFrom(environment);
    const runtime = await (options.loadRuntime ?? loadFirebaseRuntime)();
    const app = runtime.getApps().length ? runtime.getApp() : runtime.initializeApp(config);
    const functions = region ? runtime.getFunctions(app, region) : runtime.getFunctions(app);
    return {
      app,
      auth: runtime.getAuth(app),
      functions,
      invoke: async <Request, Response>(name: string, data: Request) => (await runtime.httpsCallable<Request, Response>(functions, name)(data)).data,
    };
  }
  throw new FirebaseBrowserOnlyError();
}

export type SavedItemsCallableClient = {
  listSavedItems: () => Promise<SavedItemsSnapshot>;
  favoriteDoctor: (doctorId: string) => Promise<{ doctorId: string; favorited: true }>;
  unfavoriteDoctor: (doctorId: string) => Promise<{ doctorId: string; favorited: false }>;
  saveAccountSearch: (input: { criteria: SavedSearchCriteria; alertEnabled: boolean }) => Promise<{ id: string; criteria: SavedSearchCriteria; alertEnabled: boolean }>;
  removeAccountSearch: (searchId: string) => Promise<{ searchId: string; removed: true }>;
  setSavedSearchAlert: (input: { searchId: string; alertEnabled: boolean }) => Promise<{ searchId: string; alertEnabled: boolean }>;
};

export async function createSavedItemsCallableClient(options: FirebaseClientOptions = {}): Promise<SavedItemsCallableClient> {
  const client = await createFirebaseBrowserClient(options);
  return {
    listSavedItems: () => client.invoke<undefined, SavedItemsSnapshot>("listSavedItems", undefined),
    favoriteDoctor: (doctorId) => client.invoke("favoriteDoctor", { doctorId }),
    unfavoriteDoctor: (doctorId) => client.invoke("unfavoriteDoctor", { doctorId }),
    saveAccountSearch: (input) => client.invoke("saveAccountSearch", input),
    removeAccountSearch: (searchId) => client.invoke("removeAccountSearch", { searchId }),
    setSavedSearchAlert: (input) => client.invoke("setSavedSearchAlert", input),
  };
}
