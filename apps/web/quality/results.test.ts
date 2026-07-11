import { describe, expect, it } from "vitest";

import { searchDirectory } from "../app/results";

describe("intelligent results", () => {
  it("keeps sponsored profiles separate from organic ordering", () => {
    const results = searchDirectory({ filters: { specialty: "psiquiatria", city: "joinville" } }, "relevance", false);

    expect(results.organic.every((doctor) => !doctor.sponsored)).toBe(true);
    expect(results.sponsored.every((doctor) => doctor.sponsored)).toBe(true);
    expect(results.organic.map((doctor) => doctor.name)).toContain("Dra. Marina Alves");
  });

  it("does not expose distance without authorized patient location", () => {
    const results = searchDirectory({ filters: { specialty: "psiquiatria" } }, "distance", false);

    expect(results.organic.every((doctor) => doctor.distanceKm === undefined)).toBe(true);
  });

  it("sorts organic profiles by freshness when requested", () => {
    const results = searchDirectory({ filters: { specialty: "psiquiatria" } }, "updated", true);

    expect(results.organic[0]?.name).toBe("Dra. Helena Costa");
  });
});
