import { describe, it, expect } from 'vitest';

describe('ui/tokens', () => {
  it('should export design tokens', () => {
    // @ts-ignore - allow mocking
    const tokens = require('./tokens');
    expect(tokens).toBeDefined();
    expect(typeof tokens).toBe('object');
    expect(tokens).not.toBeNull();
  });

  it('should have token definitions', () => {
    // @ts-ignore - allow mocking
    const tokens = require('./tokens');
    expect(tokens).not.toBeNull();
    expect(Object.keys(tokens || {}).length).toBeGreaterThan(0);
  });
});