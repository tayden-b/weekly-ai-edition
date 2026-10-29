import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  createReplayDrafter,
  createReplayDrafterFromFile,
  createSessionDrafter,
  draftPaths,
  readDraftResponse,
  writeDraftRequest,
} from "../llm.js";
import {
  applyDraft,
  assertDraftResponse,
  bannedHits,
  bannedOpeningHit,
  bannedOpeningsFromStyle,
  bannedTermsFromStyle,
  BRIEFING_MAX_SENTENCES,
  BRIEFING_MIN_SENTENCES,
  buildDraftRequest,
  canonNumber,
  draft,
  DRAFT_PAGES,
  DRAFT_PROMPT_VERSION,
  DraftContractError,
  type DraftOptions,
  type DraftRequest,
  type DraftResponse,
  fundingCompany,
  fundingHeadline,
  isDraftPage,
  normalizeTake,
  numberTokens,
  numberTraced,
  ONE_LINER_MAX_CHARS,
  proseKey,
  renderDraftPrompt,
  splitSentences,
  styleRulesFromStyleMd,
} from "./draft.js";
import type { ClassifiedCluster } from "./classify.js";
import { loadCompaniesConfig } from "../config.js";
import type { ItemCluster } from "./dedupe.js";
import type { ExtractFieldName, ExtractedCluster } from "./extract.js";
import { EXTRACT_FIELD_NAMES } from "./extract.js";
import type { NormalizedItem } from "./normalize.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../../..");
const STYLE_MD = readFileSync(join(ROOT, "STYLE.md"), "utf8");
const COMPANIES = loadCompaniesConfig(join(ROOT, "config/companies.yaml"));
const RULES = styleRulesFromStyleMd(STYLE_MD);

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

interface MkClusterOpts {
  page?: string;
  headline?: string;
  excerpts?: string[];
  memberHeadlines?: string[];
  publishers?: string[];
  companySlugs?: string[] | undefined;
  extracted?: Partial<Record<ExtractFieldName, string | number>> | undefined;
}

const mkCluster = (id: string, o: MkClusterOpts = {}): ExtractedCluster => {
  const excerpts = o.excerpts ?? ["Some excerpt text."];
  const items = excerpts.map((excerpt, i) =>
    mkItem({
      canonical_url: `https://a.com/${id}-${i}`,
      excerpt,
      headline: o.memberHeadlines?.[i] ?? o.headline ?? `H${i}`,
      publisher: o.publishers?.[i] ?? `Pub${i}`,
    }),
  );
  const page = (o.page ?? "models") as ClassifiedCluster["classification"]["page"];
  const cluster: ItemCluster = {
    id,
    item: items[0]!,
    items,
  };
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
    classification: {
      page,
      confidence: 1,
      company_slugs: o.companySlugs ?? [],
      flags: [],
    },
    extraction: { page, fields, drops: [], flags: [] },
  };
};

const mkResponse = (
  clusters: readonly ExtractedCluster[],
  over: Partial<DraftResponse> = {},
): DraftResponse => {
  const items = clusters.filter((c) => isDraftPage(c.classification.page));
  const okResponse = {
    prompt_version: DRAFT_PROMPT_VERSION,
    one_liners: items.map((c) => ({
      item_id: c.id,
      one_liner: "Drafted one-liner for this item.",
      ...(c.classification.page === "discourse"
        ? { headline: "Is this the week's biggest argument?" }
        : {}),
    })),
    briefing: {
      sentences: items.slice(0, 5).map(() => "A sentence tying the week together."),
      supports: Object.fromEntries(
        items.slice(0, 5).map((c, i) => [String(i), [c.id]]),
      ),
    },
  };
  return { ...okResponse, ...over } as DraftResponse;
};

const applyOpts = { companies: COMPANIES, rules: RULES };

const draftOpts = (over: Partial<DraftOptions> = {}): DraftOptions => ({
  llm: { draft: async (r) => r as unknown as DraftResponse },
  companies: COMPANIES,
  styleMd: STYLE_MD,
  ...over,
});

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "p6-draft-"));
  tmpDirs.push(d);
  return d;
};

// ---------------------------------------------------------------------------
// Prose helpers
// ---------------------------------------------------------------------------

