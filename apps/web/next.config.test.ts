import { describe, it, expect, vi } from 'vitest';
import type { NextConfig } from 'next';
import { dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('next.config', () => {
  it('should have output mode set to standalone', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.output).toBe('standalone');
  });

  it('should transpile packages', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.transpilePackages).toBeDefined();
  });

  it('should have security headers configured', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.headers).toBeDefined();
    expect(config.default.headers[0].headers[0].key).toBe('Content-Security-Policy');
  });

  it('should have redirects configured', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.redirects).toBeDefined();
    expect(config.default.redirects[0].source).toBe('/institucional.html');
    expect(config.default.redirects[0].destination).toBe('/institucional');
  });

  it('should have reactStrictMode enabled', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.reactStrictMode).toBe(true);
  });

  it('should have outputFileTracingRoot set', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.outputFileTracingRoot).toBeDefined();
  });

  it('should have turbopack configured', () => {
    // @ts-ignore - allow mocking
    const config = require('./next.config.ts') as { default: NextConfig };
    expect(config.default.turbopack).toBeDefined();
  });
});