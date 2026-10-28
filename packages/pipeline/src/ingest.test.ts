/**
 * P3 ingest orchestrator tests — the C5 harness convention: recorded
 * fixtures through a replay fetcher, never the network.
 */
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { AdapterContext, FetchWindow } from "./adapter.js";
import { loadMarketsConfig, loadSourcesConfig, type SourceEntry } from "./config.js";
import {
  INGEST_DEFAULT_DAYS,
  ingestWindowForDate,
  manifestFor,
  runIngest,
  sourceAdapterFromEntry,
  writeIngestCache,
} from "./ingest.js";
import { loadAdapterFixture, replayFetcher, type RecordedResponse } from "./testing/harness.js";

const repo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url));
const fixture = (name: string) =>
  fileURLToPath(new URL(`./sources/__fixtures__/${name}.json`, import.meta.url));

const entries = loadSourcesConfig(repo("config/sources.yaml"));
const markets = loadMarketsConfig(repo("config/markets.json"));
const entry = (id: string) => entries.find((e) => e.id === id)!;

const WINDOW: FetchWindow = { from: new Date(0), to: new Date("2100-01-01T00:00:00Z") };
const NOW = new Date("2026-10-28T11:00:00.000Z");

const ctx = (responses: RecordedResponse[]): Partial<AdapterContext> => ({
  fetch: replayFetcher({ responses }),
  now: () => NOW,
});

const bodies = (...names: string[]): RecordedResponse[] =>
  names.flatMap((n) => loadAdapterFixture(fixture(n)).responses);

describe("sourceAdapterFromEntry — the registry", () => {
  it("builds an adapter instance for every enabled sources.yaml entry", () => {
    const enabled = entries.filter((e) => e.enabled);
    expect(enabled.length).toBeGreaterThan(30);
    for (const e of enabled) {
      const adapter = sourceAdapterFromEntry(e, { markets });
      expect(adapter, e.id).not.toBeNull();
      expect(adapter.id, e.id).toBe(e.adapter);
    }
  });

  it("throws on an unknown adapter id (recorded as a source failure by runIngest)", () => {
    const bad: SourceEntry = { ...entry("openai-news"), adapter: "no-such-adapter" };
    expect(() => sourceAdapterFromEntry(bad, { markets })).toThrow(/unknown adapter/);
  });
});

describe("ingestWindowForDate", () => {
  it("spans `days` inclusive UTC days ending on the date", () => {
    const w = ingestWindowForDate("2026-10-28");
    expect(w.from.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-10-28T23:59:59.999Z");
    const w3 = ingestWindowForDate("2026-10-28", 3);
    expect(w3.from.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("defaults to a 7-day window (the edition's Sat→Fri coverage)", () => {
    expect(INGEST_DEFAULT_DAYS).toBe(7);
    const w = ingestWindowForDate("2026-10-31");
    expect(w.from.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });

  it("rejects non-ISO dates", () => {
    expect(() => ingestWindowForDate("Oct 28")).toThrow(/YYYY-MM-DD/);
  });
});

describe("runIngest", () => {
  const synthetic: SourceEntry[] = [
    entry("guardian-ai"), // press-wire-rss — live fixture
    entry("reddit-machinelearning"), // reddit-json — live fixture
    {
      ...entry("openai-news"),
      id: "broken-fixture",
      adapter: "fixture",
      endpoint: "https://example.test/never-recorded.json",
    },
    { ...entry("product-hunt") }, // enabled: false — must be skipped
  ];
  const fetcher = ctx(bodies("press-wires-guardian-ai", "reddit-json-machinelearning"));

  it("runs enabled entries in parallel, stamps `adapter`, isolates failures", async () => {
    const run = await runIngest({ entries: synthetic, markets, window: WINDOW, ctx: fetcher });

    // Disabled entries never run — not in the manifest, not a file.
    expect(run.sources.map((s) => s.source)).toEqual([
      "guardian-ai",
      "reddit-machinelearning",
      "broken-fixture",
    ]);
    expect(run.files.map((f) => f.source)).toEqual(run.sources.map((s) => s.source));

    const [guardian, reddit, broken] = run.sources;
    expect(guardian).toMatchObject({ adapter: "press-wire-rss", ok: true });
    expect(guardian!.count).toBeGreaterThan(0);
    expect(reddit).toMatchObject({ adapter: "reddit-json", ok: true });
    expect(reddit!.count).toBeGreaterThan(0);
    // A throwing fetch is a source failure, never a run failure.
    expect(broken).toMatchObject({ adapter: "fixture", ok: false, count: 0 });
    expect(broken!.error).toContain("unrecorded URL");

    // Every item is an AdapterRawItem — the adapter id is stamped on the item.
    const items = run.files.flatMap((f) => f.items);
    expect(items.length).toBe(guardian!.count + reddit!.count);
    for (const i of items) expect(["press-wire-rss", "reddit-json"]).toContain(i.adapter);

    // A failed source still gets its file (empty items) — a re-run never
    // leaves stale records under the date.
    const brokenFile = run.files.find((f) => f.source === "broken-fixture")!;
    expect(brokenFile).toMatchObject({ adapter: "fixture", source: "broken-fixture", items: [] });
  });

  it("manifest carries {adapter, ok, count, error?} per source + totals", async () => {
    const run = await runIngest({ entries: synthetic, markets, window: WINDOW, ctx: fetcher });
    const m = manifestFor("2026-10-28", run);
    expect(m.date).toBe("2026-10-28");
    expect(m.ran_at).toBe(NOW.toISOString());
    expect(m.window).toEqual({ from: WINDOW.from.toISOString(), to: WINDOW.to.toISOString() });
    expect(m.totals.sources).toBe(3);
    expect(m.totals.ok).toBe(2);
    expect(m.totals.failed).toBe(1);
    expect(m.totals.items).toBe(m.sources.reduce((n, s) => n + s.count, 0));
    expect(m.sources.find((s) => s.source === "broken-fixture")!.error).toBeTruthy();
  });

  it("writeIngestCache writes <source>.json + manifest.json, idempotent on re-run", async () => {
    const run = await runIngest({ entries: synthetic, markets, window: WINDOW, ctx: fetcher });
    const out = mkdtempSync(join(tmpdir(), "ingest-"));
    const written = writeIngestCache(out, "2026-10-28", run);

    expect(readdirSync(join(out, "2026-10-28")).sort()).toEqual([
      "broken-fixture.json",
      "guardian-ai.json",
      "manifest.json",
      "reddit-machinelearning.json",
    ]);
    expect(written[written.length - 1]!.endsWith("manifest.json")).toBe(true);

    const file = JSON.parse(readFileSync(join(out, "2026-10-28", "guardian-ai.json"), "utf8"));
    expect(file.adapter).toBe("press-wire-rss");
    expect(file.source).toBe("guardian-ai");
    expect(file.fetched_at).toBe(NOW.toISOString());
    expect(file.items[0].adapter).toBe("press-wire-rss");

    // Same run written again → byte-identical files (idempotent re-run).
    const first = readdirSync(join(out, "2026-10-28")).map((f) =>
      readFileSync(join(out, "2026-10-28", f)),
    );
    writeIngestCache(out, "2026-10-28", run);
    const second = readdirSync(join(out, "2026-10-28")).map((f) =>
      readFileSync(join(out, "2026-10-28", f)),
    );
    expect(second).toEqual(first);
  });
});
