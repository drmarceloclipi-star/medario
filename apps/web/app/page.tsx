import type { Metadata } from 'next';

import { MobileShell } from './mobile-shell';
import { readJourneyUrl } from './journey-url';
import { createPublicProfileReader } from './profile-data';
import { directoryDoctorFromPublicProfile, fixtureDirectoryDoctors } from './results';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: true } };

async function loadDirectory() {
  if (process.env.MEDARIO_PUBLIC_PROFILE_SOURCE === 'fixture') return fixtureDirectoryDoctors;
  try {
    const page = await (await createPublicProfileReader()).list({ limit: 100 });
    return page.profiles.map(directoryDoctorFromPublicProfile);
  } catch (error) {
    console.error('public directory load failed', error instanceof Error ? error.message : 'unknown error');
    return [];
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
  }
  const { filters } = readJourneyUrl(query);
  const initialSearch = Object.keys(filters).length ? { filters, hasHealthSignal: false } : null;

  return <MobileShell initialDoctors={await loadDirectory()} initialSearch={initialSearch} />;
}
