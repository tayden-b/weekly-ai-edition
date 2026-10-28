import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createReplayLlm,
  createSessionLlm,
  classificationPaths,
  writeClassificationRequest,
  readClassificationResponse,
} from "../llm.js";
import {
  applyClassification,
  buildClassificationRequest,
  buildCompanyResolver,
  classify,
  ClassificationContractError,
  type ClassificationResponse,
  CLASSIFY_CONFIDENCE_THRESHOLD,
  CLASSIFY_PROMPT_VERSION,
  clusterPublishers,
  companyKey,
  renderClassifyPrompt,
  resolveCompanySlug,
} from "./classify.js";
import type { ItemCluster } from "./dedupe.js";
import type { NormalizedItem } from "./normalize.js";
import type { CompanyEntry } from "../config.js";

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

const mkCluster = (over: Partial<ItemCluster>): ItemCluster => {
  const item = mkItem({});
  return { id: item.canonical_url, item, items: [item], ...over };
};

const COMPANIES: CompanyEntry[] = [
  { slug: "openai", name: "OpenAI", aliases: [], domain: "openai.com" },
  { slug: "alphabet", name: "Alphabet (Google)", aliases: ["Google", "GOOGL"], domain: "abc.xyz" },
  { slug: "anthropic", name: "Anthropic", aliases: [], domain: "anthropic.com" },
];

const mkResponse = (entries: ClassificationResponse["items"]): ClassificationResponse => ({
  prompt_version: CLASSIFY_PROMPT_VERSION,
  items: entries,
});

