import { describe, expect, it } from "vitest";

import { orientSymptomSearch } from "../app/symptom-protocol";

describe("reviewed urgency protocol", () => {
  it("interrupts a potentially urgent report without a diagnosis", () => {
    const guidance = orientSymptomSearch("Estou com dor no peito e falta de ar");

    expect(guidance.kind).toBe("urgent");
    expect(guidance.message).not.toMatch(/infarto|diagnóstico/i);
  });

  it("offers an editable specialty path for a non-urgent report", () => {
    const guidance = orientSymptomSearch("Estou com ansiedade há semanas");

    expect(guidance.kind).toBe("orientation");
    expect(guidance.filters.specialty).toBe("psiquiatria");
  });
});
