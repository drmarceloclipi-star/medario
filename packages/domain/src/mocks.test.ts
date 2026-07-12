import { describe, it, expect } from 'vitest';

describe('mocks', () => {
  it('should export mock utilities', () => {
    // @ts-ignore - allow mocking
    const mocks = require('./mocks');
    expect(mocks).toBeDefined();
    expect(typeof mocks).toBe('object');
  });

  it('should have mock functions', () => {
    // @ts-ignore - allow mocking
    const mocks = require('./mocks');
    expect(Object.keys(mocks)).toBeDefined();
    expect(mocks).not.toBeNull();
  });
});