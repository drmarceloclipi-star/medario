import { describe, it, expect } from 'vitest';

describe('legacy-seo', () => {
  it('should export legacy SEO utilities', () => {
    // @ts-ignore - allow mocking
    const legacySeo = require('./legacy-seo');
    expect(legacySeo).toBeDefined();
    expect(typeof legacySeo).toBe('object');
    expect(legacySeo).not.toBeNull();
  });
});