import { MobileShell } from './mobile-shell';
import { createPublicProfileReader } from './profile-data';
import { directoryDoctorFromPublicProfile, fixtureDirectoryDoctors } from './results';

export const dynamic = 'force-dynamic';

async function loadDirectory() {
  if (process.env.MEDARIO_PUBLIC_PROFILE_SOURCE === 'fixture') return fixtureDirectoryDoctors;
  try {
    const page = await (await createPublicProfileReader()).list({ limit: 100 });
    return page.profiles.map(directoryDoctorFromPublicProfile);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  return <MobileShell initialDoctors={await loadDirectory()} />;
}
