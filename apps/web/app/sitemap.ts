import type { MetadataRoute } from 'next';
import type { PublicProfile } from '@medario/domain';

import { createPublicProfileReader } from './profile-data';
import { canIndexLocalDirectory, publicProfileSitemapPath } from './seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const siteUrl = 'https://medario.com.br';
const legalRoutes = ['/institucional', '/privacidade', '/termos'] as const;
const uniqueContent = 'Diretório local com informações profissionais confirmadas sobre especialidades, CRM, RQE, convênios, modalidades e formas de contato em Joinville.';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let profiles: PublicProfile[] = [];

  try {
    profiles = (await (await createPublicProfileReader()).list({ limit: 100 })).profiles;
  } catch (error) {
    console.error('public sitemap profile load failed', error instanceof Error ? error.message : 'unknown error');
  }

  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'weekly' },
    ...legalRoutes.map((route) => ({ url: `${siteUrl}${route}`, changeFrequency: 'monthly' as const })),
    ...profiles.flatMap((profile) => {
      const path = publicProfileSitemapPath({ slug: profile.slug, updatedAt: profile.updatedAt, confirmed: profile.verified });
      return path ? [{ url: `${siteUrl}${path}`, lastModified: profile.updatedAt || undefined, changeFrequency: 'weekly' as const }] : [];
    }),
  ];

  const directoryIndexable = canIndexLocalDirectory({
    city: 'Joinville',
    uniqueContent,
    profiles: profiles.map((profile) => ({ slug: profile.slug, updatedAt: profile.updatedAt, confirmed: profile.verified })),
  });
  if (directoryIndexable) entries.push({ url: `${siteUrl}/medicos/joinville`, changeFrequency: 'weekly' });

  return entries;
}
