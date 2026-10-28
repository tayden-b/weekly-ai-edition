import { describe, expect, it } from "vitest";

import { site } from "./site.js";

describe("site config", () => {
  it("uses the locked masthead name", () => {
    expect(site.name).toBe("The Weekly AI Edition");
  });
});
