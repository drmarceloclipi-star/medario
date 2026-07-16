import type { Metadata } from 'next';

import { MobileShell } from './mobile-shell';
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

export default async function HomePage() {
  return <MobileShell initialDoctors={await loadDirectory()} />;
}
