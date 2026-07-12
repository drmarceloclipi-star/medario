import { describe, it, expect } from 'vitest';

describe('vitest.config', () => {
  it('should have test environment set to node', () => {
    // @ts-ignore - allow mocking
    const config = require('./vitest.config.ts') as any;
    expect(config.test.environment).toBe('node');
  });

  it('should have include pattern set', () => {
    // @ts-ignore - allow mocking
    const config = require('./vitest.config.ts') as any;
    expect(config.test.include).toContain('quality/**/*.test.ts');
  });
});