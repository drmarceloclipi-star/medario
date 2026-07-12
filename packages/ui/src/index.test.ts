import { describe, it, expect } from 'vitest';

describe('ui/index', () => {
  it('should export UI components', () => {
    // @ts-ignore - allow mocking
    const ui = require('./index');
    expect(ui).toBeDefined();
    expect(typeof ui).toBe('object');
    expect(ui).not.toBeNull();
  });

  it('should have re-exports from individual modules', () => {
    // @ts-ignore - allow mocking
    const ui = require('./index');
    expect(ui).not.toBeNull();
    expect(Object.keys(ui || {}).length).toBeGreaterThan(0);
  });
});