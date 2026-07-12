import { describe, it, expect, vi } from 'vitest';
import type { AuthUser, AuthSession, PatientAccountInput, AccountProfile, AccountPreferences } from './auth';

describe('AuthUser type', () => {
  it('should have uid, email, and displayName', () => {
    const user: AuthUser = {
      uid: 'user-123',
      email: 'user@example.com',
      displayName: 'John Doe',
    };

    expect(user).toBeDefined();
    expect(user.uid).toBe('user-123');
    expect(user.email).toBe('user@example.com');
    expect(user.displayName).toBe('John Doe');
  });

  it('should handle null email and displayName', () => {
    const userWithNulls: AuthUser = {
      uid: 'user-123',
      email: null,
      displayName: null,
    };

    expect(userWithNulls).toBeDefined();
    expect(userWithNulls.email).toBeNull();
    expect(userWithNulls.displayName).toBeNull();
  });

  it('should handle undefined email and displayName', () => {
    const userWithUndefined: AuthUser = {
      uid: 'user-123',
      email: undefined,
      displayName: undefined,
    };

    expect(userWithUndefined).toBeDefined();
    expect(userWithUndefined.email).toBeUndefined();
    expect(userWithUndefined.displayName).toBeUndefined();
  });
});

describe('AuthSession type', () => {
  it('should support loading state', () => {
    const loadingSession: AuthSession = { status: 'loading' };
    expect(loadingSession).toBeDefined();
    expect(loadingSession.status).toBe('loading');
  });

  it('should support signed_out state', () => {
    const signedOutSession: AuthSession = { status: 'signed_out' };
    expect(signedOutSession).toBeDefined();
    expect(signedOutSession.status).toBe('signed_out');
  });

  it('should support signed_in state with user', () => {
    const user: AuthUser = {
      uid: 'user-123',
      email: 'user@example.com',
      displayName: 'John Doe',
    };

    const signedInSession: AuthSession = {
      status: 'signed_in',
      user,
    };

    expect(signedInSession).toBeDefined();
    expect(signedInSession.status).toBe('signed_in');
    expect(signedInSession.user).toBeDefined();
    expect(signedInSession.user.uid).toBe('user-123');
    expect(signedInSession.user.email).toBe('user@example.com');
    expect(signedInSession.user.displayName).toBe('John Doe');
  });
});

describe('PatientAccountInput type', () => {
  it('should have required fields', () => {
    const input: PatientAccountInput = {
      email: 'user@example.com',
      password: 'password123',
    };

    expect(input).toBeDefined();
    expect(input.email).toBe('user@example.com');
    expect(input.password).toBe('password123');
  });

  it('should accept optional fields', () => {
    const inputWithOptional: PatientAccountInput = {
      email: 'user@example.com',
      password: 'password123',
      cidade: 'Joinville',
      convenio: 'América',
      tipoAtendimento: 'Presencial',
      idioma: 'Português',
      acessibilidade: false,
    };

    expect(inputWithOptional).toBeDefined();
    expect(inputWithOptional.cidade).toBe('Joinville');
    expect(inputWithOptional.convenio).toBe('América');
    expect(inputWithOptional.tipoAtendimento).toBe('Presencial');
    expect(inputWithOptional.idioma).toBe('Português');
    expect(inputWithOptional.acessibilidade).toBe(false);
  });
});

describe('AccountProfile type', () => {
  it('should have email and optional fields', () => {
    const profile: AccountProfile = {
      email: 'user@example.com',
      cidade: 'Joinville',
      convenio: 'América',
      tipoAtendimento: 'Presencial',
      idioma: 'Português',
      acessibilidade: true,
      consentPreferences: true,
    };

    expect(profile).toBeDefined();
    expect(profile.email).toBe('user@example.com');
    expect(profile.cidade).toBe('Joinville');
    expect(profile.convenio).toBe('América');
    expect(profile.tipoAtendimento).toBe('Presencial');
    expect(profile.idioma).toBe('Português');
    expect(profile.acessibilidade).toBe(true);
    expect(profile.consentPreferences).toBe(true);
  });

  it('should handle undefined optional fields', () => {
    const profileWithUndefined: AccountProfile = {
      email: 'user@example.com',
      cidade: undefined,
      convenio: undefined,
      tipoAtendimento: undefined,
      idioma: undefined,
      acessibilidade: undefined,
      consentPreferences: undefined,
    };

    expect(profileWithUndefined).toBeDefined();
    expect(profileWithUndefined.cidade).toBeUndefined();
    expect(profileWithUndefined.convenio).toBeUndefined();
    expect(profileWithUndefined.tipoAtendimento).toBeUndefined();
    expect(profileWithUndefined.idioma).toBeUndefined();
    expect(profileWithUndefined.acessibilidade).toBeUndefined();
    expect(profileWithUndefined.consentPreferences).toBeUndefined();
  });
});

