import { describe, it, expect } from 'vitest';

describe('playwright.config', () => {
  it('should have testDir set to e2e', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.testDir).toBe('./e2e');
  });

  it('should have fullyParallel set to true', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.fullyParallel).toBe(true);
  });

  it('should have forbidOnly based on CI environment', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.forbidOnly).toBe(false);
  });

  it('should have retries based on CI environment', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.retries).toBe(0);
  });

  it('should have baseURL set', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.use.baseURL).toBe('http://127.0.0.1:3100');
  });

  it('should have trace set to on-first-retry', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.use.trace).toBe('on-first-retry');
  });

  it('should have webServer configured', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.webServer).toBeDefined();
    expect(config.webServer.url).toBe('http://127.0.0.1:3100');
    expect(config.webServer.reuseExistingServer).toBe(false);
  });

  it('should have environment variables in webServer command', () => {
    // @ts-ignore - allow mocking
    const config = require('./playwright.config.ts') as any;
    expect(config.webServer.command).toContain('MEDARIO_PUBLIC_PROFILE_SOURCE=fixture');
  });
});