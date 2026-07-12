import { describe, it, expect } from 'vitest';

describe('search', () => {
  it('should export search handler', () => {
    // @ts-ignore - allow mocking
    const search = require('./search');
    expect(search).toBeDefined();
    expect(typeof search).toBe('object');
    expect(search).not.toBeNull();
  });
});