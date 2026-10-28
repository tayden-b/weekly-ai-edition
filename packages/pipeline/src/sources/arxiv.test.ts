import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXCERPT_MAX_CHARS, isRawItem } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  type AdapterFixture,
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
  UnrecordedRequestError,
} from "../testing/harness.js";
import {
  ARXIV_ADAPTER_ID,
  ARXIV_CATEGORIES,
  ARXIV_SEARCH_ORGS,
  arxivIdOf,
  createArxivAdapter,
} from "./arxiv.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/arxiv.json", import.meta.url));
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const SOURCES_YAML = repo("config/sources.yaml");

const adapter = () => createArxivAdapter({ minRequestIntervalMs: 0 });

describe("arxiv adapter through runAdapterFixture", () => {
  it("proves the contract end-to-end: fetch + map, no network", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(adapter().id).toBe(ARXIV_ADAPTER_ID);
    for (const item of [...items, ...mapped]) expect(isRawItem(item)).toBe(true);

    // 3 unique arxiv_ids under the default window: 2601.14401 (shared across
    // both org responses → deduped), 2601.14093, 2601.14202, plus the older
    // 2601.09017. The bad-id entry is dropped.
    expect(items.map((i) => i.source_ids.arxiv_id).sort()).toEqual([
      "2601.09017",
      "2601.14093",
      "2601.14202",
      "2601.14401",
    ]);
    // map() emits per body without dedupe: 3 OpenAI entries + 2 valid
    // Anthropic entries (the bad-id entry is dropped by the parser guard)
    // + 1 from the recorded health-probe feed.
    expect(mapped).toHaveLength(6);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("uses published (submission) for the window, not updated", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-01-13T00:00:00Z"), to: FIXTURE_NOW },
      expectMinItems: 1,
    });
    const ids = items.map((i) => i.source_ids.arxiv_id);
    expect(ids).not.toContain("2601.09017"); // published 2026-01-09
    expect(ids).toContain("2601.14401");
  });

  it("maps the arxiv id, abs URL, and ≤300-char abstract excerpt", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const paper = items.find((i) => i.source_ids.arxiv_id === "2601.14202")!;
    expect(paper.canonical_url).toBe("https://arxiv.org/abs/2601.14202"); // unversioned
    expect(paper.publisher).toBe("arXiv");
    expect(paper.published_at).toBe("2026-01-14T15:02:11.000Z");
    expect(paper.excerpt).toContain("constitutional classifiers");
    expect(paper.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    expect(paper.fetched_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("degrades per-org: unrecorded org queries don't sink recorded ones", async () => {
    // Only OpenAI + Anthropic are recorded — the other six org queries throw
    // UnrecordedRequestError and must be skipped, not fail the run.
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(items.length).toBeGreaterThan(0);
  });
});

describe("arxivIdOf", () => {
  it("strips version suffixes and validates the abs shape", () => {
    expect(arxivIdOf("http://arxiv.org/abs/2610.35269v1")).toBe("2610.35269");
    expect(arxivIdOf("https://arxiv.org/abs/2601.14202v2")).toBe("2601.14202");
    expect(arxivIdOf("https://arxiv.org/abs/not-an-arxiv-link")).toBeNull();
    expect(arxivIdOf("https://arxiv.org/pdf/2601.14202")).toBeNull();
  });
});

describe("the no-network guarantee", () => {
  it("replayFetcher answers only recorded URLs", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const fetcher = replayFetcher(fixture, FIXTURE_PATH);
    const res = await fetcher(
      "https://export.arxiv.org/api/query?search_query=all:electron&max_results=1",
    );
    expect(res.status).toBe(200);
    await expect(fetcher("https://unrecorded.invalid/x")).rejects.toBeInstanceOf(
      UnrecordedRequestError,
    );
  });

  it("health() reports ok against the replayed endpoint", async () => {
    const fixture: AdapterFixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });
});

describe("config/sources.yaml registration", () => {
  const entries = loadSourcesConfig(SOURCES_YAML).filter((e) => e.adapter === ARXIV_ADAPTER_ID);

  it("the arxiv-lab-papers entry exists with matching orgs", () => {
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.id).toBe("arxiv-lab-papers");
    expect(entry.mode).toBe("data");
    expect(entry.meta?.search_orgs).toEqual([...ARXIV_SEARCH_ORGS]);
    expect(entry.meta?.categories).toEqual([...ARXIV_CATEGORIES]);
  });
});
