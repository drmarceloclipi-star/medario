import { describe, expect, it } from "vitest";

import { buildComparison, canAddToComparison } from "../app/comparison";

describe("criteria-led doctor comparison", () => {
  it("limits comparison to three profiles", () => {
    expect(canAddToComparison(["a", "b", "c"], "d")).toBe(false);
    expect(canAddToComparison(["a", "b"], "c")).toBe(true);
  });

  it("only explains compatibility for chosen criteria", () => {
    const comparison = buildComparison([{ id: "a", insurances: ["Unimed"], availability: "confirmed_slot", modalities: ["telemedicine"], updatedAt: "2026-07-10" }], ["insurance", "availability"]);

    expect(comparison[0]?.matchedCriteria).toEqual(["insurance", "availability"]);
    expect(comparison[0]?.explanation).toContain("2 de 2");
  });
});
