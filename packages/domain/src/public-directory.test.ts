import { describe, it, expect, vi } from 'vitest';
import type { PublicProfile, DirectoryQuery, DirectoryPage } from './public-directory';

describe('PublicProfile type', () => {
  it('should have all required fields', () => {
    const profile: PublicProfile = {
      slug: 'test-doctor',
      name: 'Dr. Test',
      specialty: 'Cardiologia',
      crm: 'CRM/SC 123',
      rqe: 'RQE 456',
      bio: 'Bio do médico',
      verified: true,
      claimed: false,
      updatedAt: '2026-01-01T00:00:00-03:00',
      location: {
        name: 'Consultório',
        address: 'Rua X',
        district: 'Centro',
        city: 'Joinville',
        state: 'SC',
        authorized: true,
      },
      insurances: [{ name: 'América', confirmed: true }],
      modalities: ['Presencial'],
      availability: 'Aceita novos pacientes',
      contacts: {
        whatsApp: { verified: false, href: '#' },
        phone: { verified: true, href: 'tel:+554712345678' },
      },
    };

    expect(profile).toBeDefined();
    expect(profile.slug).toBe('test-doctor');
    expect(profile.name).toBe('Dr. Test');
    expect(profile.specialty).toBe('Cardiologia');
    expect(profile.crm).toBe('CRM/SC 123');
    expect(profile.rqe).toBe('RQE 456');
    expect(profile.bio).toBe('Bio do médico');
    expect(profile.verified).toBe(true);
    expect(profile.claimed).toBe(false);
    expect(profile.location).toBeDefined();
    expect(profile.insurances).toBeDefined();
    expect(profile.modalities).toBeDefined();
    expect(profile.availability).toBe('Aceita novos pacientes');
    expect(profile.contacts).toBeDefined();
  });

  it('should handle optional rqe field', () => {
    const profileWithoutRQE: PublicProfile = {
      slug: 'test-doctor',
      name: 'Dr. Test',
      specialty: 'Cardiologia',
      crm: 'CRM/SC 123',
      bio: 'Bio do médico',
      verified: true,
      claimed: false,
      updatedAt: '2026-01-01T00:00:00-03:00',
      location: {
        name: 'Consultório',
        address: 'Rua X',
        district: 'Centro',
        city: 'Joinville',
        state: 'SC',
        authorized: true,
      },
      insurances: [],
      modalities: ['Presencial'],
      availability: 'Aceita novos pacientes',
      contacts: {
        whatsApp: { verified: false, href: '#' },
        phone: { verified: true, href: 'tel:+554712345678' },
      },
    };

    expect(profileWithoutRQE).toBeDefined();
  });

  it('should handle mapLocation field', () => {
    const profileWithMapLocation: PublicProfile = {
      slug: 'test-doctor',
      name: 'Dr. Test',
      specialty: 'Cardiologia',
      crm: 'CRM/SC 123',
      rqe: 'RQE 456',
      bio: 'Bio do médico',
      verified: true,
      claimed: false,
      updatedAt: '2026-01-01T00:00:00-03:00',
      location: {
        name: 'Consultório',
        address: 'Rua X',
        district: 'Centro',
        city: 'Joinville',
        state: 'SC',
        authorized: true,
      },
      mapLocation: {
        latitude: -27.234567,
        longitude: -49.123456,
        authorized: true,
      },
      insurances: [],
      modalities: ['Presencial'],
      availability: 'Aceita novos pacientes',
      contacts: {
        whatsApp: { verified: false, href: '#' },
        phone: { verified: true, href: 'tel:+554712345678' },
      },
    };

    expect(profileWithMapLocation.mapLocation).toBeDefined();
    expect(profileWithMapLocation.mapLocation.latitude).toBe(-27.234567);
    expect(profileWithMapLocation.mapLocation.longitude).toBe(-49.123456);
  });
});

