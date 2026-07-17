import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const uiCss = readFileSync(new URL("../../../packages/ui/src/styles.css", import.meta.url), "utf8");

function luminance(hex: string) {
  return [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("light theme color contract", () => {
  it("removes legacy dark-theme colors from app surfaces", () => {
    expect(`${appCss}\n${uiCss}`).not.toMatch(/#a8ccff|#15243a|#0b1726|color-scheme:\s*dark/i);
  });

  it("keeps primary text roles at WCAG AA contrast", () => {
    expect(contrast("#1d3557", "#f1faee")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#52687d", "#f1faee")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#356f91", "#f1faee")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#356f91")).toBeGreaterThanOrEqual(4.5);
  });
});