describe("splitSentences", () => {
  it("splits on terminal punctuation", () => {
    expect(splitSentences("One. Two? Three!")).toEqual(["One.", "Two?", "Three!"]);
  });
  it("does not split decimals or initialisms", () => {
    expect(splitSentences("Costs 36.8 PopQA points, and the U.S. acted. Next."))
      .toEqual(["Costs 36.8 PopQA points, and the U.S. acted.", "Next."]);
    expect(splitSentences("Amazon Leo's $11.5B buy cleared.")).toHaveLength(1);
  });
  it("does not split abbreviations", () => {
    expect(splitSentences("OpenAI vs. the rest. Second.")).toEqual([
      "OpenAI vs. the rest.",
      "Second.",
    ]);
  });
});

describe("numberTokens / canonNumber / numberTraced", () => {
  it("extracts number-like tokens", () => {
    expect(numberTokens("raised $100M and 10,322 votes, up 36.8%")).toEqual(
      expect.arrayContaining(["$100M", "10,322", "36.8%"]),
    );
  });
  it("canonicalizes money spellings and grouped digits", () => {
    expect(canonNumber("$100M")).toBe(canonNumber("$100 million"));
    expect(canonNumber("10,322")).toBe(canonNumber("10322"));
    expect(canonNumber("$15B")).toBe(canonNumber("$15 billion"));
    expect(canonNumber("36.8%")).not.toBe(canonNumber("36.8"));
  });
  it("traces numbers through spelling variants and substrings", () => {
    const sources = ["raised $15 billion in one round", "rank: 2 · rating: 1516.16649584179"];
    expect(numberTraced("$15B", sources)).toBe(true);
    expect(numberTraced("1516", sources)).toBe(true); // substring of 1516.166…
    expect(numberTraced("2", sources)).toBe(true);
    expect(numberTraced("$10B", sources)).toBe(false);
  });
});