const tmpDirs: string[] = [];
const tmpDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), "classify-"));
  tmpDirs.push(d);
  return d;
};
afterEach(() => {
  while (tmpDirs.length > 0) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

describe("buildClassificationRequest", () => {
  it("flattens clusters to request items with publisher rollup", () => {
    const cluster = mkCluster({
      id: "https://a.com/story",
      item: mkItem({ publisher: "TechCrunch", headline: "Big news" }),
      items: [
        mkItem({ publisher: "TechCrunch" }),
        mkItem({ publisher: "The Verge", canonical_url: "https://b.com/y" }),
        mkItem({ publisher: "verge", canonical_url: "https://c.com/z" }),
      ],
    });
    const req = buildClassificationRequest([cluster], {
      companies: COMPANIES,
      week: "2026-W44",
      styleRev: "abc123",
    });
    expect(req.week).toBe("2026-W44");
    expect(req.prompt_version).toBe(CLASSIFY_PROMPT_VERSION);
    expect(req.style_rev).toBe("abc123");
    expect(req.companies).toHaveLength(3);
    const it0 = req.items[0]!;
    expect(it0.id).toBe("https://a.com/story");
    expect(it0.headline).toBe("Big news");
    // "The Verge" and "verge" key to the same publisher → 2 distinct.
    expect(it0.source_count).toBe(2);
    expect(it0.publishers).toEqual(["TechCrunch", "The Verge"]);
  });
});

// ---------------------------------------------------------------------------
// Company resolution
// ---------------------------------------------------------------------------

describe("company resolution", () => {
  const resolver = buildCompanyResolver(COMPANIES);

  it("resolves slugs, names, and aliases to the canonical slug", () => {
    expect(resolveCompanySlug("openai", resolver)).toBe("openai");
    expect(resolveCompanySlug("OpenAI", resolver)).toBe("openai");
    expect(resolveCompanySlug("google", resolver)).toBe("alphabet");
    expect(resolveCompanySlug("Google", resolver)).toBe("alphabet");
    expect(resolveCompanySlug("Alphabet (Google)", resolver)).toBe("alphabet");
    expect(resolveCompanySlug("googl", resolver)).toBe("alphabet");
  });

  it("returns undefined for unknown companies — never mints", () => {
    expect(resolveCompanySlug("globex", resolver)).toBeUndefined();
  });

  it("companyKey slugifies names", () => {
    expect(companyKey("Thinking Machines Lab")).toBe("thinking-machines-lab");
    expect(companyKey("Arm")).toBe("arm");
  });
});

// ---------------------------------------------------------------------------
// Post-processing rules
// ---------------------------------------------------------------------------

describe("applyClassification — rules", () => {
  const opts = { companies: COMPANIES };

  const run = (
    cluster: ItemCluster,
    item: ClassificationResponse["items"][number],
  ) => {
    const req = buildClassificationRequest([cluster], { companies: COMPANIES });
    const res = applyClassification([cluster], req, mkResponse([item]), opts);
    return res[0]!.classification;
  };

  it("passes a confident valid label through with resolved companies", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, {
      id: "c1",
      page: "funding",
      confidence: 0.9,
      company_slugs: ["openai"],
      rationale: "round",
    });
    expect(out.page).toBe("funding");
    expect(out.confidence).toBe(0.9);
    expect(out.company_slugs).toEqual(["openai"]);
    expect(out.rationale).toBe("round");
    expect(out.flags).toEqual([]);
  });

  it(`forces unsorted when confidence < ${CLASSIFY_CONFIDENCE_THRESHOLD}`, () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, { id: "c1", page: "models", confidence: 0.69, company_slugs: [] });
    expect(out.page).toBe("unsorted");
    expect(out.confidence).toBe(0.69);
    expect(out.flags).toContain("low-confidence");
  });

  it("keeps unsorted at the threshold boundary (0.7 stays classified)", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, { id: "c1", page: "models", confidence: 0.7, company_slugs: [] });
    expect(out.page).toBe("models");
  });

  it("forces unsorted on an out-of-taxonomy label", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, { id: "c1", page: "money", confidence: 0.99, company_slugs: [] });
    expect(out.page).toBe("unsorted");
    expect(out.flags).toEqual(expect.arrayContaining([expect.stringContaining("invalid-page")]));
  });

  it("forces unsorted on out-of-range confidence", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, { id: "c1", page: "models", confidence: 1.4, company_slugs: [] });
    expect(out.page).toBe("unsorted");
    expect(out.flags).toEqual(
      expect.arrayContaining(["low-confidence", expect.stringContaining("invalid-confidence")]),
    );
  });

  it("forces unsorted when any company is unknown — never mints", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, {
      id: "c1",
      page: "deals",
      confidence: 0.95,
      company_slugs: ["openai", "globex"],
    });
    expect(out.page).toBe("unsorted");
    expect(out.company_slugs).toEqual(["openai"]); // valid tags kept; unknown dropped
    expect(out.flags).toContain("unknown-company:globex");
  });

  it("resolves aliases to canonical slugs, dedupes and sorts", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, {
      id: "c1",
      page: "launches",
      confidence: 0.9,
      company_slugs: ["Google", "alphabet", "OpenAI", "openai"],
    });
    expect(out.page).toBe("launches");
    expect(out.company_slugs).toEqual(["alphabet", "openai"]);
    // "Google" resolved via alias → flagged; "OpenAI" slugifies to its own slug.
    expect(out.flags).toEqual(["company-alias:Google"]);
  });

  it("allows explicit unsorted with high confidence", () => {
    const c = mkCluster({ id: "c1" });
    const out = run(c, { id: "c1", page: "unsorted", confidence: 0.95, company_slugs: [] });
    expect(out.page).toBe("unsorted");
    expect(out.flags).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

describe("response contract", () => {
  const cluster = mkCluster({ id: "c1" });
  const req = buildClassificationRequest([cluster], { companies: COMPANIES });
  const call = (response: unknown) =>
    applyClassification([cluster], req, response, { companies: COMPANIES });

  it("throws on prompt_version mismatch", () => {
    expect(() =>
      call({ prompt_version: 999, items: [{ id: "c1", page: "models", confidence: 1, company_slugs: [] }] }),
    ).toThrow(ClassificationContractError);
  });

  it("throws on missing, extra, and duplicate ids", () => {
    expect(() => call(mkResponse([]))).toThrow(/missing id/);
    expect(() =>
      call(
        mkResponse([
          { id: "c1", page: "models", confidence: 1, company_slugs: [] },
          { id: "ghost", page: "models", confidence: 1, company_slugs: [] },
        ]),
      ),
    ).toThrow(/unknown id/);
    expect(() =>
      call(
        mkResponse([
          { id: "c1", page: "models", confidence: 1, company_slugs: [] },
          { id: "c1", page: "funding", confidence: 1, company_slugs: [] },
        ]),
      ),
    ).toThrow(/repeats id/);
  });

  it("throws on malformed item fields", () => {
    expect(() =>
      call({ prompt_version: 1, items: [{ id: "c1", page: 3, confidence: 1, company_slugs: [] }] }),
    ).toThrow(ClassificationContractError);
    expect(() =>
      call({ prompt_version: 1, items: [{ id: "c1", page: "models", confidence: "high", company_slugs: [] }] }),
    ).toThrow(ClassificationContractError);
    expect(() =>
      call({ prompt_version: 1, items: [{ id: "c1", page: "models", confidence: 1, company_slugs: [42] }] }),
    ).toThrow(ClassificationContractError);
  });
});

// ---------------------------------------------------------------------------
// The stage (through the seam)
// ---------------------------------------------------------------------------

describe("classify", () => {
  it("routes through the llm seam and preserves input order", async () => {
    const clusters = [mkCluster({ id: "a" }), mkCluster({ id: "b" })];
    const llm = createReplayLlm(
      mkResponse([
        { id: "b", page: "models", confidence: 0.9, company_slugs: [] },
        { id: "a", page: "funding", confidence: 0.9, company_slugs: [] },
      ]),
    );
    const out = await classify(clusters, { llm, companies: COMPANIES });
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
    expect(out[0]!.classification.page).toBe("funding");
    expect(out[1]!.classification.page).toBe("models");
  });

  it("short-circuits on an empty batch without calling the seam", async () => {
    let called = false;
    const llm = {
      classify: async (): Promise<ClassificationResponse> => {
        called = true;
        return mkResponse([]);
      },
    };
    const out = await classify([], { llm, companies: COMPANIES });
    expect(out).toEqual([]);
    expect(called).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seam implementations
// ---------------------------------------------------------------------------

describe("llm seam", () => {
  it("replay returns the recorded response verbatim", async () => {
    const recorded = mkResponse([{ id: "x", page: "models", confidence: 1, company_slugs: [] }]);
    const llm = createReplayLlm(recorded);
    const req = buildClassificationRequest([mkCluster({ id: "x" })], { companies: COMPANIES });
    expect(await llm.classify(req)).toBe(recorded);
  });

  it("writeClassificationRequest emits request + rendered prompt; reader round-trips", () => {
    const dir = tmpDir();
    const req = buildClassificationRequest([mkCluster({ id: "c1" })], {
      companies: COMPANIES,
      week: "2026-W44",
      styleRev: "deadbeef",
    });
    const paths = writeClassificationRequest(dir, req, "Week {{WEEK_ID}} rev {{STYLE_MD_GIT_SHA}}\n{{COMPANIES_YAML}}\n{{ITEMS_JSON}}");
    expect(readFileSync(paths.requestPath, "utf8")).toContain('"week": "2026-W44"');
    const prompt = readFileSync(paths.promptPath, "utf8");
    expect(prompt).toContain("Week 2026-W44 rev deadbeef");
    expect(prompt).toContain("- openai: OpenAI");
    expect(prompt).toContain('"id": "c1"');
    // The session's half of the hand-off round-trips through the same dir.
    const recorded = mkResponse([{ id: "c1", page: "models", confidence: 1, company_slugs: [] }]);
    writeFileSync(paths.responsePath, JSON.stringify(recorded));
    expect(readClassificationResponse(dir)).toEqual(recorded);
  });

  it("session impl returns a pre-filled response file", async () => {
    const dir = tmpDir();
    const recorded = mkResponse([{ id: "c1", page: "models", confidence: 0.9, company_slugs: [] }]);
    writeFileSync(classificationPaths(dir).responsePath, JSON.stringify(recorded));
    const llm = createSessionLlm({ dir, promptTemplate: "stub" });
    const req = buildClassificationRequest([mkCluster({ id: "c1" })], { companies: COMPANIES });
    expect(await llm.classify(req)).toEqual(recorded);
    // The request half was emitted for the session.
    expect(readFileSync(classificationPaths(dir).requestPath, "utf8")).toContain('"id": "c1"');
  });
});

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

describe("renderClassifyPrompt", () => {
  it("substitutes all placeholders and leaves unknown ones", () => {
    const req = buildClassificationRequest([], { companies: COMPANIES });
    const out = renderClassifyPrompt("{{WEEK_ID}}|{{COMPANIES_YAML}}|{{ITEMS_JSON}}|{{NOPE}}", req);
    expect(out).toContain("{{NOPE}}");
    expect(out).toContain("- alphabet: Alphabet (Google) (aliases: Google, GOOGL)");
    expect(out).toContain("[]");
  });

  it("shipped prompt file carries the version the stage expects", () => {
    const template = readFileSync(
      new URL("../../prompts/classify.prompt.md", import.meta.url),
      "utf8",
    );
    const m = template.match(/^prompt_version: (\d+)$/m);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBe(CLASSIFY_PROMPT_VERSION);
  });
});

describe("clusterPublishers", () => {
  it("counts distinct publishers by key, sorted display names", () => {
    const c = mkCluster({
      items: [
        mkItem({ publisher: "Hacker News" }),
        mkItem({ publisher: "hacker news" }),
        mkItem({ publisher: "Axios" }),
      ],
    });
    const { names, count } = clusterPublishers(c);
    expect(count).toBe(2);
    expect(names).toEqual(["Axios", "Hacker News"]);
  });
});
