import { describe, expect, it } from "vitest";

import { EDITION_SCHEMA_VERSION, isEditionWeekId } from "./index.js";

describe("isEditionWeekId", () => {
  it("accepts canonical week ids", () => {
    expect(isEditionWeekId("2026-w44")).toBe(true);
    expect(isEditionWeekId("2026-w01")).toBe(true);
  });

  it("rejects malformed week ids", () => {
    expect(isEditionWeekId("2026-44")).toBe(false);
    expect(isEditionWeekId("2026-w4")).toBe(false);
    expect(isEditionWeekId("2026-w54")).toBe(false);
    expect(isEditionWeekId("w44")).toBe(false);
  });
});

describe("EDITION_SCHEMA_VERSION", () => {
  it("is a non-negative integer", () => {
    expect(Number.isInteger(EDITION_SCHEMA_VERSION)).toBe(true);
    expect(EDITION_SCHEMA_VERSION).toBeGreaterThanOrEqual(0);
  });
});