describe("STYLE.md mechanical parse", () => {
  it("parses §7 banned words with suffix alternations", () => {
    const { words } = bannedTermsFromStyle(STYLE_MD);
    for (const w of ["revolutionary", "game-changer", "game-changing", "turbocharge", "turbocharged", "unleashed", "massive"]) {
      expect(words, w).toContain(w);
    }
  });
  it("parses §7 quoted phrase bans", () => {
    const { phrases } = bannedTermsFromStyle(STYLE_MD);
    for (const p of ["raises questions", "paradigm shift", "delve", "some say"]) {
      expect(phrases, p).toContain(p);
    }
    // Usage notes and meta-text are not bans.
    expect(phrases).not.toContain("rose");
    expect(phrases).not.toContain("fell");
    expect(phrases.every((p) => !/r5|reviewer-enforced/.test(p))).toBe(true);
  });
  it("parses all six §2 banned openings", () => {
    const openings = bannedOpeningsFromStyle(STYLE_MD);
    for (const o of ["in a move that", "this week,", "just announced", "x just dropped", "big news", "icymi"]) {
      expect(openings, o).toContain(o);
    }
  });
  it("flags banned words and openings in produced text", () => {
    expect(bannedHits("This unprecedented release.", RULES)).toContain("unprecedented");
    expect(bannedHits("A paradigm shift in tooling.", RULES)).toContain("paradigm shift");
    expect(bannedOpeningHit("In a move that shook the sector, x.", RULES)).toBe("in a move that");
    expect(bannedOpeningHit("Gemini just dropped a model.", RULES)).toBe("x just dropped");
    expect(bannedOpeningHit("A quiet release shipped.", RULES)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Request building / prompt rendering
// ---------------------------------------------------------------------------

describe("buildDraftRequest", () => {
  it("keeps item-bearing pages and skips markets + unsorted", () => {
    const clusters = [
      mkCluster("m1", { page: "models" }),
      mkCluster("mk1", { page: "markets" }),
      mkCluster("u1", { page: "unsorted" }),
      mkCluster("f1", { page: "funding" }),
    ];
    const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
    expect(req.items.map((i) => i.id)).toEqual(["m1", "f1"]);
    expect(req.prompt_version).toBe(DRAFT_PROMPT_VERSION);
    expect(req.style_md).toBe(STYLE_MD);
  });
  it("carries extracted fields, companies, and member excerpts", () => {
    const c = mkCluster("f1", {
      page: "funding",
      companySlugs: ["foundry-robotics"],
      extracted: { amount: "$100M", stage: "Series A" },
      excerpts: ["x raised $100 million Series A."],
    });
    const req = buildDraftRequest([c], COMPANIES, { styleMd: STYLE_MD });
    expect(req.items[0]!.extracted.amount).toBe("$100M");
    expect(req.items[0]!.companies).toEqual([
      { slug: "foundry-robotics", name: "Foundry Robotics" },
    ]);
    expect(req.items[0]!.sources[0]!.excerpt).toContain("$100 million");
  });
});

describe("renderDraftPrompt", () => {
  it("substitutes items and STYLE.md verbatim", () => {
    const req = buildDraftRequest([mkCluster("m1")], COMPANIES, {
      week: "w",
      styleRev: "abc",
      styleMd: "STYLE_BODY",
    });
    const rendered = renderDraftPrompt("{{WEEK_ID}}|{{STYLE_MD_GIT_SHA}}|{{PROMPT_VERSION}}|{{ITEMS_JSON}}|{{STYLE_MD}}", req);
    expect(rendered).toContain("w|abc|1|");
    expect(rendered).toContain('"id": "m1"');
    expect(rendered).toContain("STYLE_BODY");
    expect(rendered).not.toContain("{{");
  });
});

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

describe("assertDraftResponse", () => {
  const clusters = [mkCluster("m1", { page: "models" }), mkCluster("f1", { page: "funding" })];
  const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
  const good = mkResponse(clusters);

  it("accepts the well-formed response", () => {
    expect(() => assertDraftResponse(req, good)).not.toThrow();
  });
  it("throws on prompt_version mismatch", () => {
    expect(() => assertDraftResponse(req, { ...good, prompt_version: 99 })).toThrow(DraftContractError);
  });
  it("throws on missing, extra, and duplicate ids", () => {
    const missing = { ...good, one_liners: good.one_liners.slice(0, 1) };
    expect(() => assertDraftResponse(req, missing)).toThrow(/missing id "f1"/);
    const extra = { ...good, one_liners: [...good.one_liners, { item_id: "nope", one_liner: "x" }] };
    expect(() => assertDraftResponse(req, extra)).toThrow(/unknown id "nope"/);
    const dupe = { ...good, one_liners: [...good.one_liners, good.one_liners[0]!] };
    expect(() => assertDraftResponse(req, dupe)).toThrow(/repeats id "m1"/);
  });
  it("throws on malformed entries and briefing supports", () => {
    const bad = {
      ...good,
      one_liners: [{ item_id: "m1", one_liner: "x" }, { item_id: "f1" }],
    };
    expect(() => assertDraftResponse(req, bad)).toThrow(/one_liner/);
    const badSupports = {
      ...good,
      briefing: { sentences: good.briefing.sentences, supports: { "99": ["m1"] } },
    };
    expect(() => assertDraftResponse(req, badSupports)).toThrow(/supports/);
  });
});

// ---------------------------------------------------------------------------
// Enforcement — applyDraft
// ---------------------------------------------------------------------------

describe("applyDraft — one_liner enforcement", () => {
  const clusters = [mkCluster("m1", { page: "models", headline: "Original headline" })];
  const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
  const applyTo = (resp: DraftResponse) => applyDraft(clusters, req, resp, applyOpts);

  it("takes the first sentence of a multi-sentence one-liner", () => {
    const out = applyTo(mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: "First sentence here. Second goes away." }],
    }));
    expect(out.clusters[0]!.draft.one_liner).toBe("First sentence here.");
    expect(out.clusters[0]!.draft.flags).toContain("one-liner-multi-sentence");
  });
  it("truncates over-140 one-liners at a word boundary", () => {
    const long = "A".repeat(160) + " tail ends here now.";
    const out = applyTo(mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: long }],
    }));
    const lin = out.clusters[0]!.draft.one_liner!;
    expect(lin.length).toBeLessThanOrEqual(ONE_LINER_MAX_CHARS);
    expect(lin.endsWith(".")).toBe(true);
    expect(out.clusters[0]!.draft.flags).toContain("one-liner-truncated");
  });
  it("keeps 'U.S.' out of the sentence split", () => {
    const out = applyTo(mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: "Days after the U.S. ordered removal, the round landed." }],
    }));
    expect(out.clusters[0]!.draft.one_liner).toBe(
      "Days after the U.S. ordered removal, the round landed.",
    );
  });
  it("strips links, emoji, mono markers and '!'", () => {
    const out = applyTo(mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: "Big **42** news https://x.com/y now! 🔥" }],
    }));
    const lin = out.clusters[0]!.draft.one_liner!;
    expect(lin).not.toMatch(/https?|\*|!|🔥/);
    expect(out.clusters[0]!.draft.flags).toEqual(
      expect.arrayContaining(["link-stripped", "emoji-stripped", "markers-stripped", "exclamation-removed"]),
    );
  });
  it("flags a one-liner that restates the headline", () => {
    const out = applyTo(mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: "Original headline." }],
    }));
    expect(out.clusters[0]!.draft.flags).toContain("one-liner-equals-headline");
  });
  it("flags untraced numbers and banned words", () => {
    const out = applyTo(mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: "An unprecedented 77 percent rise in usage." }],
    }));
    expect(out.clusters[0]!.draft.flags).toEqual(
      expect.arrayContaining(["banned-word:unprecedented", "untraced-number:77"]),
    );
  });
});

