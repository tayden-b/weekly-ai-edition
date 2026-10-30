import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  loadCompaniesConfig,
  loadMarketsConfig,
  loadSourcesConfig,
  PAGE_IDS,
  type PageId,
  parseSourcesConfig,
  ConfigValidationError,
} from "./config.js";

const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));

const sources = loadSourcesConfig(repo("config/sources.yaml"));
const companies = loadCompaniesConfig(repo("config/companies.yaml"));
const markets = loadMarketsConfig(repo("config/markets.json"));

describe("config/sources.yaml", () => {
  it("parses and validates every entry", () => {
    expect(sources.length).toBeGreaterThan(30);
    for (const s of sources) {
      expect(s.license.trim().length).toBeGreaterThan(0);
      expect(s.rate_limit.trim().length).toBeGreaterThan(0);
      expect(s.endpoint).toMatch(/^https?:\/\//);
      expect(typeof s.enabled).toBe("boolean");
      for (const p of s.pages) expect(PAGE_IDS).toContain(p);
    }
  });

  it("encodes every §5.1 primary source group", () => {
    const byId = new Map(sources.map((s) => [s.id, s]));

    // Models & Releases — all 13 lab blogs + HF Hub + flagship OSS releases
    for (const id of [
      "openai-news",
      "anthropic-news",
      "google-deepmind-blog",
      "google-ai-blog",
      "meta-ai-blog",
      "mistral-news",
      "xai-news",
      "microsoft-research-blog",
      "amazon-science-blog",
      "moonshot-news",
      "deepseek-news",
      "qwen-blog",
      "huggingface-blog",
      "hf-hub-models",
      "gh-vllm",
      "gh-llama-cpp",
      "gh-ollama",
      "gh-langchain",
      "gh-transformers",
    ]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.pages).toContain("models");
      expect(byId.get(id)!.tier).toBe("primary");
    }

    // Performance — benchmark publishers + arXiv, each with mode flag
    for (const id of [
      "lmarena-leaderboard",
      "artificial-analysis",
      "hf-open-llm-leaderboard",
      "swe-bench",
      "arc-prize-leaderboard",
      "epoch-ai-data",
      "arxiv-lab-papers",
    ]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.pages).toContain("performance");
      expect(byId.get(id)!.mode).toMatch(/^(data|link)$/);
    }

    // Launches — HN, PH (disabled w/o token), newsrooms
    for (const id of [
      "hn-algolia",
      "product-hunt",
      "techcrunch-ai",
      "theverge-ai",
      "ars-ai",
      "mit-tr-ai",
      "reuters-tech",
      "bloomberg-tech",
    ]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.pages).toContain("launches");
    }

    // Funding + Deals — EDGAR, wires, funding feeds, corroboration tier
    for (const id of [
      "sec-edgar-fts",
      "sec-edgar-current-feed",
      "pr-newswire",
      "business-wire",
      "globenewswire",
      "techcrunch-funding",
      "axios-pro-rata",
      "crunchbase-news",
    ]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.pages).toContain("funding");
    }
    for (const id of ["ft-headlines", "guardian-ai", "nyt-tech"]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.tier).toBe("secondary");
    }

    // Markets — yahoo enabled (live provider), stooq disabled (PoW-walled,
    // kept for citation resolution/fallback), keyed fallbacks disabled
    expect(byId.get("yahoo-weekly")!.enabled).toBe(true);
    for (const id of ["stooq-weekly", "alpha-vantage", "finnhub", "twelve-data"]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.enabled).toBe(false);
    }

    // Discourse — three subreddits
    for (const id of ["reddit-machinelearning", "reddit-localllama", "reddit-artificial"]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.pages).toContain("discourse");
    }

    // Secondary — distribute.software
    for (const id of ["distribute-releases", "distribute-stories"]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.tier).toBe("secondary");
      expect(byId.get(id)!.adapter).toBe("distribute-software");
    }
  });

  it("marks Product Hunt disabled until a token exists (no secrets, HANDOFF)", () => {
    const ph = sources.find((s) => s.id === "product-hunt")!;
    expect(ph.enabled).toBe(false);
    expect(ph.license).toMatch(/token/i);
  });

  it("references only known adapter ids", () => {
    const adapters = new Set([
      "lab-blogs",
      "hn-algolia",
      "newsroom-rss",
      "sec-edgar",
      "press-wire-rss",
      "product-hunt",
      "github-releases",
      "hf-hub",
      "benchmarks",
      "arxiv",
      "markets",
      "reddit-json",
      "distribute-software",
    ]);
    for (const s of sources) expect(adapters, `${s.id}→${s.adapter}`).toContain(s.adapter);
  });

  it("rejects a malformed entry", () => {
    expect(() => parseSourcesConfig("sources: [{id: x}]")).toThrow(ConfigValidationError);
    expect(() =>
      parseSourcesConfig(
        "sources: [{id: x, pages: [bogus], tier: primary, adapter: a, endpoint: 'https://e', kind: rss, license: l, rate_limit: r, enabled: true}]",
      ),
    ).toThrow(/bogus/);
  });
});

describe("config/companies.yaml", () => {
  it("contains the Markets basket + major labs", () => {
    const slugs = new Set(companies.map((c) => c.slug));
    for (const s of [
      "nvidia",
      "microsoft",
      "alphabet",
      "meta",
      "amazon",
      "amd",
      "tsmc",
      "broadcom",
      "palantir",
      "arm",
      "openai",
      "anthropic",
      "google-deepmind",
      "meta-ai",
      "mistral-ai",
      "xai",
      "microsoft-research",
      "amazon-science",
      "moonshot-ai",
      "deepseek",
      "alibaba-qwen",
      "hugging-face",
    ]) {
      expect(slugs, s).toContain(s);
    }
  });

  it("gives basket companies tickers and gives labs names+aliases", () => {
    const bySlug = new Map(companies.map((c) => [c.slug, c]));
    expect(bySlug.get("nvidia")!.ticker).toBe("NVDA");
    expect(bySlug.get("alibaba-qwen")!.ticker).toBe("BABA");
    expect(bySlug.get("moonshot-ai")!.aliases).toContain("Kimi");
  });
});

describe("config/markets.json", () => {
  it("encodes the §3 basket: 7 core + 3 justified pure plays", () => {
    const tickers = markets.basket.map((t) => t.ticker);
    for (const t of ["NVDA", "MSFT", "GOOGL", "META", "AMZN", "AMD", "TSM"]) {
      expect(tickers).toContain(t);
      expect(markets.basket.find((b) => b.ticker === t)!.role).toBe("core");
    }
    const pure = markets.basket.filter((t) => t.role === "pure-play");
    expect(pure).toHaveLength(3);
    for (const p of pure) expect(p.rationale).toBeTruthy();
    expect(markets.basket).toHaveLength(10);
  });

  it("keeps provider priority per PLAN §5.1 and ties to sources.yaml", () => {
    expect(markets.provider).toBe("yahoo-weekly");
    expect(markets.provider_priority).toEqual([
      "yahoo-weekly",
      "stooq-weekly",
      "alpha-vantage",
      "finnhub",
      "twelve-data",
    ]);
    const sourceIds = new Set(sources.map((s) => s.id));
    for (const p of markets.provider_priority) {
      expect(sourceIds, p).toContain(p);
    }
    expect(markets.basket.length).toBeLessThanOrEqual(10); // schema cap
  });
});

describe("page ids", () => {
  it("cover the 11-page fixed template", () => {
    const expected: PageId[] = [
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
    ];
    expect([...PAGE_IDS]).toEqual(expected);
  });
});