describe('AccountPreferences type', () => {
  it('should have all optional fields', () => {
    const preferences: AccountPreferences = {
      cidade: 'Joinville',
      convenio: 'América',
      tipoAtendimento: 'Presencial',
      idioma: 'Português',
      acessibilidade: true,
    };

    expect(preferences).toBeDefined();
    expect(preferences.cidade).toBe('Joinville');
    expect(preferences.convenio).toBe('América');
    expect(preferences.tipoAtendimento).toBe('Presencial');
    expect(preferences.idioma).toBe('Português');
    expect(preferences.acessibilidade).toBe(true);
  });

  it('should accept partial preferences', () => {
    const partialPreferences: AccountPreferences = {
      cidade: 'Joinville',
    };

    expect(partialPreferences).toBeDefined();
    expect(partialPreferences.cidade).toBe('Joinville');
  });
});

describe('AuthPort interface', () => {
  it('should have subscribe method', () => {
    const port: AuthPort = {
      subscribe: vi.fn(),
      signInWithEmail: vi.fn(),
      createPatientAccount: vi.fn(),
      signOut: vi.fn(),
    };

    expect(port).toBeDefined();
    expect(typeof port.subscribe).toBe('function');
    expect(typeof port.signInWithEmail).toBe('function');
    expect(typeof port.createPatientAccount).toBe('function');
    expect(typeof port.signOut).toBe('function');
  });

  it('should have signInWithEmail method', () => {
    const port: AuthPort = {
      subscribe: vi.fn(),
      signInWithEmail: vi.fn().mockResolvedValue({ uid: 'test', email: null, displayName: null }),
      createPatientAccount: vi.fn(),
      signOut: vi.fn(),
    };

    expect(port.signInWithEmail).toBeDefined();
  });

  it('should have createPatientAccount method', () => {
    const port: AuthPort = {
      subscribe: vi.fn(),
      signInWithEmail: vi.fn(),
      createPatientAccount: vi.fn().mockResolvedValue({ uid: 'test', email: null, displayName: null }),
      signOut: vi.fn(),
    };

    expect(port.createPatientAccount).toBeDefined();
  });

  it('should have signOut method', () => {
    const port: AuthPort = {
      subscribe: vi.fn(),
      signInWithEmail: vi.fn(),
      createPatientAccount: vi.fn(),
      signOut: vi.fn(),
    };

    expect(port.signOut).toBeDefined();
  });
});

describe('AccountPort interface', () => {
  it('should have getProfile method', () => {
    const port: AccountPort = {
      getProfile: vi.fn(),
      updatePreferences: vi.fn(),
      setHealthConsent: vi.fn(),
      deleteAccount: vi.fn(),
    };

    expect(port).toBeDefined();
    expect(typeof port.getProfile).toBe('function');
    expect(typeof port.updatePreferences).toBe('function');
    expect(typeof port.setHealthConsent).toBe('function');
    expect(typeof port.deleteAccount).toBe('function');
  });

  it('should have updatePreferences method', () => {
    const port: AccountPort = {
      getProfile: vi.fn(),
      updatePreferences: vi.fn(),
      setHealthConsent: vi.fn(),
      deleteAccount: vi.fn(),
    };

    expect(port.updatePreferences).toBeDefined();
  });

  it('should have setHealthConsent method', () => {
    const port: AccountPort = {
      getProfile: vi.fn(),
      updatePreferences: vi.fn(),
      setHealthConsent: vi.fn(),
      deleteAccount: vi.fn(),
    };

    expect(port.setHealthConsent).toBeDefined();
  });

  it('should have deleteAccount method', () => {
    const port: AccountPort = {
      getProfile: vi.fn(),
      updatePreferences: vi.fn(),
      setHealthConsent: vi.fn(),
      deleteAccount: vi.fn(),
    };

    expect(port.deleteAccount).toBeDefined();
  });
});