describe("applyDraft — headline rules", () => {
  it("generates the funding headline deterministically, dropping the model's", () => {
    const c = mkCluster("f1", {
      page: "funding",
      companySlugs: ["foundry-robotics"],
      extracted: { amount: "$100M", stage: "Series A", lead_investor: "Marlinspike Partners" },
    });
    const req = buildDraftRequest([c], COMPANIES, { styleMd: STYLE_MD });
    const resp = mkResponse([c], {
      one_liners: [{ item_id: "f1", one_liner: "x.", headline: "Model's own headline" }],
    });
    const out = applyDraft([c], req, resp, applyOpts);
    expect(out.clusters[0]!.draft.headline).toBe(
      "Foundry Robotics raised $100M Series A led by Marlinspike Partners",
    );
    expect(out.clusters[0]!.draft.drops).toEqual([
      { field: "headline", reason: "funding-headline-generated", detail: "Model's own headline" },
    ]);
  });
  it("falls back to 'an undisclosed amount' when no amount is public", () => {
    const c = mkCluster("f2", {
      page: "funding",
      companySlugs: ["deepseek"],
      extracted: { stage: "Series B" },
    });
    const req = buildDraftRequest([c], COMPANIES, { styleMd: STYLE_MD });
    const out = applyDraft([c], req, mkResponse([c]), applyOpts);
    expect(out.clusters[0]!.draft.headline).toBe("DeepSeek raised an undisclosed amount Series B");
  });
  it("requires the discourse headline to be a question", () => {
    const c = mkCluster("d1", {
      page: "discourse",
      publishers: ["A", "B"],
      excerpts: ["side one", "side two"],
    });
    const req = buildDraftRequest([c], COMPANIES, { styleMd: STYLE_MD });
    const bad = mkResponse([c], {
      one_liners: [{ item_id: "d1", one_liner: "x.", headline: "Not a question" }],
    });
    const out = applyDraft([c], req, bad, applyOpts);
    expect(out.clusters[0]!.draft.headline).toBeUndefined();
    expect(out.clusters[0]!.draft.flags).toContain("discourse-headline-unresolved");
    const good = mkResponse([c], {
      one_liners: [{ item_id: "d1", one_liner: "x.", headline: "Whose turn is it?" }],
    });
    const out2 = applyDraft([c], req, good, applyOpts);
    expect(out2.clusters[0]!.draft.headline).toBe("Whose turn is it?");
  });
});

describe("applyDraft — takes and quota", () => {
  it("keeps one take per page and drops the rest", () => {
    const clusters = [
      mkCluster("m1", { page: "models" }),
      mkCluster("m2", { page: "models" }),
      mkCluster("d1", { page: "discourse" }),
    ];
    const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
    const resp = mkResponse(clusters, {
      one_liners: clusters.map((c) => ({
        item_id: c.id,
        one_liner: `Liner ${c.id}.`,
        take: `Take for ${c.id}.`,
        ...(c.classification.page === "discourse" ? { headline: "Q?" } : {}),
      })),
    });
    const out = applyDraft(clusters, req, resp, applyOpts);
    expect(out.clusters[0]!.draft.take).toBe("Take for m1.");
    expect(out.clusters[1]!.draft.take).toBeUndefined();
    expect(out.clusters[1]!.draft.flags).toContain("take-dropped-quota");
    expect(out.clusters[2]!.draft.take).toBeUndefined();
    expect(out.clusters[2]!.draft.drops).toEqual(
      expect.arrayContaining([{ field: "take", reason: "take-on-discourse", detail: "Take for d1." }]),
    );
  });
  it("normalizes marked-up take text to bare text", () => {
    expect(normalizeTake(" — *The real story.*")).toBe("The real story.");
    expect(normalizeTake("*Bare.*")).toBe("Bare.");
    expect(normalizeTake("Plain text.")).toBe("Plain text.");
  });
});

