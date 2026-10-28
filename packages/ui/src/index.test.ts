import { describe, expect, it } from "vitest";

import { colors } from "./index.js";

const HEX_RE = /^#[0-9A-F]{6}$/;

describe("color tokens", () => {
  it("match DESIGN.md light scheme values", () => {
    expect(colors.light.paper).toBe("#F4F3EF");
    expect(colors.light.ink).toBe("#111111");
    expect(colors.light.accent).toBe("#D9281C");
  });

  it("are all 6-digit hex", () => {
    for (const scheme of Object.values(colors)) {
      for (const value of Object.values(scheme)) {
        expect(value).toMatch(HEX_RE);
      }
    }
  });
});
