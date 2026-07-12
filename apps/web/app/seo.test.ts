import { describe, it, expect } from 'vitest';

describe('seo', () => {
  it('should export SEO utilities', () => {
    // @ts-ignore - allow mocking
    const seo = require('./seo');
    expect(seo).toBeDefined();
    expect(typeof seo).toBe('object');
    expect(seo).not.toBeNull();
  });

  it('should have canIndexLocalDirectory function', () => {
    // @ts-ignore - allow mocking
    const seo = require('./seo');
    expect(seo.canIndexLocalDirectory).toBeDefined();
    expect(typeof seo.canIndexLocalDirectory).toBe('function');
  });

  it('should have publicProfileSitemapPath function', () => {
    // @ts-ignore - allow mocking
    const seo = require('./seo');
    expect(seo.publicProfileSitemapPath).toBeDefined();
    expect(typeof seo.publicProfileSitemapPath).toBe('function');
  });
});