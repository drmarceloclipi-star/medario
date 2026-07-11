import { describe, expect, it } from "vitest";

import { clusterMapLocations } from "../app/map-query";

describe("map query", () => {
  it("clusters authorized locations without changing the result set", () => {
    const clusters = clusterMapLocations([
      { doctorId: "a", label: "A", city: "Joinville", authorized: true, latitude: -26.3, longitude: -48.8 },
      { doctorId: "b", label: "B", city: "Joinville", authorized: true, latitude: -26.3001, longitude: -48.8001 },
      { doctorId: "c", label: "C", city: "Joinville", authorized: false, latitude: -26.4, longitude: -48.7 },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.doctorIds).toEqual(["a", "b"]);
  });
});
