import { describe, expect, it } from 'vitest';

import { canIndexLocalDirectory, localDirectoryRobots, publicProfileSitemapPath } from '../app/seo';

const uniqueContent = 'Diretório local com informação editorial específica sobre acesso, especialidades e dados confirmados dos perfis médicos disponíveis nesta cidade.';

describe('SEO local', () => {
  it('indexes only a local directory with unique content and three confirmed profiles', () => {
    const directory = { city: 'Joinville', uniqueContent, profiles: [
      { slug: 'ana', updatedAt: '2026-07-10', confirmed: true },
      { slug: 'bia', updatedAt: '2026-07-10', confirmed: true },
      { slug: 'caio', updatedAt: '2026-07-10', confirmed: true },
    ] };

    expect(canIndexLocalDirectory(directory)).toBe(true);
    expect(localDirectoryRobots(directory)).toBe('index,follow');
  });

  it('keeps sparse directories searchable but out of the index', () => {
    const sparseDirectory = { city: 'Joinville', specialty: 'Psiquiatria', uniqueContent, profiles: [
      { slug: 'ana', updatedAt: '2026-07-10', confirmed: true },
      { slug: 'bia', updatedAt: '2026-07-10', confirmed: true },
    ] };

    expect(canIndexLocalDirectory(sparseDirectory)).toBe(false);
    expect(localDirectoryRobots(sparseDirectory)).toBe('noindex,follow');
  });

  it('never emits an unconfirmed profile in a sitemap', () => {
    expect(publicProfileSitemapPath({ slug: 'dra-marina', updatedAt: '2026-07-10', confirmed: true })).toBe('/medicos/dra-marina');
    expect(publicProfileSitemapPath({ slug: 'rascunho', updatedAt: '2026-07-10', confirmed: false })).toBeNull();
  });
});
