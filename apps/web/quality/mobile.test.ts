import { describe, expect, it } from "vitest";

import { hasHorizontalOverflow, isSupportedMobileViewport, MOBILE_VIEWPORTS } from "./mobile";

describe("mobile quality rules", () => {
  it("covers every approved mobile viewport", () => {
    expect(MOBILE_VIEWPORTS).toEqual([360, 390, 412, 430]);
    expect(MOBILE_VIEWPORTS.every(isSupportedMobileViewport)).toBe(true);
  });

  it("detects horizontal overflow", () => {
    expect(hasHorizontalOverflow({ scrollWidth: 390, viewportWidth: 390 })).toBe(false);
    expect(hasHorizontalOverflow({ scrollWidth: 391, viewportWidth: 390 })).toBe(true);
  });
});
