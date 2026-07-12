import { describe, it, expect } from 'vitest';

describe('sitemap', () => {
  it('should export sitemap generator', () => {
    // @ts-ignore - allow mocking
    const sitemap = require('./sitemap');
    expect(sitemap).toBeDefined();
    expect(typeof sitemap).toBe('object');
    expect(sitemap).not.toBeNull();
  });

  it('should have sitemap export', () => {
    // @ts-ignore - allow mocking
    const sitemap = require('./sitemap');
    expect(sitemap).not.toBeNull();
    expect(sitemap.dynamic).toBe('force-dynamic');
    expect(sitemap.revalidate).toBe(0);
  });
});