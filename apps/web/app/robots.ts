import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '').split(',')[0]!.trim().toLowerCase();
  const isAppHostingPreview = host.endsWith('.hosted.app') || host.endsWith('.run.app');
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
