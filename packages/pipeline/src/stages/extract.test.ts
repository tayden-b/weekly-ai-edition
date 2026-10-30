import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createReplayExtractor,
  createSessionExtractor,
  extractionPaths,
  writeExtractionRequest,
  readExtractionResponse,
} from "../llm.js";
import {
  applyExtraction,
  buildExtractionRequest,
  extract,
  ExtractionContractError,
  type ExtractionResponse,
  EXTRACT_PROMPT_VERSION,
  normalizeStage,
  parseUsdAmount,
  regexExtract,
  renderExtractPrompt,
} from "./extract.js";
import type { ClassifiedCluster } from "./classify.js";
import type { ItemCluster } from "./dedupe.js";
import type { NormalizedItem } from "./normalize.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mkItem = (over: Partial<NormalizedItem>): NormalizedItem => ({
  adapter: "fixture",
  headline: "H",
  canonical_url: "https://a.com/x",
  publisher: "P",
  published_at: "2026-10-28T09:00:00.000Z",
  fetched_at: "2026-10-28T12:00:00.000Z",
  excerpt: "Some excerpt text.",
  source_ids: { fixture_id: "1" },
  title_key: "h",
  ...over,
});

const mkCluster = (
  page: string,
  excerpts: string[],
  headline = "H",
): ClassifiedCluster => {
  const items = excerpts.map((excerpt, i) =>
    mkItem({ canonical_url: `https://a.com/x${i}`, excerpt }),
  );
  const cluster: ItemCluster = {
    id: items[0]!.canonical_url,
    item: mkItem({ headline }),
    items,
  };
  return {
    ...cluster,
    classification: { page: page as never, confidence: 1, company_slugs: [], flags: [] },
  };
};

const mkResponse = (entries: ExtractionResponse["items"]): ExtractionResponse => ({
  prompt_version: EXTRACT_PROMPT_VERSION,
  items: entries,
});

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "p5-extract-"));
  tmpDirs.push(d);
  return d;
};

// ---------------------------------------------------------------------------
// Deterministic extraction — known amounts → correct extraction
// ---------------------------------------------------------------------------

describe("parseUsdAmount", () => {
  it.each([
    ["$100 million", "$100M", 100_000_000],
    ["$12.85M", "$12.85M", 12_850_000],
    ["$15 billion", "$15B", 15_000_000_000],
    ["$11.57B", "$11.57B", 11_570_000_000],
    ["USD 5bn", "$5B", 5_000_000_000],
    ["2 trillion USD", "$2T", 2_000_000_000_000],
    ["$850,000", "$850K", 850_000],
  ])("parses %s → %s / %s", (raw, display, usd) => {
    expect(parseUsdAmount(raw)).toEqual({ display, usd });
  });
  it("rejects non-amounts", () => {
    expect(parseUsdAmount("Series A")).toBeUndefined();
    expect(parseUsdAmount("fifteen billion")).toBeUndefined();
  });
});

describe("regexExtract — funding", () => {
  it("extracts amount, stage and lead with verbatim evidence", () => {
    const excerpt =
      "Foundry Robotics today announced its oversubscribed $100 million Series A funding round led by Marlinspike Partners. Participating in the round are early backers Khosla Ventures.";
    const { fields } = regexExtract(mkCluster("funding", [excerpt]), "funding");
    expect(fields.amount?.value).toBe("$100M");
    expect(fields.amount_usd?.value).toBe(100_000_000);
    expect(fields.stage?.value).toBe("Series A");
    expect(fields.lead_investor?.value).toBe("Marlinspike Partners");
    // Every field's quote is verbatim in the excerpt.
    for (const f of [fields.amount, fields.stage, fields.lead_investor]) {
      expect(f).toBeDefined();
      expect(excerpt.includes(f!.evidence.quote)).toBe(true);
      expect(f!.evidence.source_index).toBe(0);
      expect(f!.method).toBe("regex");
    }
    // amount_usd inherits the amount's evidence.
    expect(fields.amount_usd?.evidence).toEqual(fields.amount?.evidence);
  });

  it("does not name the sentence subject or a participant as lead", () => {
    const excerpt =
      "Acme Corp announced $5M in funding led by Greycroft, with participation from Anthropic and Menlo Ventures.";
    const { fields } = regexExtract(mkCluster("funding", [excerpt]), "funding");
    expect(fields.lead_investor?.value).toBe("Greycroft");
    expect(fields.lead_investor?.evidence.quote).toBe("Greycroft");
  });

  it("taps a lead named in a later source — source_index points at it", () => {
    const { fields } = regexExtract(
      mkCluster("funding", [
        "Anthropic S-1 Reveals Rapid Growth Ahead of Blockbuster IPO",
        "the company behind Claude has tapped JPMorgan Chase to lead the US retail offering.",
      ]),
      "funding",
    );
    expect(fields.stage?.value).toBe("IPO");
    expect(fields.stage?.evidence.source_index).toBe(0);
    expect(fields.lead_investor?.value).toBe("JPMorgan Chase");
    expect(fields.lead_investor?.evidence.source_index).toBe(1);
  });
});