describe("applyDraft — mono flagging for the renderer", () => {
  it("derives mono fields from extraction, not prose", () => {
    const c = mkCluster("p1", {
      page: "performance",
      extracted: { metric_value: "36.8", metric_name: "PopQA" },
    });
    const req = buildDraftRequest([c], COMPANIES, { styleMd: STYLE_MD });
    const out = applyDraft([c], req, mkResponse([c]), applyOpts);
    expect(out.clusters[0]!.draft.mono.number).toBe("36.8");
    const f = mkCluster("f1", {
      page: "funding",
      extracted: { amount: "$11.5B", stage: "Series A", lead_investor: "Lead" },
      companySlugs: ["amazon"],
    });
    const req2 = buildDraftRequest([f], COMPANIES, { styleMd: STYLE_MD });
    const out2 = applyDraft([f], req2, mkResponse([f]), applyOpts);
    expect(out2.clusters[0]!.draft.mono).toEqual({
      amount: "$11.5B",
      stage: "Series A",
      lead: "Lead",
    });
  });
  it("flags missing required mono fields rather than inventing them", () => {
    const c = mkCluster("p1", { page: "performance" });
    const req = buildDraftRequest([c], COMPANIES, { styleMd: STYLE_MD });
    const out = applyDraft([c], req, mkResponse([c]), applyOpts);
    expect(out.clusters[0]!.draft.flags).toContain("missing:number");
  });
});

describe("applyDraft — briefing", () => {
  const clusters = [
    mkCluster("m1", { page: "models" }),
    mkCluster("f1", { page: "funding", companySlugs: ["deepseek"], extracted: { amount: "$15B" } }),
  ];
  const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });

  it("drops briefing sentences containing links", () => {
    const resp = mkResponse(clusters, {
      briefing: {
        sentences: ["Fine one.", "See https://x.com/a", "Fine two.", "Fine three.", "Fine four.", "Fine five."],
        supports: { "0": ["m1"], "1": ["m1"], "2": ["f1"], "3": ["m1"], "4": ["f1"], "5": ["m1"] },
      },
    });
    const out = applyDraft(clusters, req, resp, applyOpts);
    expect(out.briefing.sentences).toHaveLength(5);
    expect(out.briefing.sentences.every((s) => !s.includes("http"))).toBe(true);
    expect(out.briefing.drops).toContainEqual(
      { field: "sentence", reason: "briefing-link-or-empty", detail: "See https://x.com/a" },
    );
  });
  it("drops unmapped sentences and unknown support ids", () => {
    const resp = mkResponse(clusters, {
      briefing: {
        sentences: ["A.", "B.", "C.", "D.", "E."],
        supports: { "0": ["m1"], "2": ["ghost"], "3": ["m1"], "4": ["f1"] },
      },
    });
    const out = applyDraft(clusters, req, resp, applyOpts);
    expect(out.briefing.sentences).toHaveLength(3);
    expect(out.briefing.drops.map((d) => d.reason)).toEqual(
      expect.arrayContaining(["unmapped-sentence", "support-unknown-id"]),
    );
    // supports re-index to emitted positions.
    expect(Object.keys(out.briefing.supports)).toEqual(["0", "1", "2"]);
  });
  it("caps the briefing at 7 and flags under 5", () => {
    const long = mkResponse(clusters, {
      briefing: {
        sentences: Array.from({ length: 9 }, (_, i) => `S${i}.`),
        supports: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [String(i), ["m1"]])),
      },
    });
    const out = applyDraft(clusters, req, long, applyOpts);
    expect(out.briefing.sentences).toHaveLength(BRIEFING_MAX_SENTENCES);
    const short = mkResponse(clusters, {
      briefing: { sentences: ["A.", "B.", "C."], supports: { "0": ["m1"], "1": ["m1"], "2": ["f1"] } },
    });
    const out2 = applyDraft(clusters, req, short, applyOpts);
    expect(out2.briefing.sentences).toHaveLength(3);
    expect(out2.briefing.flags).toContain("briefing-short:3");
  });
});

// ---------------------------------------------------------------------------
// Rubric
// ---------------------------------------------------------------------------

