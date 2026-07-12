import { describe, it, expect } from 'vitest';

describe('firebase/index', () => {
  it('should export Firebase client', () => {
    // @ts-ignore - allow mocking
    const firebase = require('./index');
    expect(firebase).toBeDefined();
    expect(typeof firebase).toBe('object');
    expect(firebase).not.toBeNull();
  });

  it('should have re-exports from individual modules', () => {
    // @ts-ignore - allow mocking
    const firebase = require('./index');
    expect(firebase).not.toBeNull();
    expect(Object.keys(firebase || {}).length).toBeGreaterThan(0);
  });
});