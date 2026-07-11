import { describe, expect, it } from "vitest";

import {
  deriveSearch,
  hasHealthSignal,
  isHistoryEntryCurrent,
  searchUrl,
  shouldPersistSearch,
} from "../app/search";

describe("conversational search privacy", () => {
  it("shares only derived objective filters, never free text", () => {
    const search = deriveSearch("Estou com ansiedade e preciso de psiquiatra em Joinville pela Unimed online");

    expect(searchUrl(search)).toBe("/?specialty=psiquiatria&city=joinville&insurance=unimed&modality=telemedicine");
    expect(searchUrl(search)).not.toContain("ansiedade");
  });

  it("recognizes health signals before persisting a raw query", () => {
    expect(hasHealthSignal("Estou com dor no peito")).toBe(true);
    expect(shouldPersistSearch("Estou com dor no peito", false)).toBe(false);
    expect(shouldPersistSearch("Psiquiatra em Joinville", false)).toBe(true);
  });

  it("expires history after 90 days", () => {
    expect(isHistoryEntryCurrent({ createdAt: "2026-04-12T12:00:00.000Z" }, new Date("2026-07-11T12:00:00.000Z"))).toBe(true);
    expect(isHistoryEntryCurrent({ createdAt: "2026-04-11T11:59:59.000Z" }, new Date("2026-07-11T12:00:00.000Z"))).toBe(false);
  });
});
