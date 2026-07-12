import { describe, it, expect } from 'vitest';

describe('robots', () => {
  it('should export robots generator', () => {
    // @ts-ignore - allow mocking
    const robots = require('./robots');
    expect(robots).toBeDefined();
    expect(typeof robots).toBe('object');
    expect(robots).not.toBeNull();
  });

  it('should have robots export', () => {
    // @ts-ignore - allow mocking
    const robots = require('./robots');
    expect(robots).not.toBeNull();
    expect(robots.dynamic).toBe('force-dynamic');
  });
});