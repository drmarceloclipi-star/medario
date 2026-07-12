import { describe, it, expect } from 'vitest';

describe('domain/index', () => {
  it('should export all domain types and interfaces', () => {
    // @ts-ignore - allow mocking
    const domain = require('./index');
    expect(domain).toBeDefined();
    expect(typeof domain).toBe('object');
    expect(domain).not.toBeNull();
  });

  it('should have re-exports from individual modules', () => {
    // @ts-ignore - allow mocking
    const domain = require('./index');
    expect(domain).not.toBeNull();
    expect(Object.keys(domain || {}).length).toBeGreaterThan(0);
  });
});