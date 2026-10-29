import { describe, expect, it } from "vitest";

import {
  editionView,
  getEdition,
  latestEdition,
  listEditions,
} from "./editions";

describe("edition discovery (editions/ on disk)", () => {
  it("lists every edition file reverse-chronologically", () => {
    const editions = listEditions();
    expect(editions.map((e) => e.id)).toEqual(["2026-w45", "2026-w44"]);
  });

  it("serves the newest file as latest — adding a newer file flips it", () => {
    expect(latestEdition()?.id).toBe("2026-w45");
    expect(latestEdition()?.issue_number).toBe(2);
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
    const view = editionView(getEdition("2026-w45")!);
    expect(view.issue).toBe(2);
    expect(view.date_range.label).toBe("Oct 31–Nov 6");
    expect(view.pages).toHaveLength(11);
    expect(view.pages[0]?.headline).toBe("Agents start signing in for you");
  });
});
