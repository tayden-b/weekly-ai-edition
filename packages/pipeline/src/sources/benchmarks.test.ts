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
  BENCHMARK_SOURCES,
  BENCHMARKS_ADAPTER_ID,
  createBenchmarksAdapter,
  linkModeItem,
  mapSwebenchPage,
} from "./benchmarks.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/benchmarks.json", import.meta.url));
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const SOURCES_YAML = repo("config/sources.yaml");

const adapter = () => createBenchmarksAdapter({ minRequestIntervalMs: 0 });

describe("benchmarks adapter through runAdapterFixture", () => {
  it("proves the contract end-to-end: fetch + map, no network", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(adapter().id).toBe(BENCHMARKS_ADAPTER_ID);
    for (const item of [...items, ...mapped]) expect(isRawItem(item)).toBe(true);

    // data sources: 3 lmarena rows (1 malformed dropped), 4 swebench
    // submissions (default window covers all), 4 epoch rows (no-date row dropped).
    const lmarena = items.filter((i) => "lmarena_model" in i.source_ids);
    const swebench = items.filter((i) => "swebench_submission" in i.source_ids);
    const epoch = items.filter((i) => "epoch_eval_id" in i.source_ids);
    const links = items.filter((i) => "benchmark_source" in i.source_ids);
    expect(lmarena).toHaveLength(3);
    expect(swebench).toHaveLength(4);
    expect(epoch).toHaveLength(4);
    // link-mode sources always emit exactly one headline+link item
    expect(links.map((i) => i.source_ids.benchmark_source).sort()).toEqual([
      "arc-prize-leaderboard",
      "artificial-analysis",
      "hf-open-llm-leaderboard",
    ]);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("stores the publisher's own values verbatim (URL + timestamp per row)", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH);

    const arena = items.find((i) => i.source_ids.lmarena_model === "GPT-6 (High)")!;
    expect(arena.headline).toBe("LMArena text — GPT-6 (High) (#1)");
    expect(arena.canonical_url).toBe("https://lmarena.ai/leaderboard");
    expect(arena.published_at).toBe("2026-01-14T00:00:00.000Z");
    expect(arena.excerpt).toContain("rating: 1540.124");
    expect(arena.excerpt).toContain("leaderboard_publish_date: 2026-01-14");
    expect(arena.fetched_at).toBe(FIXTURE_NOW.toISOString());

    const swe = items.find(
      (i) => i.source_ids.swebench_submission === "20260114_sweagent_gpt6x",
    )!;
    expect(swe.headline).toBe("SWE-bench verified: GPT-6x Codex — 68.4%");
    expect(swe.excerpt).toContain("resolved: 68.4");
    expect(swe.excerpt).toContain("model_org: OpenAI");
    expect(swe.canonical_url).toBe(
      "https://github.com/SWE-bench/experiments/tree/main/evaluation/verified/20260114_sweagent_gpt6x",
    );

    const epoch = items.find((i) => i.source_ids.epoch_eval_id === "dwRzFGTghYEy4HNZajJXoc")!;
    expect(epoch.headline).toBe("SWE-bench Verified: gemini-3.5-flash_high");
    expect(epoch.excerpt).toContain("mean_score: 0.7933884297520661");
    expect(epoch.published_at).toBe("2026-01-14T10:22:55.000Z");
  });

  it("window-bounds data items but never link items", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-01-14T00:00:00Z"), to: FIXTURE_NOW },
      expectMinItems: 1,
    });
    const ids = items.map((i) => i.source_ids);
    // lmarena: 2026-01-08 publish date drops
    expect(ids.some((s) => s.lmarena_model === "Gemini 3.5 Pro")).toBe(false);
    expect(ids.some((s) => s.lmarena_model === "GPT-6 (High)")).toBe(true);
    // swebench: 20251010 dir prefix drops
    expect(ids.some((s) => s.swebench_submission === "20251010_oldsub_gpt5")).toBe(false);
    // epoch: 2025-10 Started-at drops; the 2026-01-13 release-date-only row drops too
    expect(ids.some((s) => s.epoch_eval_id === "ZK85PJtsCSeQJgV8dA4R4G")).toBe(false);
    expect(ids.some((s) => s.epoch_eval_id === "reldate1")).toBe(false);
    expect(ids.some((s) => s.epoch_eval_id === "5Jm2Rvv9sNx7M8nodinFAp")).toBe(true);
    // link items are a snapshot — never window-filtered
    expect(items.filter((i) => "benchmark_source" in i.source_ids)).toHaveLength(3);
  });

  it("truncates nothing — excerpts stay ≤300 chars of publisher text", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    for (const item of [...items, ...mapped]) {
      expect(item.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    }
  });
});

describe("payload routing in map()", () => {
  it("returns [] for non-self-contained shapes", () => {
    const a = adapter();
    expect(a.map([], FIXTURE_NOW)).toEqual([]);
    expect(a.map("info:\n  name: x\n", FIXTURE_NOW)).toEqual([]);
    expect(a.map("<!DOCTYPE html><title>x</title>", FIXTURE_NOW)).toEqual([]); // link page
    expect(a.map({ unrelated: true }, FIXTURE_NOW)).toEqual([]);
  });

  it("maps the embedded leaderboard-data page to swe items", () => {
    const page =
      '<html><script id="leaderboard-data" type="application/json">' +
      '[{"name":"Verified","results":[{"name":"M","resolved":1,"date":"2026-01-14","folder":"f"}]}]' +
      "</script></html>";
    const items = adapter().map(page, FIXTURE_NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.source_ids.swebench_split).toBe("verified");
  });
});

