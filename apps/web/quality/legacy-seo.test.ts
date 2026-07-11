import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), '../..');
const readRootFile = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('legacy public SEO contract', () => {
  it('serves canonical extensionless legacy URLs through Firebase Hosting', () => {
    const firebase = JSON.parse(readRootFile('firebase.json')) as { hosting: { cleanUrls?: boolean; trailingSlash?: boolean; headers?: Array<{ headers: Array<{ key: string; value: string }> }> } };

    expect(firebase.hosting.cleanUrls).toBe(true);
    expect(firebase.hosting.trailingSlash).toBe(false);
    const headers = Object.fromEntries(firebase.hosting.headers?.[0]?.headers.map(({ key, value }) => [key, value]) ?? []);
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Content-Security-Policy']).toContain('https://firestore.googleapis.com');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('geolocation=(self)');
  });

  it('keeps sparse directory and account pages outside search indexing', () => {
    expect(readRootFile('medicos/joinville.html')).toContain('<meta name="robots" content="noindex,follow">');
    expect(readRootFile('conta.html')).toContain('<meta name="robots" content="noindex,nofollow">');
  });

  it('publishes only confirmed public URLs in the legacy sitemap', () => {
    const sitemap = readRootFile('sitemap.xml');

    expect(sitemap).toContain('https://medario.com.br/medicos/mariana-andrade');
    expect(sitemap).not.toContain('joinville');
    expect(sitemap).not.toContain('conta');
  });
});