describe("rubricCheck", () => {
  it("passes a conforming draft", () => {
    const clusters = [
      mkCluster("f1", {
        page: "funding",
        companySlugs: ["foundry-robotics"],
        extracted: { amount: "$100M", stage: "Series A", lead_investor: "Marlinspike Partners" },
        excerpts: ["raised $100 million Series A led by Marlinspike Partners."],
      }),
      mkCluster("d1", {
        page: "discourse",
        publishers: ["A", "B"],
        excerpts: ["one side", "the other"],
      }),
      mkCluster("m1", { page: "models" }),
      mkCluster("p1", { page: "performance", extracted: { metric_value: "36.8" }, excerpts: ["costs 36.8 points."] }),
      mkCluster("l1", { page: "launches" }),
    ];
    const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
    const resp = mkResponse(clusters, {
      briefing: {
        sentences: ["A.", "B.", "C.", "D.", "E."],
        supports: { "0": ["m1"], "1": ["f1"], "2": ["d1"], "3": ["p1"], "4": ["l1"] },
      },
    });
    const out = applyDraft(clusters, req, resp, applyOpts);
    expect(out.rubric.pass).toBe(true);
    for (const c of out.rubric.checks) {
      expect(c.status, `${c.id}: ${c.details.join(";")}`).not.toBe("fail");
    }
  });
  it("fails R7 when a discourse item lacks a question headline", () => {
    const clusters = [
      mkCluster("d1", { page: "discourse", publishers: ["A", "B"], headline: "Flat claim" }),
      mkCluster("m1", { page: "models" }),
    ];
    const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
    const resp = mkResponse(clusters, {
      one_liners: [{ item_id: "d1", one_liner: "x.", headline: "Not a question" }, { item_id: "m1", one_liner: "y." }],
    });
    const out = applyDraft(clusters, req, resp, applyOpts);
    const r7 = out.rubric.checks.find((c) => c.id === "R7")!;
    expect(r7.status).toBe("fail");
    expect(out.rubric.pass).toBe(false);
  });
  it("fails R6/R12 when prose carries untraced numbers", () => {
    const clusters = [mkCluster("m1", { page: "models", excerpts: ["a plain excerpt"] })];
    const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });
    const resp = mkResponse(clusters, {
      one_liners: [{ item_id: "m1", one_liner: "A 42% rise in usage." }],
    });
    const out = applyDraft(clusters, req, resp, applyOpts);
    expect(out.clusters[0]!.draft.flags).toContain("untraced-number:42%");
    expect(out.rubric.checks.find((c) => c.id === "R6")!.status).toBe("fail");
    expect(out.rubric.checks.find((c) => c.id === "R12")!.status).toBe("fail");
  });
});

// ---------------------------------------------------------------------------
// draft() — the stage, plus the seam
// ---------------------------------------------------------------------------

describe("draft", () => {
  it("skips the seam when no draft-page cluster exists", async () => {
    const clusters = [mkCluster("mk1", { page: "markets" }), mkCluster("u1", { page: "unsorted" })];
    const llm = { draft: async () => { throw new Error("seam must not be called"); } };
    const out = await draft(clusters, draftOpts({ llm }));
    expect(out.clusters[0]!.draft.one_liner).toBeUndefined();
    expect(out.briefing.sentences).toEqual([]);
  });
  it("routes through the seam and attaches draft + briefing + rubric", async () => {
    const clusters = [mkCluster("m1", { page: "models" }), mkCluster("f1", { page: "funding", companySlugs: ["deepseek"], extracted: { amount: "$15B" } })];
    const out = await draft(clusters, draftOpts({ llm: createReplayDrafter(mkResponse(clusters)) }));
    expect(out.clusters.every((c) => c.draft !== undefined)).toBe(true);
    expect(out.briefing.sentences.length).toBe(2);
    expect(out.rubric.checks.map((c) => c.id)).toHaveLength(14);
  });
});

describe("draft llm seam", () => {
  const clusters = [mkCluster("m1", { page: "models" })];
  const req = buildDraftRequest(clusters, COMPANIES, { styleMd: STYLE_MD });

  it("replay returns the recorded response verbatim", async () => {
    const resp = mkResponse(clusters);
    expect(await createReplayDrafter(resp).draft(req)).toBe(resp);
  });
  it("writeDraftRequest emits request + rendered prompt; reader round-trips", () => {
    const dir = tmp();
    const paths = writeDraftRequest(dir, req, "tpl {{ITEMS_JSON}} {{STYLE_MD}}");
    expect(readFileSync(paths.requestPath, "utf8")).toContain('"m1"');
    expect(readFileSync(paths.promptPath, "utf8")).toContain('"id": "m1"');
    writeFileSync(paths.responsePath, JSON.stringify(mkResponse(clusters)));
    const back = readDraftResponse(dir);
    expect(back.prompt_version).toBe(DRAFT_PROMPT_VERSION);
    expect(createReplayDrafterFromFile(paths.responsePath)).toBeDefined();
  });
  it("session impl returns a pre-filled response file", async () => {
    const dir = tmp();
    const llm = createSessionDrafter({ dir, promptTemplate: "t", pollMs: 5, timeoutMs: 5000 });
    const { responsePath } = draftPaths(dir);
    setTimeout(() => writeFileSync(responsePath, JSON.stringify(mkResponse(clusters))), 10);
    const back = await llm.draft(req);
    expect(back.prompt_version).toBe(DRAFT_PROMPT_VERSION);
  });
});

