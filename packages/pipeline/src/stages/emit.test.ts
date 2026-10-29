import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { emitEdition, EmitError, type EmitOptions } from "./emit.js";
import { loadCompaniesConfig, loadMarketsConfig } from "../config.js";
import type { ClassifiedCluster } from "./classify.js";
import type { ItemCluster } from "./dedupe.js";
import type { BriefingDraft, DraftedCluster } from "./draft.js";
import type { ExtractFieldName, ExtractedCluster } from "./extract.js";
import type { NormalizedItem } from "./normalize.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const COMPANIES = loadCompaniesConfig(join(ROOT, "config/companies.yaml"));
const MARKETS = loadMarketsConfig(join(ROOT, "config/markets.json"));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mkItem = (over: Partial<NormalizedItem>): NormalizedItem => ({
  adapter: "press-wires",
  headline: "H",
  canonical_url: "https://a.com/x",
  publisher: "P",
  published_at: "2026-10-28T09:00:00.000Z",
  fetched_at: "2026-10-28T12:00:00.000Z",
  excerpt: "Some excerpt text.",
  source_ids: { wire_id: "1" },
  title_key: "h",
  ...over,
});

interface MkOpts {
  page?: string;
  headline?: string;
  draftHeadline?: string;
  oneLiner?: string;
  excerpts?: string[];
  publishers?: string[];
  companySlugs?: string[];
  extracted?: Partial<Record<ExtractFieldName, string | number>>;
  adapter?: string;
  sourceIds?: Record<string, string>;
}

const mkDrafted = (id: string, o: MkOpts = {}): DraftedCluster => {
  const excerpts = o.excerpts ?? ["Some excerpt text."];
  const items = excerpts.map((excerpt, i) =>
    mkItem({
      canonical_url: `https://a.com/${id}-${i}`,
      excerpt,
      headline: o.headline ?? `H${i}`,
      publisher: o.publishers?.[i] ?? `Pub${i}`,
      adapter: o.adapter ?? "press-wires",
      source_ids: o.sourceIds ?? { wire_id: `${id}-${i}` },
    }),
  );
  const page = (o.page ?? "models") as ClassifiedCluster["classification"]["page"];
  const cluster: ItemCluster = { id, item: items[0]!, items };
  const fields: ExtractedCluster["extraction"]["fields"] = {};
  for (const [name, value] of Object.entries(o.extracted ?? {})) {
    fields[name as ExtractFieldName] = {
      value,
      evidence: { source_index: 0, quote: excerpts[0]! },
      method: "regex",
    };
  }
  return {
    ...cluster,
    classification: { page, confidence: 1, company_slugs: o.companySlugs ?? [], flags: [] },
    extraction: { page, fields, drops: [], flags: [] },
    draft: {
      ...(o.draftHeadline !== undefined ? { headline: o.draftHeadline } : {}),
      one_liner: o.oneLiner ?? "A one-liner about this story.",
      mono: {},
      drops: [],
      flags: [],
    },
  };
};

const BRIEFING: BriefingDraft = {
  sentences: [
    "Sentence one of the week.",
    "Sentence two of the week.",
    "Sentence three of the week.",
    "Sentence four of the week.",
    "Sentence five of the week.",
    "Sentence six of the week.",
  ],
  supports: {},
  drops: [],
  flags: [],
};

const emitOpts: EmitOptions = {
  id: "2026-w44",
  issue_number: 1,
  date_start: "2026-10-24",
  date_end: "2026-10-30",
  companies: COMPANIES,
  markets: MARKETS,
};

/** One emittable cluster per mandatory page — the minimal full edition. */
const fullWeek = (): DraftedCluster[] => [
  mkDrafted("models-1", { page: "models" }),
  mkDrafted("perf-1", {
    page: "performance",
    extracted: { metric_name: "Arena Edit", metric_value: "3" },
  }),
  mkDrafted("launches-1", { page: "launches" }),
  mkDrafted("funding-1", {
    page: "funding",
    companySlugs: ["anthropic"],
    extracted: { stage: "IPO" },
  }),
  mkDrafted("deals-1", {
    page: "deals",
    extracted: { acquirer: "Foo", target: "Bar" },
  }),
  mkDrafted("discourse-1", {
    page: "discourse",
    excerpts: ["Publisher one says the thing.", "Publisher two disagrees."],
    publishers: ["Axios", "Bloomberg"],
    draftHeadline: "Is this the week's biggest argument?",
  }),
  mkDrafted("markets-1", {
    page: "markets",
    extracted: { ticker: "AMD", close: 560.26 },
    excerpts: [
      "AMD weekly bars — week ending 2026-10-17: close 520.00",
      "week ending 2026-10-24: close 560.26",
    ],
  }),
];

describe("emitEdition", () => {
  it("is deterministic — same inputs emit a byte-identical edition", () => {
    const a = emitEdition(fullWeek(), BRIEFING, emitOpts).edition;
    const b = emitEdition(fullWeek(), BRIEFING, emitOpts).edition;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("emits every schema-mandatory page", () => {
    const { edition } = emitEdition(fullWeek(), BRIEFING, emitOpts);
    expect(edition.pages.map((p) => p.type)).toEqual([
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
    ]);
  });

  it("dedupes identical emitted headlines within a page", () => {
    const clusters = [
      ...fullWeek(),
      mkDrafted("models-2", {
        page: "models",
        draftHeadline: "Google ships Gemini 4 Carbon",
      }),
      mkDrafted("models-3", {
        page: "models",
        draftHeadline: "Google ships Gemini 4 Carbon",
      }),
    ];
    const { edition, emitted } = emitEdition(clusters, BRIEFING, emitOpts);
    const models = edition.pages.find((p) => p.type === "models")!;
    const headlines = (models as { items: { headline: string }[] }).items.map((i) => i.headline);
    expect(headlines.filter((h) => h === "Google ships Gemini 4 Carbon")).toHaveLength(1);
    expect(emitted.filter((r) => r.page === "models")).toHaveLength(2);
  });

  it("parses Stooq-style 'week ending …: close …' series for markets rows", () => {
    const { edition } = emitEdition(fullWeek(), BRIEFING, emitOpts);
    const markets = edition.pages.find((p) => p.type === "markets")!;
    const tickers = (markets as { tickers: { ticker: string; close: number; change_pct: number }[] }).tickers;
    const amd = tickers.find((t) => t.ticker === "AMD");
    expect(amd).toBeDefined();
    expect(amd!.close).toBe(560.26);
    // derived from the two parsed closes: 560.26/520.00 − 1 ≈ 7.74%
    expect(amd!.change_pct).toBeCloseTo(7.74, 1);
  });

  it("throws EmitError naming pages with no emittable items", () => {
    const onlyModels = [mkDrafted("models-1", { page: "models" })];
    expect(() => emitEdition(onlyModels, BRIEFING, emitOpts)).toThrow(EmitError);
    try {
      emitEdition(onlyModels, BRIEFING, emitOpts);
      expect.unreachable();
    } catch (err) {
      expect((err as EmitError).issues.join(" ")).toContain('page "performance"');
    }
  });
});
