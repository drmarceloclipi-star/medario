import { describe, it, expect, vi } from 'vitest';
import { resolvePublicProfileSlug, createPublicProfileReader, getPublicProfile } from './profile-data';

describe('resolvePublicProfileSlug', () => {
  it('should return slug as-is if not in aliases', () => {
    expect(resolvePublicProfileSlug('dr-johnson')).toBe('dr-johnson');
  });

  it('should return aliased slug', () => {
    expect(resolvePublicProfileSlug('dra-marina-alves')).toBe('mariana-andrade');
  });

  it('should return null if not found', () => {
    expect(resolvePublicProfileSlug('nonexistent')).toBe(null);
  });
});

describe('createPublicProfileReader', () => {
  it('should return fixture reader when MEDARIO_PUBLIC_PROFILE_SOURCE=fixture', async () => {
    process.env.MEDARIO_PUBLIC_PROFILE_SOURCE = 'fixture';

    const reader = await createPublicProfileReader();
    expect(reader).toBeDefined();
    expect(typeof reader.getBySlug).toBe('function');
    expect(typeof reader.list).toBe('function');
  });

  it('should throw when MEDARIO_PUBLIC_PROFILE_SOURCE is not set', async () => {
    delete process.env.MEDARIO_PUBLIC_PROFILE_SOURCE;

    await expect(createPublicProfileReader()).rejects.toThrow();
  });
});

describe('getPublicProfile', () => {
  it('should return profile by slug', async () => {
    // @ts-ignore - allow mocking
    vi.mock('@medario/firebase/server', () => ({
      createPublicDirectoryReader: vi.fn().mockResolvedValue({
        getBySlug: vi.fn().mockResolvedValue({
          slug: 'test',
          name: 'Test Name',
          specialty: 'Cardiologia',
          crm: 'CRM/SC 123',
          rqe: 'RQE 456',
          bio: 'Test bio',
          verified: true,
          claimed: false,
          updatedAt: '2026-01-01T00:00:00-03:00',
          location: { name: 'Consultório', address: 'Rua X', district: 'Centro', city: 'Joinville', state: 'SC', authorized: true },
          insurances: [],
          modalities: ['Presencial'],
          availability: 'Aceita novos pacientes',
          contacts: { whatsApp: { verified: false, href: '#' }, phone: { verified: true, href: 'tel:+554712345678' } },
        }),
      }),
    }));

    // @ts-ignore - allow mocking
    const profile = await getPublicProfile('test');
    expect(profile?.slug).toBe('test');
    expect(profile?.name).toBe('Test Name');
    expect(profile?.specialty).toBe('Cardiologia');
  });
});