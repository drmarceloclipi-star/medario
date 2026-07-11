import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host') ?? '';
  const isAppHostingPreview = host.endsWith('.hosted.app');
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const publicOrigin = isLocal || !host ? 'https://medario.com.br' : `https://${host}`;

  if (isAppHostingPreview) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/apps/', '/packages/', '/functions/', '/docs/', '/node_modules/', '/conta'],
    },
    sitemap: `${publicOrigin}/sitemap.xml`,
  };
}
