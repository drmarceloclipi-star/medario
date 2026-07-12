import { describe, it, expect } from 'vitest';

describe('saved-items', () => {
  it('should export saved items handler', () => {
    // @ts-ignore - allow mocking
    const savedItems = require('./saved-items');
    expect(savedItems).toBeDefined();
    expect(typeof savedItems).toBe('object');
    expect(savedItems).not.toBeNull();
  });
});