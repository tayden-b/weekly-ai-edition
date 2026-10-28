import { describe, expect, it } from "vitest";

import { PIPELINE_STAGES } from "./index.js";

describe("PIPELINE_STAGES", () => {
  it("starts with ingest and ends with validate", () => {
    expect(PIPELINE_STAGES[0]).toBe("ingest");
    expect(PIPELINE_STAGES.at(-1)).toBe("validate");
  });

  it("has unique stage names", () => {
    expect(new Set(PIPELINE_STAGES).size).toBe(PIPELINE_STAGES.length);
  });
});
