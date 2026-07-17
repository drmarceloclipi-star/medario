import { describe, expect, it } from "vitest";
import { Button, Chip, IconButton, Input } from "@medario/ui";
import React from "react";

Object.assign(globalThis, { React });

describe("shared component classes", () => {
  it("preserves base classes when callers add a class", () => {
    expect(Button({ className: "send-button", children: "Buscar" }).props.className).toBe("mdr-button send-button");
    expect(IconButton({ className: "composer-action", label: "Filtros", children: "+" }).props.className).toBe("mdr-icon-button composer-action");
    expect(Input({ className: "search-input" }).props.className).toBe("mdr-input search-input");
    expect(Chip({ className: "quick-prompt", children: "Perto de mim" }).props.className).toBe("mdr-chip quick-prompt");
  });
});
