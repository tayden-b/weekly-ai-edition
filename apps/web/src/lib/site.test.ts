import { describe, expect, it } from "vitest";

import { site } from "./site";

describe("site config", () => {
  it("uses the locked masthead name", () => {
    expect(site.name).toBe("The Weekly AI Edition");
  });
});