describe("shipped draft.prompt.md", () => {
  const prompt = readFileSync(join(ROOT, "packages/pipeline/prompts/draft.prompt.md"), "utf8");
  it("carries the prompt_version the stage expects", () => {
    expect(prompt).toMatch(new RegExp(`prompt_version:\\s*${DRAFT_PROMPT_VERSION}\\b`));
  });
  it("has the placeholders renderDraftPrompt fills", () => {
    for (const ph of ["{{ITEMS_JSON}}", "{{STYLE_MD}}", "{{WEEK_ID}}", "{{STYLE_MD_GIT_SHA}}", "{{PROMPT_VERSION}}"]) {
      expect(prompt).toContain(ph);
    }
  });
});

// ---------------------------------------------------------------------------
// Funding helpers
// ---------------------------------------------------------------------------

describe("fundingHeadline / fundingCompany", () => {
  it("composes the house format", () => {
    expect(fundingHeadline("Acme", { amount: "$10M", stage: "Series A", lead: "Lead Co" })).toBe(
      "Acme raised $10M Series A led by Lead Co",
    );
    expect(fundingHeadline("Acme", {})).toBe("Acme raised an undisclosed amount");
    expect(fundingHeadline(undefined, { amount: "$1M" })).toBeUndefined();
  });
  it("picks the tagged company, inferring when ambiguous", () => {
    const single = mkCluster("f", { page: "funding", companySlugs: ["deepseek"] });
    expect(fundingCompany(single, COMPANIES)).toEqual({ name: "DeepSeek", inferred: false });
    const multi = mkCluster("f", {
      page: "funding",
      companySlugs: ["amazon", "globalstar"],
      headline: "Globalstar raises new capital",
    });
    expect(fundingCompany(multi, COMPANIES).name).toBe("Globalstar");
    expect(fundingCompany(multi, COMPANIES).inferred).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Labelled set + recorded replay — the deterministic CI proof
// ---------------------------------------------------------------------------

describe("labelled draft set", () => {
  const dataDir = join(ROOT, "packages/pipeline/testdata/draft");
  const labeled = JSON.parse(readFileSync(join(dataDir, "draft-items.json"), "utf8")) as {
    pages: string[];
    items: {
      id: string;
      page: string;
      members: { headline: string; url: string; publisher: string; published_at: string; excerpt: string }[];
      companies?: string[];
      extracted?: Record<string, string | number>;
      expect: { headline?: string; headline_pattern?: string };
    }[];
  };

  it("has ≥10 items and covers every drafted page ≥2×", () => {
    expect(labeled.items.length).toBeGreaterThanOrEqual(10);
    const counts = new Map<string, number>();
    for (const i of labeled.items) counts.set(i.page, (counts.get(i.page) ?? 0) + 1);
    for (const p of DRAFT_PAGES) expect(counts.get(p) ?? 0, p).toBeGreaterThanOrEqual(2);
    expect(counts.get("markets")).toBeGreaterThanOrEqual(1);
    expect(counts.get("unsorted")).toBeGreaterThanOrEqual(1);
  });
  it("has unique ids, real https urls, ≤300-char excerpts, declared pages", () => {
    const pages = new Set(labeled.pages);
    const ids = labeled.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of labeled.items) {
      expect(i.id).toMatch(/^[a-z]+-\d{3}$/);
      expect(pages.has(i.page), i.id).toBe(true);
      for (const m of i.members) {
        expect(m.url, i.id).toMatch(/^https:\/\/[^\s/]+\.[^\s/]+\//);
        expect(m.excerpt.length, i.id).toBeLessThanOrEqual(300);
      }
    }
  });
  it("uses registry company slugs and real extract fields only", () => {
    const slugs = new Set(COMPANIES.map((c) => c.slug));
    const fields = new Set<string>(EXTRACT_FIELD_NAMES);
    for (const i of labeled.items) {
      for (const s of i.companies ?? []) expect(slugs.has(s), `${i.id}:${s}`).toBe(true);
      for (const f of Object.keys(i.extracted ?? {})) expect(fields.has(f), `${i.id}:${f}`).toBe(true);
    }
  });
  it("gives every discourse cluster ≥2 publishers (R8)", () => {
    for (const i of labeled.items.filter((i) => i.page === "discourse")) {
      expect(new Set(i.members.map((m) => m.publisher)).size, i.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("recorded draft replay", () => {
  const dataDir = join(ROOT, "packages/pipeline/testdata/draft");
  const labeled = JSON.parse(readFileSync(join(dataDir, "draft-items.json"), "utf8")) as {
    items: {
      id: string;
      page: string;
      members: { headline: string; url: string; publisher: string; published_at: string; excerpt: string }[];
      companies?: string[];
      extracted?: Record<string, string | number>;
      expect: { headline?: string; headline_pattern?: string };
    }[];
  };

  const clusters: ExtractedCluster[] = labeled.items.map((i) =>
    mkCluster(i.id, {
      page: i.page,
      companySlugs: i.companies,
      extracted: i.extracted,
      excerpts: i.members.map((m) => m.excerpt),
      memberHeadlines: i.members.map((m) => m.headline),
      publishers: i.members.map((m) => m.publisher),
    }),
  );

  it("replays the recorded response: every expectation + rubric pass", async () => {
    const resp = JSON.parse(
      readFileSync(join(dataDir, "draft.response.json"), "utf8"),
    ) as DraftResponse;
    const out = await draft(clusters, draftOpts({ llm: createReplayDrafter(resp) }));
    const byId = new Map(out.clusters.map((c) => [c.id, c]));
    for (const item of labeled.items) {
      const got = byId.get(item.id)!;
      if (!isDraftPage(item.page)) {
        expect(got.draft.one_liner, item.id).toBeUndefined();
        continue;
      }
      const lin = got.draft.one_liner;
      expect(lin, item.id).toBeDefined();
      expect(lin!.length, item.id).toBeLessThanOrEqual(ONE_LINER_MAX_CHARS);
      expect(splitSentences(lin!), item.id).toHaveLength(1);
      expect(proseKey(lin!), item.id).not.toBe(proseKey(got.draft.headline ?? got.item.headline));
      if (item.expect.headline !== undefined) {
        expect(got.draft.headline, item.id).toBe(item.expect.headline);
      }
      if (item.expect.headline_pattern !== undefined) {
        expect(got.draft.headline, item.id).toMatch(new RegExp(item.expect.headline_pattern));
      }
      // No violation-level flags on the recorded happy path.
      const bad = got.draft.flags.filter((f) =>
        /^(link|emoji|markers|exclamation|untraced|banned)/.test(f),
      );
      expect(bad, `${item.id}: ${bad.join(",")}`).toEqual([]);
    }
    // Briefing contract.
    expect(out.briefing.sentences.length).toBeGreaterThanOrEqual(BRIEFING_MIN_SENTENCES);
    expect(out.briefing.sentences.length).toBeLessThanOrEqual(BRIEFING_MAX_SENTENCES);
    for (const [i, s] of out.briefing.sentences.entries()) {
      expect(s, `briefing[${i}]`).not.toMatch(/https?:\/\//);
      expect((out.briefing.supports[i] ?? []).length, `briefing[${i}] supports`).toBeGreaterThanOrEqual(1);
      for (const id of out.briefing.supports[i]!) {
        expect(byId.has(id), `briefing[${i}] support ${id}`).toBe(true);
      }
    }
    // The rubric gate — the self-check recorded with the draft.
    expect(out.rubric.pass, JSON.stringify(out.rubric.checks.filter((c) => c.status === "fail"))).toBe(true);
  });

  it("records the request id set so the replay stays in sync", () => {
    const req = JSON.parse(readFileSync(join(dataDir, "draft.request.json"), "utf8")) as DraftRequest;
    expect(req.prompt_version).toBe(DRAFT_PROMPT_VERSION);
    expect(new Set(req.items.map((i) => i.id))).toEqual(
      new Set(labeled.items.filter((i) => isDraftPage(i.page)).map((i) => i.id)),
    );
  });
});
