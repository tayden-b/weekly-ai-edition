import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isRawItem } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
} from "../testing/harness.js";
import { createHfHubAdapter, HF_HUB_ADAPTER_ID } from "./hf-hub.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/hf-hub.json", import.meta.url));
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));

/** Orgs the fixture records; the full lab-org list lives in config meta.orgs. */
const FIXTURE_ORGS = ["meta-llama", "google"];

const adapter = () =>
  createHfHubAdapter({ orgs: FIXTURE_ORGS, minRequestIntervalMs: 0 });

describe("hf-hub adapter through runAdapterFixture", () => {
  it("replays per-org responses: private/no-createdAt skipped, window applied", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(adapter().id).toBe(HF_HUB_ADAPTER_ID);

    // map emits every public, dated record: 2 meta-llama + 1 google + 1 seed.
    expect(mapped).toHaveLength(4);
    // fetch keeps only records whose createdAt is inside the window.
    expect(items.map((i) => i.source_ids.hf_model_id).sort()).toEqual([
      "google/gemma-4-9b-it",
      "meta-llama/Llama-Guard-5-4B",
    ]);
    for (const item of [...items, ...mapped]) {
      expect(isRawItem(item)).toBe(true);
    }

    const first = items.find((i) => i.source_ids.hf_model_id === "meta-llama/Llama-Guard-5-4B")!;
    // `author` is null in list responses — publisher derives from the id's org.
    expect(first.publisher).toBe("meta-llama");
    expect(first.canonical_url).toBe("https://huggingface.co/meta-llama/Llama-Guard-5-4B");
    expect(first.excerpt).toContain("meta-llama/Llama-Guard-5-4B");
    expect(first.excerpt).toContain("text-classification");
    expect(first.fetched_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("drops models created outside the window", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-01-13T00:00:00Z"), to: new Date("2026-01-15T00:00:00Z") },
      expectMinItems: 1,
    });
    expect(items.map((i) => i.source_ids.hf_model_id)).toEqual([
      "meta-llama/Llama-Guard-5-4B",
    ]);
  });
});

describe("hf-hub org list is config, not code", () => {
  const sources = loadSourcesConfig(repo("config/sources.yaml"));
  const entry = sources.find((s) => s.adapter === HF_HUB_ADAPTER_ID)!;

  it("hf-hub-models entry carries a non-empty meta.orgs list", () => {
    expect(entry).toBeDefined();
    expect(entry.id).toBe("hf-hub-models");
    expect(entry.enabled).toBe(true);
    const orgs = (entry.meta as { orgs?: unknown } | undefined)?.orgs;
    expect(Array.isArray(orgs)).toBe(true);
    expect((orgs as string[]).length).toBeGreaterThanOrEqual(5);
    for (const o of orgs as string[]) expect(typeof o).toBe("string");
  });

  it("the adapter instantiates from the configured org list", () => {
    const orgs = (entry.meta as { orgs: string[] }).orgs;
    const a = createHfHubAdapter({ orgs });
    expect(a.id).toBe(HF_HUB_ADAPTER_ID);
    // An empty org list is a config defect — fail loudly at construction.
    expect(() => createHfHubAdapter({ orgs: [] })).toThrow(/orgs/);
  });
});

describe("hf-hub health + degradation", () => {
  it("health() reports ok against the replayed endpoint", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
  });

  it("health() reports failure, never throws, when the endpoint is unrecorded", async () => {
    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const health = await adapter().health({ fetch: replayFetcher(empty) });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unrecorded URL");
  });

  it("a failing org degrades to the other orgs' items", async () => {
    // Fixture serving only the google response — meta-llama requests fail.
    const partial = {
      responses: [
        {
          url_contains: "author=google",
          body: [
            {
              id: "google/only-model",
              createdAt: "2026-01-12T00:00:00.000Z",
              pipeline_tag: "text-generation",
            },
          ],
        },
      ],
    };
    const items = await adapter().fetch(
      { from: new Date(0), to: FIXTURE_NOW },
      { fetch: replayFetcher(partial), now: () => FIXTURE_NOW },
    );
    expect(items.map((i) => i.source_ids.hf_model_id)).toEqual(["google/only-model"]);
  });
});