describe("regexExtract — deals", () => {
  it("extracts acquirer/target/amount from possessive form", () => {
    const excerpt = "US agency approves Amazon Leo’s $11.5B acquisition of Globalstar";
    const { fields } = regexExtract(mkCluster("deals", [excerpt]), "deals");
    expect(fields.acquirer?.value).toBe("Amazon Leo");
    expect(fields.target?.value).toBe("Globalstar");
    expect(fields.amount?.value).toBe("$11.5B");
    expect(fields.amount_usd?.value).toBe(11_500_000_000);
  });

  it("rejects a lowercase clause as acquirer (proper-name gate)", () => {
    const excerpt =
      "CoStar Group, Inc. (NASDAQ: CSGP) announced today that it has entered into a definitive agreement to acquire Vexcel Group, Inc.";
    const { fields } = regexExtract(mkCluster("deals", [excerpt]), "deals");
    // "into a definitive agreement" must never take the acquirer slot.
    expect(fields.acquirer?.value).not.toBe("into a definitive agreement");
    expect(fields.acquirer).toBeUndefined();
    expect(fields.target?.value).toBe("Vexcel Group");
  });

  it("extracts target from 'announced the completion of the acquisition of Y'", () => {
    const excerpt =
      "Ridgeview Partners LLC (“Ridgeview”), a growth-oriented technology private equity firm, today announced the completion of the acquisition of Pinewood Technologies Group plc (“Pinewood.AI”), a leading provider";
    const { fields } = regexExtract(mkCluster("deals", [excerpt]), "deals");
    expect(fields.target?.value).toBe("Pinewood Technologies Group plc");
    expect(fields.acquirer).toBeUndefined(); // subject sits behind an appositive → model fill
  });
});

describe("regexExtract — performance + markets", () => {
  it("extracts metric name/value pairs", () => {
    const { fields } = regexExtract(
      mkCluster("performance", ["removing them from DeepSeek-V4.1-Flash costs 36.8 PopQA points."]),
      "performance",
    );
    expect(fields.metric_value?.value).toBe("36.8");
    expect(fields.metric_name?.value).toBe("PopQA");
  });

  it("extracts ticker/close/change_pct from the markets excerpt shape", () => {
    const excerpt =
      "NVIDIA (NVDA) week ending 2026-10-30: close 192.44, +4.3% vs prior weekly close 184.62 (Stooq weekly bars, i=w).";
    const { fields } = regexExtract(mkCluster("markets", [excerpt]), "markets");
    expect(fields.ticker?.value).toBe("NVDA");
    expect(fields.close?.value).toBe(192.44);
    expect(fields.change_pct?.value).toBe(4.3);
  });

  it("keeps the sign on a down week", () => {
    const excerpt =
      "Meta Platforms (META) week ending 2026-10-30: close 711.20, -2.1% vs prior weekly close 726.45 (Stooq weekly bars, i=w).";
    const { fields } = regexExtract(mkCluster("markets", [excerpt]), "markets");
    expect(fields.change_pct?.value).toBe(-2.1);
  });
});

// ---------------------------------------------------------------------------
// The containment gate — fabricated evidence is dropped + recorded
// ---------------------------------------------------------------------------