describe("mapSwebenchPage", () => {
  const spec = BENCHMARK_SOURCES.find((s) => s.id === "swe-bench")!;
  const page = (boards: unknown) =>
    `<html><script id="leaderboard-data" type="application/json">${JSON.stringify(boards)}</script></html>`;

  it("maps only the configured splits, keyed on the submission folder", () => {
    const items = mapSwebenchPage(
      page([
        {
          name: "Verified",
          results: [
            {
              name: "Test Model",
              resolved: 55.5,
              date: "2026-01-14",
              folder: "20260114_tool_testmodel",
              agent: "mini-SWE-agent",
              model_org: "TestOrg",
            },
          ],
        },
        {
          name: "Multimodal", // not in spec.splits → excluded
          results: [{ name: "X", resolved: 1, date: "2026-01-14", folder: "x" }],
        },
      ]),
      spec,
      FIXTURE_NOW,
    );
    expect(items).toHaveLength(1);
    const item = items[0]!;
    expect(item.headline).toBe("SWE-bench verified: Test Model — 55.5%");
    expect(item.published_at).toBe("2026-01-14T00:00:00.000Z");
    expect(item.canonical_url).toBe(
      "https://github.com/SWE-bench/experiments/tree/main/evaluation/verified/20260114_tool_testmodel",
    );
    expect(item.source_ids).toEqual({
      swebench_submission: "20260114_tool_testmodel",
      swebench_split: "verified",
    });
  });

  it("tags lite-split items as lite", () => {
    const items = mapSwebenchPage(
      page([
        {
          name: "Lite",
          results: [{ name: "M", resolved: 5, date: "2026-01-15", folder: "20260115_tool_m" }],
        },
      ]),
      spec,
      FIXTURE_NOW,
    );
    expect(items[0]!.headline).toContain("SWE-bench lite:");
    expect(items[0]!.source_ids.swebench_split).toBe("lite");
  });

  it("skips rows without a date and pages without the data block", () => {
    expect(
      mapSwebenchPage(
        page([{ name: "Verified", results: [{ name: "M", resolved: 1, date: null }] }]),
        spec,
        FIXTURE_NOW,
      ),
    ).toEqual([]);
    expect(mapSwebenchPage("<html>no data block</html>", spec, FIXTURE_NOW)).toEqual([]);
    expect(mapSwebenchPage("not even html", spec, FIXTURE_NOW)).toEqual([]);
  });
});

describe("linkModeItem", () => {
  const spec = BENCHMARK_SOURCES.find((s) => s.id === "artificial-analysis")!;

  it("emits title + link, Last-Modified as published_at when present", () => {
    const item = linkModeItem(
      spec,
      "<title>T</title><meta name=\"description\" content=\"D\">",
      FIXTURE_NOW,
      "Tue, 13 Jan 2026 10:00:00 GMT",
    );
    expect(item.headline).toBe("T");
    expect(item.excerpt).toBe("D");
    expect(item.published_at).toBe("2026-01-13T10:00:00.000Z");
    expect(item.source_ids).toEqual({ benchmark_source: "artificial-analysis" });
  });

  it("falls back to fetched_at when no Last-Modified", () => {
    const item = linkModeItem(spec, "<title>T</title>", FIXTURE_NOW, null);
    expect(item.published_at).toBe(FIXTURE_NOW.toISOString());
  });
});

describe("the no-network guarantee", () => {
  it("replayFetcher answers only recorded URLs", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const fetcher = replayFetcher(fixture, FIXTURE_PATH);
    const res = await fetcher("https://arcprize.org/leaderboard");
    expect(res.status).toBe(200);
    await expect(fetcher("https://unrecorded.invalid/x")).rejects.toBeInstanceOf(
      UnrecordedRequestError,
    );
  });

  it("health() reports ok against the replayed endpoints", async () => {
    const fixture: AdapterFixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("6/6 sources reachable");
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("health() reports failure per-source when unrecorded", async () => {
    const empty: AdapterFixture = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const health = await adapter().health({ fetch: replayFetcher(empty) });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("lmarena-leaderboard");
  });
});

describe("config/sources.yaml registration", () => {
  const entries = loadSourcesConfig(SOURCES_YAML).filter((e) => e.adapter === BENCHMARKS_ADAPTER_ID);

  it("every benchmarks spec mirrors a yaml entry (id, mode, endpoint)", () => {
    expect(entries.map((e) => e.id).sort()).toEqual(
      BENCHMARK_SOURCES.map((s) => s.id).sort(),
    );
    for (const spec of BENCHMARK_SOURCES) {
      const entry = entries.find((e) => e.id === spec.id)!;
      expect(entry.mode).toBe(spec.mode);
      expect(entry.endpoint).toBe(spec.endpoint);
      expect(entry.tier).toBe("primary");
      expect(entry.pages).toContain("performance");
    }
  });

  it("every yaml benchmarks entry has a licence note documenting the decision", () => {
    for (const entry of entries) {
      expect(entry.license.trim().length).toBeGreaterThan(10);
      expect(["data", "link"]).toContain(entry.mode);
    }
  });
});