describe('DirectoryQuery type', () => {
  it('should accept all query parameters', () => {
    const query: DirectoryQuery = {
      city: 'Joinville',
      specialty: 'Cardiologia',
      insurance: 'América',
      modality: 'in_person',
      cursor: 'abc123',
      limit: 50,
    };

    expect(query).toBeDefined();
    expect(query.city).toBe('Joinville');
    expect(query.specialty).toBe('Cardiologia');
    expect(query.insurance).toBe('América');
    expect(query.modality).toBe('in_person');
    expect(query.cursor).toBe('abc123');
    expect(query.limit).toBe(50);
  });

  it('should accept partial query parameters', () => {
    const partialQuery: DirectoryQuery = {
      specialty: 'Cardiologia',
    };

    expect(partialQuery).toBeDefined();
    expect(partialQuery.specialty).toBe('Cardiologia');
  });
});

describe('DirectoryPage type', () => {
  it('should have profiles and hasMore', () => {
    const page: DirectoryPage = {
      profiles: [{
        slug: 'test',
        name: 'Test',
        specialty: 'Test',
        crm: 'CRM/SC 123',
        rqe: 'RQE 456',
        bio: 'Bio',
        verified: true,
        claimed: false,
        updatedAt: '2026-01-01T00:00:00-03:00',
        location: {
          name: 'Consultório',
          address: 'Rua X',
          district: 'Centro',
          city: 'Joinville',
          state: 'SC',
          authorized: true,
        },
        insurances: [],
        modalities: ['Presencial'],
        availability: 'Aceita novos pacientes',
        contacts: {
          whatsApp: { verified: false, href: '#' },
          phone: { verified: true, href: 'tel:+554712345678' },
        },
      }],
      hasMore: false,
    };

    expect(page).toBeDefined();
    expect(page.profiles).toBeDefined();
    expect(page.hasMore).toBe(false);
  });

  it('should include nextCursor when hasMore is true', () => {
    const pageWithCursor: DirectoryPage = {
      profiles: [],
      hasMore: true,
      nextCursor: 'abc123',
    };

    expect(pageWithCursor).toBeDefined();
    expect(pageWithCursor.hasMore).toBe(true);
    expect(pageWithCursor.nextCursor).toBe('abc123');
  });
});

describe('PublicDirectoryReader interface', () => {
  it('should have getBySlug method', () => {
    const reader: PublicDirectoryReader = {
      getBySlug: vi.fn().mockResolvedValue({
        slug: 'test',
        name: 'Test',
        specialty: 'Test',
        crm: 'CRM/SC 123',
        rqe: 'RQE 456',
        bio: 'Bio',
        verified: true,
        claimed: false,
        updatedAt: '2026-01-01T00:00:00-03:00',
        location: {
          name: 'Consultório',
          address: 'Rua X',
          district: 'Centro',
          city: 'Joinville',
          state: 'SC',
          authorized: true,
        },
        insurances: [],
        modalities: ['Presencial'],
        availability: 'Aceita novos pacientes',
        contacts: {
          whatsApp: { verified: false, href: '#' },
          phone: { verified: true, href: 'tel:+554712345678' },
        },
      }),
      list: vi.fn().mockResolvedValue({
        profiles: [
          {
            slug: 'test',
            name: 'Test',
            specialty: 'Test',
            crm: 'CRM/SC 123',
            rqe: 'RQE 456',
            bio: 'Bio',
            verified: true,
            claimed: false,
            updatedAt: '2026-01-01T00:00:00-03:00',
            location: {
              name: 'Consultório',
              address: 'Rua X',
              district: 'Centro',
              city: 'Joinville',
              state: 'SC',
              authorized: true,
            },
            insurances: [],
            modalities: ['Presencial'],
            availability: 'Aceita novos pacientes',
            contacts: {
              whatsApp: { verified: false, href: '#' },
              phone: { verified: true, href: 'tel:+554712345678' },
            },
          },
        ],
        hasMore: false,
      }),
    };

    expect(reader).toBeDefined();
    expect(typeof reader.getBySlug).toBe('function');
    expect(typeof reader.list).toBe('function');
  });

  it('should return null for getBySlug', () => {
    const reader: PublicDirectoryReader = {
      getBySlug: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue({ profiles: [], hasMore: false }),
    };

    expect(reader.getBySlug('nonexistent')).resolves.toBeNull();
  });
});