describe("evidence containment gate", () => {
  const cluster = mkCluster("funding", [
    "Acme Corp announced $5M in funding led by Greycroft.",
  ]);
  const base = buildExtractionRequest([cluster], { week: "w" });

  it("drops a fabricated quote and records the violation", () => {
    const response = mkResponse([
      {
        id: cluster.id,
        fields: [
          { field: "stage", value: "Series A", source_index: 0, quote: "Series A round" },
        ],
      },
    ]);
    const [out] = applyExtraction([cluster], base, response);
    expect(out!.extraction.fields.stage).toBeUndefined();
    expect(out!.extraction.drops).toContainEqual(
      expect.objectContaining({ field: "stage", reason: "quote-not-in-excerpt", method: "llm" }),
    );
    expect(out!.extraction.flags).toContain("missing:stage");
  });

  it("drops a quote cited against the wrong source_index", () => {
    const two = mkCluster("funding", [
      "Acme Corp announced $5M in funding.",
      "Acme's statement said investors included Mercury Fund.",
    ]);
    const req = buildExtractionRequest([two], {});
    const response = mkResponse([
      {
        id: two.id,
        fields: [
          // "Mercury Fund" is verbatim only in source 1 — citing 0 drops it.
          { field: "lead_investor", value: "Mercury Fund", source_index: 0, quote: "Mercury Fund" },
        ],
      },
    ]);
    const [out] = applyExtraction([two], req, response);
    expect(out!.extraction.fields.lead_investor).toBeUndefined();
    expect(out!.extraction.drops).toContainEqual(
      expect.objectContaining({ field: "lead_investor", reason: "quote-not-in-excerpt", source_index: 0 }),
    );
  });

  it("drops out-of-range source_index and unknown fields", () => {
    const response = mkResponse([
      {
        id: cluster.id,
        fields: [
          { field: "stage", value: "Series A", source_index: 9, quote: "Series A" },
          { field: "valuation", value: "$900M", source_index: 0, quote: "$5M" },
          { field: "stage", value: "Seed", source_index: 0, quote: "funding" },
        ],
      },
    ]);
    const [out] = applyExtraction([cluster], base, response);
    const reasons = out!.extraction.drops.map((d) => `${d.field}:${d.reason}`);
    expect(reasons).toContain("stage:source-index-out-of-range");
    expect(reasons).toContain("valuation:unknown-field");
    // "funding" is a verbatim quote but does not spell out the value "Seed" —
    // the value↔quote coherence gate drops it.
    expect(reasons).toContain("stage:value-not-in-quote");
    expect(out!.extraction.fields.stage).toBeUndefined();
  });

  it("drops fields the page does not carry", () => {
    const perf = mkCluster("performance", ["Model X shows real gains on SWE-bench."]);
    const req = buildExtractionRequest([perf], {});
    const response = mkResponse([
      {
        id: perf.id,
        fields: [
          { field: "lead_investor", value: "Greycroft", source_index: 0, quote: "SWE-bench" },
        ],
      },
    ]);
    const [out] = applyExtraction([perf], req, response);
    expect(out!.extraction.drops).toContainEqual(
      expect.objectContaining({ field: "lead_investor", reason: "field-not-on-page" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Response contract — structural malformation throws
// ---------------------------------------------------------------------------

describe("response contract", () => {
  const cluster = mkCluster("funding", ["Acme Corp announced $5M in funding."]);
  const base = buildExtractionRequest([cluster], { week: "w" });

  it("throws on prompt_version mismatch", () => {
    expect(() =>
      applyExtraction([cluster], base, { prompt_version: 99, items: [] }),
    ).toThrow(ExtractionContractError);
  });

  it("throws on missing, extra, and duplicate ids", () => {
    expect(() =>
      applyExtraction([cluster], base, mkResponse([])),
    ).toThrow(/missing id/);
    expect(() =>
      applyExtraction(
        [cluster],
        base,
        mkResponse([
          { id: cluster.id, fields: [] },
          { id: "ghost", fields: [] },
        ]),
      ),
    ).toThrow(/unknown id/);
    expect(() =>
      applyExtraction(
        [cluster],
        base,
        mkResponse([
          { id: cluster.id, fields: [] },
          { id: cluster.id, fields: [] },
        ]),
      ),
    ).toThrow(/repeats id/);
  });

  it("throws on malformed field entries", () => {
    const bad = (fields: unknown[]) =>
      applyExtraction([cluster], base, {
        prompt_version: EXTRACT_PROMPT_VERSION,
        items: [{ id: cluster.id, fields }],
      } as unknown as ExtractionResponse);
    expect(() => bad(["stage"])).toThrow(ExtractionContractError);
    expect(() => bad([{ field: 1, value: "x", source_index: 0, quote: "q" }])).toThrow(
      ExtractionContractError,
    );
    expect(() =>
      bad([{ field: "stage", value: "x", source_index: 1.5, quote: "q" }]),
    ).toThrow(ExtractionContractError);
    expect(() =>
      bad([{ field: "stage", value: "x", source_index: 0, quote: 3 }]),
    ).toThrow(ExtractionContractError);
  });
});

// ---------------------------------------------------------------------------
// buildExtractionRequest — only gaps go to the model
// ---------------------------------------------------------------------------

describe("buildExtractionRequest", () => {
  it("asks only for unfilled llm-eligible fields, skipping non-extract pages", () => {
    const full = mkCluster("funding", [
      "Acme Corp announced its $100 million Series A funding round led by Marlinspike Partners.",
    ]);
    const gap = mkCluster("funding", ["Acme Corp announced $12.85M in funding led by Greycroft."]);
    const other = mkCluster("launches", ["Acme shipped a launch."]);
    const req = buildExtractionRequest([full, gap, other], { week: "w", styleRev: "abc" });
    expect(req.items.map((i) => i.id)).toEqual([gap.id]);
    expect(req.items[0]!.missing_fields).toEqual(["stage"]);
    expect(req.items[0]!.extracted.amount?.value).toBe("$12.85M");
    expect(req.items[0]!.sources).toHaveLength(1);
    expect(req.items[0]!.sources[0]!.excerpt).toContain("$12.85M");
    expect(req.week).toBe("w");
    expect(req.style_rev).toBe("abc");
    expect(req.prompt_version).toBe(EXTRACT_PROMPT_VERSION);
  });
});

// ---------------------------------------------------------------------------
// extract() — seam routing
// ---------------------------------------------------------------------------

describe("extract", () => {
  it("routes through the seam and attaches extraction to every cluster", async () => {
    const gap = mkCluster("deals", [
      "Hummingbird, the compliance platform, today announced the acquisition of Quantimon.",
    ]);
    const seen: string[] = [];
    const llm = {
      extract: async (r: Parameters<typeof buildExtractionRequest>[0] extends never[] ? never : import("./extract.js").ExtractionRequest) => {
        seen.push("called");
        expect(r.items).toHaveLength(1);
        return mkResponse([
          {
            id: gap.id,
            fields: [{ field: "acquirer", value: "Hummingbird", source_index: 0, quote: "Hummingbird" }],
          },
        ]);
      },
    };
    const out = await extract([gap], { llm, week: "w" });
    expect(seen).toEqual(["called"]);
    expect(out[0]!.extraction.fields.acquirer?.value).toBe("Hummingbird");
    expect(out[0]!.extraction.fields.acquirer?.method).toBe("llm");
    expect(out[0]!.extraction.fields.target?.value).toBe("Quantimon");
    expect(out[0]!.extraction.fields.target?.method).toBe("regex");
  });

  it("never calls the seam when nothing is missing", async () => {
    const full = mkCluster("funding", [
      "Acme announced its $100 million Series A funding round led by Marlinspike Partners.",
    ]);
    const other = mkCluster("launches", ["Acme shipped a launch."]);
    const llm = {
      extract: async () => {
        throw new Error("seam must not be called");
      },
    };
    const out = await extract([full, other], { llm });
    expect(out[0]!.extraction.fields.amount?.value).toBe("$100M");
    expect(out[1]!.extraction.fields).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// llm seam + prompt
// ---------------------------------------------------------------------------

describe("extract llm seam", () => {
  it("replay returns the recorded response verbatim", async () => {
    const response = mkResponse([{ id: "x", fields: [] }]);
    const llm = createReplayExtractor(response);
    expect(await llm.extract(buildExtractionRequest([], {}))).toBe(response);
  });

  it("writeExtractionRequest emits request + rendered prompt; reader round-trips", () => {
    const dir = tmp();
    const cluster = mkCluster("funding", ["Acme Corp announced $5M in funding."]);
    const request = buildExtractionRequest([cluster], { week: "w", styleRev: "abc" });
    const paths = writeExtractionRequest(dir, request, "Week {{WEEK_ID}} {{ITEMS_JSON}}");
    const written = JSON.parse(readFileSync(paths.requestPath, "utf8"));
    expect(written.items[0].id).toBe(cluster.id);
    expect(readFileSync(paths.promptPath, "utf8")).toContain("Week w");
    writeFileSync(paths.responsePath, `${JSON.stringify(mkResponse([{ id: cluster.id, fields: [] }]))}\n`);
    const round = readExtractionResponse(dir);
    expect(round).toEqual(mkResponse([{ id: cluster.id, fields: [] }]));
  });

  it("session impl returns a pre-filled response file", async () => {
    const dir = tmp();
    const paths = extractionPaths(dir);
    const response = mkResponse([{ id: "x", fields: [] }]);
    writeFileSync(paths.responsePath, JSON.stringify(response));
    const llm = createSessionExtractor({ dir, promptTemplate: "{{ITEMS_JSON}}", pollMs: 5 });
    expect(await llm.extract(buildExtractionRequest([], {}))).toEqual(response);
  });
});

describe("renderExtractPrompt", () => {
  it("substitutes all placeholders", () => {
    const request = buildExtractionRequest(
      [mkCluster("funding", ["Acme Corp announced $5M in funding led by Greycroft."])],
      { week: "w1", styleRev: "abc" },
    );
    const out = renderExtractPrompt(
      "{{WEEK_ID}}|{{STYLE_MD_GIT_SHA}}|{{PROMPT_VERSION}}|{{ITEMS_JSON}}",
      request,
    );
    expect(out).toContain(`w1|abc|${EXTRACT_PROMPT_VERSION}|`);
    expect(out).toContain("missing_fields");
    expect(out).not.toContain("{{");
  });

  it("shipped prompt file carries the version the stage expects", () => {
    const prompt = readFileSync(
      join(__dirname, "../../prompts/extract.prompt.md"),
      "utf8",
    );
    const fm = prompt.match(/^prompt_version:\s*(\d+)/m);
    expect(fm).not.toBeNull();
    expect(Number(fm![1])).toBe(EXTRACT_PROMPT_VERSION);
    expect(prompt).toContain("stage: extract");
  });
});

// ---------------------------------------------------------------------------
// End-to-end replay on the recorded labelled set
// ---------------------------------------------------------------------------

describe("recorded extraction replay", () => {
  const dataDir = join(__dirname, "../../testdata/extraction");
  const labeled = JSON.parse(
    readFileSync(join(dataDir, "extract-items.json"), "utf8"),
  ) as {
    items: {
      id: string;
      page: string;
      members: { headline: string; url: string; publisher: string; published_at: string; excerpt: string }[];
      expect: {
        fields: Record<string, string | number>;
        missing?: string[];
      };
    }[];
  };

  const clusters: ClassifiedCluster[] = labeled.items.map((i) => {
    const members = i.members.map((m) =>
      mkItem({
        headline: m.headline,
        canonical_url: m.url,
        publisher: m.publisher,
        published_at: m.published_at,
        excerpt: m.excerpt,
      }),
    );
    return {
      id: i.id,
      item: members[0]!,
      items: members,
      classification: { page: i.page as never, confidence: 1, company_slugs: [], flags: [] },
    };
  });

  it("replays the recorded response and every shipped quote is verbatim", async () => {
    const response = JSON.parse(
      readFileSync(join(dataDir, "extraction.response.json"), "utf8"),
    ) as ExtractionResponse;
    const out = await extract(clusters, { llm: createReplayExtractor(response) });
    const byId = new Map(out.map((c) => [c.id, c]));
    for (const item of labeled.items) {
      const got = byId.get(item.id)!;
      for (const [name, value] of Object.entries(item.expect.fields)) {
        const f = got.extraction.fields[name as keyof typeof got.extraction.fields];
        expect(f, `${item.id}.${name}`).toBeDefined();
        expect(f!.value).toEqual(value);
        const src = item.members[f!.evidence.source_index]!;
        expect(src.excerpt.includes(f!.evidence.quote)).toBe(true);
      }
      for (const name of item.expect.missing ?? []) {
        expect(got.extraction.fields[name as keyof typeof got.extraction.fields]).toBeUndefined();
        expect(got.extraction.flags).toContain(`missing:${name}`);
      }
      // No violation drops on the recorded happy path.
      expect(got.extraction.drops.filter((d) => d.reason !== "already-extracted")).toEqual([]);
    }
  });
});

describe("normalizeStage", () => {
  it.each([
    ["series b", "Series B"],
    ["Series C+", "Series C+"],
    ["seed", "Seed"],
    ["pre-seed", "Pre-seed"],
    ["ipo", "IPO"],
    ["growth round", "Growth"],
    ["bridge", "Bridge"],
  ])("maps %s → %s", (raw, want) => {
    expect(normalizeStage(raw)).toBe(want);
  });
});
