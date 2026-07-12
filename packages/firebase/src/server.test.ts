import { describe, it, expect, vi } from 'vitest';
import { createPublicDirectoryReader } from './server';

describe('createPublicDirectoryReader', () => {
  it('should create reader with default firestore', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/app', () => ({
      getApps: vi.fn(),
      initializeApp: vi.fn().mockReturnValue({ getFirestore: vi.fn() }),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [{ id: 'doc-1', data: () => ({ slug: 'test', name: 'Test Doctor', specialty: 'Cardiologia', crm: 'CRM/SC 123', rqe: 'RQE 456', bio: 'Test bio', verified: true, claimed: false, updatedAt: '2026-01-01T00:00:00-03:00', location: { name: 'Consultório', address: 'Rua X', district: 'Centro', city: 'Joinville', state: 'SC', authorized: true }, insurances: [], modalities: ['Presencial'], availability: 'Aceita novos pacientes', contacts: { whatsApp: { verified: false, href: '#' }, phone: { verified: true, href: 'tel:+554712345678' } } }] })
          }),
        }),
      }),
    }));

    const reader = await createPublicDirectoryReader();
    expect(reader).toBeDefined();
    expect(typeof reader.getBySlug).toBe('function');
    expect(typeof reader.list).toBe('function');
  });

  it('should get public profile by slug', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/app', () => ({
      getApps: vi.fn(),
      initializeApp: vi.fn().mockReturnValue({ getFirestore: vi.fn() }),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [{ id: 'doc-1', data: () => ({ slug: 'test', name: 'Test Doctor', specialty: 'Cardiologia', crm: 'CRM/SC 123', rqe: 'RQE 456', bio: 'Test bio', verified: true, claimed: false, updatedAt: '2026-01-01T00:00:00-03:00', location: { name: 'Consultório', address: 'Rua X', district: 'Centro', city: 'Joinville', state: 'SC', authorized: true }, insurances: [], modalities: ['Presencial'], availability: 'Aceita novos pacientes', contacts: { whatsApp: { verified: false, href: '#' }, phone: { verified: true, href: 'tel:+554712345678' } } })] })
          }),
        }),
      }),
    }));

    const reader = await createPublicDirectoryReader();
    const profile = await reader.getBySlug('test');
    expect(profile?.slug).toBe('test');
    expect(profile?.name).toBe('Test Doctor');
    expect(profile?.specialty).toBe('Cardiologia');
    expect(profile?.crm).toBe('CRM/SC 123');
    expect(profile?.rqe).toBe('RQE 456');
  });

  it('should return null for unpublished profiles', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/app', () => ({
      getApps: vi.fn(),
      initializeApp: vi.fn().mockReturnValue({ getFirestore: vi.fn() }),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [] })
          }),
        }),
      }),
    }));

    const reader = await createPublicDirectoryReader();
    const profile = await reader.getBySlug('unpublished');
    expect(profile).toBeNull();
  });

  it('should accept custom firestore instance', async () => {
    const mockFirestore = {
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: [{ id: 'doc-1', data: () => ({ slug: 'test', name: 'Test Doctor', specialty: 'Cardiologia', crm: 'CRM/SC 123', rqe: 'RQE 456', bio: 'Test bio', verified: true, claimed: false, updatedAt: '2026-01-01T00:00:00-03:00', location: { name: 'Consultório', address: 'Rua X', district: 'Centro', city: 'Joinville', state: 'SC', authorized: true }, insurances: [], modalities: ['Presencial'], availability: 'Aceita novos pacientes', contacts: { whatsApp: { verified: false, href: '#' }, phone: { verified: true, href: 'tel:+554712345678' } } })] })
        }),
      }),
    };

    const reader = await createPublicDirectoryReader({ firestore: mockFirestore });
    expect(reader).toBeDefined();
  });

  it('should handle empty profile data', async () => {
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/app', () => ({
      getApps: vi.fn(),
      initializeApp: vi.fn().mockReturnValue({ getFirestore: vi.fn() }),
    }));
    // @ts-ignore - allow mocking
    vi.mock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn().mockReturnValue({
        collection: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: [{ id: 'doc-1', data: () => ({ slug: 'test', name: 'Perfil médico', specialty: 'Especialidade não informada', crm: undefined, rqe: undefined, bio: undefined, verified: false, claimed: false, updatedAt: '2026-01-01T00:00:00-03:00', location: { name: 'Local de atendimento', address: undefined, district: undefined, city: 'Joinville', state: 'SC', authorized: false }, insurances: [], modalities: ['Presencial'], availability: 'Disponibilidade a confirmar', contacts: { whatsApp: { verified: false, href: '#' }, phone: { verified: false, href: '#' } } })] })
          }),
        }),
      }),
    }));

    const reader = await createPublicDirectoryReader();
    const profile = await reader.getBySlug('empty');
    expect(profile?.name).toBe('Perfil médico');
    expect(profile?.specialty).toBe('Especialidade não informada');
    expect(profile?.crm).toBe(undefined);
    expect(profile?.rqe).toBe(undefined);
  });
});