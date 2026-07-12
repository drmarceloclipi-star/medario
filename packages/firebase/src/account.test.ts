import { describe, it, expect, vi } from 'vitest';
import { createFirebaseAccountPort } from './account';

describe('createFirebaseAccountPort', () => {
  it('should create auth port with account port', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase/auth', () => ({
      signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' } }),
      onAuthStateChanged: vi.fn(),
      signOut: vi.fn(),
      deleteUser: vi.fn(),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase/firestore', () => ({
      getFirestore: vi.fn(),
      serverTimestamp: vi.fn(),
    }));

    const port = await createFirebaseAccountPort();
    expect(port).toBeDefined();
    expect(typeof port.subscribe).toBe('function');
    expect(typeof port.signInWithEmail).toBe('function');
    expect(typeof port.createPatientAccount).toBe('function');
    expect(typeof port.signOut).toBe('function');
    expect(typeof port.getProfile).toBe('function');
    expect(typeof port.updatePreferences).toBe('function');
    expect(typeof port.setHealthConsent).toBe('function');
    expect(typeof port.deleteAccount).toBe('function');
  });

  it('should throw AUTH_REQUIRED when no user', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase/auth', () => ({
      signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'test-uid', email: null, displayName: null } }),
      onAuthStateChanged: vi.fn(),
      signOut: vi.fn(),
      deleteUser: vi.fn(),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase/firestore', () => ({
      getFirestore: vi.fn(),
      serverTimestamp: vi.fn(),
    }));

    // @ts-ignore - allow mocking
    const port = await createFirebaseAccountPort({ ...undefined, auth: { currentUser: null } });
    await expect(port.getProfile()).rejects.toThrow('AUTH_REQUIRED');
  });

  it('should return user with uid, email, and displayName', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase/auth', () => ({
      signInWithEmailAndPassword: vi.fn().mockResolvedValue({ user: { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' } }),
      onAuthStateChanged: vi.fn(),
      signOut: vi.fn(),
      deleteUser: vi.fn(),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase/firestore', () => ({
      getFirestore: vi.fn(),
      serverTimestamp: vi.fn(),
    }));

    const port = await createFirebaseAccountPort();
    const result = await port.signInWithEmail('test@test.com', 'password');
    expect(result.uid).toBe('test-uid');
    expect(result.email).toBe('test@test.com');
    expect(result.displayName).toBe('Test User');
  });
});