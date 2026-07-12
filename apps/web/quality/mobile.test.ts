import { describe, it, expect } from 'vitest';
import { MOBILE_VIEWPORTS, hasHorizontalOverflow, isSupportedMobileViewport, LayoutMetrics } from './mobile';

describe('mobile', () => {
  it('should have mobile viewports', () => {
    expect(MOBILE_VIEWPORTS).toBeDefined();
    expect(MOBILE_VIEWPORTS[0]).toBe(360);
    expect(MOBILE_VIEWPORTS[1]).toBe(390);
    expect(MOBILE_VIEWPORTS[2]).toBe(412);
    expect(MOBILE_VIEWPORTS[3]).toBe(430);
  });

  it('should detect horizontal overflow', () => {
    expect(hasHorizontalOverflow({ scrollWidth: 800, viewportWidth: 375 })).toBe(true);
    expect(hasHorizontalOverflow({ scrollWidth: 400, viewportWidth: 375 })).toBe(true);
    expect(hasHorizontalOverflow({ scrollWidth: 375, viewportWidth: 375 })).toBe(false);
    expect(hasHorizontalOverflow({ scrollWidth: 370, viewportWidth: 375 })).toBe(false);
  });

  it('should detect no horizontal overflow', () => {
    expect(hasHorizontalOverflow({ scrollWidth: 375, viewportWidth: 375 })).toBe(false);
    expect(hasHorizontalOverflow({ scrollWidth: 360, viewportWidth: 412 })).toBe(false);
    expect(hasHorizontalOverflow({ scrollWidth: 390, viewportWidth: 412 })).toBe(false);
  });

  it('should support standard mobile viewports', () => {
    expect(isSupportedMobileViewport(360)).toBe(true);
    expect(isSupportedMobileViewport(390)).toBe(true);
    expect(isSupportedMobileViewport(412)).toBe(true);
    expect(isSupportedMobileViewport(430)).toBe(true);
    expect(isSupportedMobileViewport(412.5)).toBe(false);
  });

  it('should reject unsupported viewports', () => {
    expect(isSupportedMobileViewport(100)).toBe(false);
    expect(isSupportedMobileViewport(500)).toBe(false);
    expect(isSupportedMobileViewport(800)).toBe(false);
  });

  it('should handle exact viewport matches', () => {
    expect(isSupportedMobileViewport(360)).toBe(true);
    expect(isSupportedMobileViewport(412)).toBe(true);
  });

  it('should have correct LayoutMetrics type', () => {
    const metrics: LayoutMetrics = {
      scrollWidth: 800,
      viewportWidth: 375,
    };
    expect(metrics.scrollWidth).toBe(800);
    expect(metrics.viewportWidth).toBe(375);
  });
});