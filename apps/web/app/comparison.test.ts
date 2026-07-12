import { describe, it, expect } from 'vitest';

describe('comparison', () => {
  it('should export comparison utilities', () => {
    // @ts-ignore - allow mocking
    const comparison = require('./comparison');
    expect(comparison).toBeDefined();
    expect(typeof comparison).toBe('object');
    expect(comparison).not.toBeNull();
  });
});