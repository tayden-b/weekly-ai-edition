import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadCompaniesConfig } from "../config.js";
import { createReplayVerifierFromFile } from "../llm.js";
import {
  buildProvenance,
  checkProvenance,
  collectSourceCounts,
  type IngestCache,
  PROVENANCE_VERSION,
} from "../provenance.js";
import {
  assertVerifyResponse,
  briefingSentences,
  buildVerifyRequest,
  VERIFY_PROMPT_VERSION,
  verifyDeterministic,
  verifyEdition,
  verifyItemsFromEdition,
  VerifyContractError,
  type VerifyRequest,
  type VerifyResponse,
} from "./verify.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const TESTDATA = join(ROOT, "packages/pipeline/testdata/verify");

const companies = loadCompaniesConfig(join(ROOT, "config/companies.yaml"));

const loadJson = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(TESTDATA, name), "utf8")) as Record<string, unknown>;

const clean = loadJson("edition.clean.json");
const request = loadJson("verify.request.json") as unknown as VerifyRequest;
const response = loadJson("verify.response.json") as unknown as VerifyResponse;

// ---------------------------------------------------------------------------
// Checks 1–4 on the clean fixture
// ---------------------------------------------------------------------------

describe("verifyDeterministic — clean fixture", () => {
  const report = verifyDeterministic(clean, companies);

  it("passes every deterministic check", () => {
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
    for (const check of report.checks) {
      if (check.id === "briefing") expect(check.status).toBe("skipped");
      else expect(check.status).toBe("pass");
    }
  });

  it("projects every item-bearing page plus markets tickers as judge items", () => {
    const items = verifyItemsFromEdition(clean);
    expect(items.map((i) => i.id)).toEqual([
      "models-0",
      "performance-0",
      "launches-0",
      "funding-0",
      "deals-0",
      "markets-0",
      "discourse-0",
    ]);
    expect(items.find((i) => i.id === "markets-0")?.sources).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Adversarial fixtures — each fails its gate loudly
// ---------------------------------------------------------------------------

describe("verifyDeterministic — adversarial fixtures", () => {
  const cases: Array<{
    file: string;
    check: string;
    needle: string;
  }> = [
    {
      file: "edition.zero-source.json",
      check: "sources",
      needle: "zero sources",
    },
    {
      file: "edition.bad-quote.json",
      check: "evidence",
      needle: "not a verbatim substring",
    },
    {
      file: "edition.unknown-company.json",
      check: "companies",
      needle: "not a slug in config/companies.yaml",
    },
    {
      file: "edition.single-publisher-discourse.json",
      check: "discourse",
      needle: "≥ 2 distinct",
    },
  ];

  for (const { file, check, needle } of cases) {
    it(`${file} fails the ${check} check`, () => {
      const report = verifyDeterministic(loadJson(file), companies);
      expect(report.ok).toBe(false);
      const failed = report.checks.find((c) => c.id === check);
      expect(failed?.status).toBe("fail");
      expect(failed?.errors.some((e) => e.includes(needle))).toBe(true);
      // Surgical: the error names the offending item.
      expect(failed?.errors[0]).toMatch(/pages\./);
    });
  }
});

// ---------------------------------------------------------------------------
// Check 5 — attribution mechanics + the recorded entailment seam
// ---------------------------------------------------------------------------

describe("check 5 — briefing attribution + entailment", () => {
  const attribution = {
    supports: request.supports,
    items: verifyItemsFromEdition(clean),
  };

  it("the committed request matches the fixture's briefing and items", () => {
    const built = buildVerifyRequest(clean, attribution);
    expect(built.sentences).toEqual(request.sentences);
    expect(built.sentences).toEqual(briefingSentences(clean));
    expect(built.items.map((i) => i.id)).toEqual(
      request.items.map((i) => i.id),
    );
    expect(built.supports).toEqual(request.supports);
  });

  it("verifyEdition replays the recorded response — all sentences supported", async () => {
    const llm = createReplayVerifierFromFile(join(TESTDATA, "verify.response.json"));
    const report = await verifyEdition(clean, { companies, attribution, llm });
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "briefing")?.status).toBe("pass");
  });

  it("a sentence with no supports entry fails mechanically", async () => {
    const report = await verifyEdition(clean, {
      companies,
      attribution: { supports: { "0": ["models-0"] }, items: attribution.items },
      llm: createReplayVerifierFromFile(join(TESTDATA, "verify.response.json")),
    });
    const briefing = report.checks.find((c) => c.id === "briefing");
    expect(briefing?.status).toBe("fail");
    expect(
      briefing?.errors.some((e) => e.includes("no supports attribution")),
    ).toBe(true);
  });

  it("an attributed id outside the item pool fails mechanically", async () => {
    const report = await verifyEdition(clean, {
      companies,
      attribution: {
        supports: { "0": ["ghost-item"], "1": ["funding-0"], "2": ["performance-0"], "3": ["markets-0"], "4": ["discourse-0"] },
        items: attribution.items,
      },
    });
    const briefing = report.checks.find((c) => c.id === "briefing");
    expect(briefing?.status).toBe("fail");
    expect(briefing?.errors.some((e) => e.includes("ghost-item"))).toBe(true);
  });

  it("an unsupported verdict fails the build", async () => {
    const bad: VerifyResponse = {
      prompt_version: VERIFY_PROMPT_VERSION,
      verdicts: response.verdicts.map((v) =>
        v.sentence_index === 3
          ? { ...v, supported: false, item_ids: [], reason: "no item backs the rally claim" }
          : v,
      ),
    };
    const report = await verifyEdition(clean, {
      companies,
      attribution,
      llm: { verify: async () => bad },
    });
    expect(report.ok).toBe(false);
    const briefing = report.checks.find((c) => c.id === "briefing");
    expect(briefing?.status).toBe("fail");
    expect(briefing?.errors.some((e) => e.includes("supported by no item"))).toBe(true);
  });

  it("a malformed response throws VerifyContractError", async () => {
    const malformed = { prompt_version: 99, verdicts: [] };
    await expect(
      verifyEdition(clean, {
        companies,
        attribution,
        llm: { verify: async () => malformed as unknown as VerifyResponse },
      }),
    ).rejects.toBeInstanceOf(VerifyContractError);
  });

  it("assertVerifyResponse pins the contract directly", () => {
    expect(() => assertVerifyResponse(request, response)).not.toThrow();
    expect(() =>
      assertVerifyResponse(request, {
        prompt_version: 1,
        verdicts: response.verdicts.slice(1),
      }),
    ).toThrow(VerifyContractError);
    expect(() =>
      assertVerifyResponse(request, {
        prompt_version: 1,
        verdicts: response.verdicts.map((v, i) =>
          i === 0 ? { ...v, item_ids: ["nope-0"] } : v,
        ),
      }),
    ).toThrow(VerifyContractError);
  });
});

// ---------------------------------------------------------------------------
// provenance.json — build + deterministic re-check
// ---------------------------------------------------------------------------

const fakeRun: IngestCache = {
  manifest: {
    date: "2026-10-28",
    ran_at: "2026-10-28T19:44:16.751Z",
    window: { from: "2026-10-22T00:00:00.000Z", to: "2026-10-28T23:59:59.999Z" },
    sources: [
      { source: "ai-lately", adapter: "newsroom-rss", ok: true, count: 41 },
      { source: "exa-markets", adapter: "markets", ok: true, count: 10 },
      { source: "broken-feed", adapter: "newsroom-rss", ok: false, count: 0, error: "HTTP 403" },
    ],
    totals: { sources: 3, ok: 2, failed: 1, items: 51 },
  },
  cache_hashes: {
    "data/raw/2026-10-28/ai-lately.json": `sha256:${"a".repeat(64)}`,
    "data/raw/2026-10-28/exa-markets.json": `sha256:${"b".repeat(64)}`,
    "data/raw/2026-10-28/broken-feed.json": `sha256:${"c".repeat(64)}`,
    "data/raw/2026-10-28/manifest.json": `sha256:${"d".repeat(64)}`,
  },
};

describe("provenance.json", () => {
  it("buildProvenance flattens runs, counts, failures, hashes, back_page", () => {
    const prov = buildProvenance(clean, [fakeRun]);
    expect(prov.edition).toBe("2026-w99");
    expect(prov.version).toBe(PROVENANCE_VERSION);
    expect(prov.adapter_runs).toHaveLength(3);
    expect(prov.adapter_runs[0]?.date).toBe("2026-10-28");
    expect(prov.item_counts.fetched).toBe(51);
    expect(prov.item_counts.emitted).toBe(6);
    expect(prov.item_counts.by_page).toEqual({
      models: 1,
      performance: 1,
      launches: 1,
      funding: 1,
      deals: 1,
      discourse: 1,
    });
    expect(prov.failures).toEqual([
      { date: "2026-10-28", source: "broken-feed", adapter: "newsroom-rss", error: "HTTP 403" },
    ]);
    expect(prov.back_page.sources_total).toBe(8);
    expect(prov.back_page.source_counts).toEqual(collectSourceCounts(clean));
  });

  it("checkProvenance accepts the built record", () => {
    const prov = buildProvenance(clean, [fakeRun]);
    expect(checkProvenance(clean, prov)).toEqual([]);
  });

  it("checkProvenance flags a tampered record", () => {
    const prov = buildProvenance(clean, [fakeRun]);
    const tampered = {
      ...prov,
      edition: "2026-w00",
      item_counts: { ...prov.item_counts, fetched: 50 },
      back_page: { ...prov.back_page, sources_total: 9 },
    };
    const issues = checkProvenance(clean, tampered);
    expect(issues.some((i) => i.path.endsWith(".edition"))).toBe(true);
    expect(issues.some((i) => i.path.endsWith("item_counts.fetched"))).toBe(true);
    expect(issues.some((i) => i.path.endsWith("back_page.sources_total"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Prompt contract
// ---------------------------------------------------------------------------

describe("verify prompt", () => {
  it("frontmatter prompt_version matches VERIFY_PROMPT_VERSION", () => {
    const prompt = readFileSync(
      join(ROOT, "packages/pipeline/prompts/verify.prompt.md"),
      "utf8",
    );
    const m = prompt.match(/prompt_version:\s*(\d+)/);
    expect(m?.[1]).toBe(String(VERIFY_PROMPT_VERSION));
  });
});
