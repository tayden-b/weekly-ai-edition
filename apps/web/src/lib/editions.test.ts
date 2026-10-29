import { describe, expect, it } from "vitest";

import {
  editionView,
  getEdition,
  latestEdition,
  listEditions,
} from "./editions";

describe("edition discovery (editions/ on disk)", () => {
  it("lists every public edition file reverse-chronologically", () => {
    const editions = listEditions();
    expect(editions.map((e) => e.id)).toEqual(["2026-w44"]);
  });

  it("excludes fixture-flagged artifacts from the public catalog", () => {
    // editions/2026-w45.json is committed for the CI gates but marked
    // fixture: true — no listing, no route, no latest redirect.
    expect(listEditions().some((e) => e.id === "2026-w45")).toBe(false);
    expect(getEdition("2026-w45")).toBeUndefined();
  });

  it("serves the newest public file as latest", () => {
    expect(latestEdition()?.id).toBe("2026-w44");
    expect(latestEdition()?.issue_number).toBe(1);
  });

  it("loads one edition by week id", () => {
    const edition = getEdition("2026-w44");
    expect(edition?.issue_number).toBe(1);
    expect(edition?.date_start).toBe("2026-10-24");
  });

  it("returns undefined for missing or malformed ids (no path traversal)", () => {
    expect(getEdition("2026-w99")).toBeUndefined();
    expect(getEdition("../etc/passwd")).toBeUndefined();
    expect(getEdition("not-a-week")).toBeUndefined();
  });

  it("maps the canonical schema onto view props", () => {
    const view = editionView(getEdition("2026-w44")!);
    expect(view.issue).toBe(1);
    expect(view.date_range.label).toBe("Oct 24–30");
    expect(view.pages).toHaveLength(11);
    expect(view.pages[0]?.headline).toBe("Gemini 4 Carbon");
  });
});
