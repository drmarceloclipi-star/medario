export type PublicSeoProfile = {
  slug: string;
  updatedAt: string;
  confirmed: boolean;
};

export type LocalDirectory = {
  city: string;
  specialty?: string;
  uniqueContent: string;
  profiles: readonly PublicSeoProfile[];
};

export function canIndexLocalDirectory(directory: LocalDirectory) {
  const eligibleProfiles = directory.profiles.filter((profile) => profile.confirmed && Boolean(profile.slug) && Boolean(profile.updatedAt));
  return eligibleProfiles.length >= 3 && directory.uniqueContent.trim().length >= 80;
}

export function localDirectoryRobots(directory: LocalDirectory) {
  return canIndexLocalDirectory(directory) ? 'index,follow' : 'noindex,follow';
}

export function publicProfileSitemapPath(profile: PublicSeoProfile) {
  return profile.confirmed ? `/medicos/${profile.slug}` : null;
}
