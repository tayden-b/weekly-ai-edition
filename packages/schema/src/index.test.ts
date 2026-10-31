import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { generateEditionTypes, TYPES_PATH } from "./codegen.js";
import type { Edition } from "./edition.types.js";
import {
  EDITION_SCHEMA_VERSION,
  assertEdition,
  isEditionWeekId,
  pageDropped,
  validateEdition,
} from "./index.js";

const fixtureJson = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/2026-w44/edition.json", import.meta.url),
    "utf8",
  ),
) as Edition;

type MutValue = Record<string, unknown>;
type MutPage = MutValue & {
  type: string;
  items?: MutValue[];
  sources?: MutValue[];
  sentences?: string[];
  entries?: MutValue[];
  tickers?: MutValue[];
};
type MutEdition = MutValue & {
  id: string;
  date_start: string;
  date_end: string;
  pages: MutPage[];
};

const clone = (): MutEdition =>
  JSON.parse(JSON.stringify(fixtureJson)) as MutEdition;

const PAGE_TYPES = [
  "cover",
  "briefing",
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "markets",
  "discourse",
  "most_covered",
  "back_page",
] as const;

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
  it("is a positive integer", () => {
    expect(Number.isInteger(EDITION_SCHEMA_VERSION)).toBe(true);
    expect(EDITION_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe("validateEdition — 2026-w44 fixture", () => {
  it("validates the hand-built fixture", () => {
    const result = validateEdition(fixtureJson);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("covers every template page type in fixed order", () => {
    expect(fixtureJson.pages.map((p) => p.type)).toEqual(PAGE_TYPES);
  });

  it("assertEdition does not throw", () => {
    expect(() => assertEdition(fixtureJson)).not.toThrow();
  });

  it("accepts a page with nothing to say (empty content array, PLAN §3)", () => {
    const e = clone();
    e.pages[5]!.items = []; // funding
    e.pages[6]!.items = []; // deals
    e.pages[7]!.tickers = []; // markets
    e.pages[7]!.sources = [];
    (e.pages[7]!["chart"] as MutValue)["series"] = [];
    e.pages[9]!.entries = []; // most_covered
    const result = validateEdition(e);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("pageDropped (PLAN §3 drop rule)", () => {
  it("is true for an empty items/tickers/entries array, false otherwise", () => {
    const e = clone();
    const pages = e.pages as unknown as Edition["pages"];
    expect(pages.every((p) => !pageDropped(p))).toBe(true);

    const sparse = JSON.parse(JSON.stringify(fixtureJson)) as Edition;
    sparse.pages[2].items = [];
    sparse.pages[7].tickers = [];
    sparse.pages[9].entries = [];
    const dropped = sparse.pages.map(pageDropped);
    expect(dropped).toEqual([
      false, false, true, false, false, false, false, true, false, true, false,
    ]);
    // cover, briefing and back_page never drop
    expect(pageDropped(sparse.pages[0])).toBe(false);
    expect(pageDropped(sparse.pages[1])).toBe(false);
    expect(pageDropped(sparse.pages[10])).toBe(false);
  });
});

describe("validateEdition — rejects invalid editions", () => {
  it("rejects an item with zero sources", () => {
    const e = clone();
    e.pages[2]!.items![0]!["sources"] = [];
    const result = validateEdition(e);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/sources/);
  });

  it("rejects an item with no sources property", () => {
    const e = clone();
    delete e.pages[2]!.items![0]!["sources"];
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a page exceeding its maxItems cap", () => {
    const e = clone();
    const models = e.pages[2]!;
    models.items = [...models.items!, ...models.items!.slice(0, 2)];
    const result = validateEdition(e);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/more than 6 items/);
  });

  it("rejects a briefing outside 5–7 sentences", () => {
    const e = clone();
    const briefing = e.pages[1]!;
    briefing.sentences = [...briefing.sentences!, "One more.", "And another."];
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a link inside a briefing sentence", () => {
    const e = clone();
    e.pages[1]!.sentences![0] = "See https://example.com for details.";
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a performance item without evidence", () => {
    const e = clone();
    delete e.pages[3]!.items![0]!["evidence"];
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects evidence.source_index out of range", () => {
    const e = clone();
    (e.pages[3]!.items![0]!["evidence"] as MutValue)["source_index"] = 42;
    const result = validateEdition(e);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/out of range/);
  });

  it("rejects an evidence quote not found in the stored excerpt", () => {
    const e = clone();
    (e.pages[3]!.items![0]!["evidence"] as MutValue)["quote"] =
      "a quote that was never said";
    const result = validateEdition(e);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/not found verbatim/);
  });

  it("rejects a deal item with amount but no evidence", () => {
    const e = clone();
    const items = e.pages[6]!.items!;
    items[0]!["amount"] = "$9.9B";
    delete items[0]!["evidence"];
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a discourse headline not framed as a question", () => {
    const e = clone();
    e.pages[8]!.items![0]!["headline"] = "A statement, not a question.";
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a discourse item with a single source", () => {
    const e = clone();
    const items = e.pages[8]!.items!;
    items[0]!["sources"] = (items[0]!["sources"] as MutValue[]).slice(0, 1);
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects pages out of fixed template order", () => {
    const e = clone();
    const pages = e.pages;
    [pages[2], pages[3]] = [pages[3]!, pages[2]!] as [MutPage, MutPage];
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a bad week id", () => {
    const e = clone();
    e.id = "2026-W44";
    expect(validateEdition(e).ok).toBe(false);
  });

  it("rejects a reversed date range", () => {
    const e = clone();
    e.date_start = "2026-10-30";
    e.date_end = "2026-10-24";
    const result = validateEdition(e);
    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/date_start/);
  });

  it("rejects the deliberately broken testdata edition", () => {
    const broken = JSON.parse(
      readFileSync(
        new URL("../testdata/invalid-edition.json", import.meta.url),
        "utf8",
      ),
    );
    const result = validateEdition(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

describe("codegen sync", () => {
  it("edition.types.ts matches edition.schema.json", async () => {
    const generated = await generateEditionTypes();
    const committed = readFileSync(TYPES_PATH, "utf8");
    expect(committed).toBe(generated);
  });
});
