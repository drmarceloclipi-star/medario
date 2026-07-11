import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/apps/', '/packages/', '/functions/', '/docs/', '/node_modules/', '/conta'],
    },
    sitemap: 'https://medario.com.br/sitemap.xml',
  };
}
