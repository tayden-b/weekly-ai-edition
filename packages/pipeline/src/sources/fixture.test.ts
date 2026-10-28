import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXCERPT_MAX_CHARS, isRawItem } from "../adapter.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
  UnrecordedRequestError,
} from "../testing/harness.js";
import { createFixtureAdapter, FIXTURE_ADAPTER_ID } from "./fixture.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/fixture.json", import.meta.url));
const ENDPOINT = "https://fixtures.weekly-ai-edition.invalid/v1/items";

const adapter = () => createFixtureAdapter({ endpoint: ENDPOINT });

describe("fixture adapter through runAdapterFixture", () => {
  it("proves the interface end-to-end: fetch + map, no network", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(adapter().id).toBe(FIXTURE_ADAPTER_ID);

    // fetch path emitted every recorded item
    expect(items).toHaveLength(2);
    // map path emitted the same set (one recorded response body)
    expect(mapped).toHaveLength(2);
    for (const item of [...items, ...mapped]) {
      expect(isRawItem(item)).toBe(true);
    }

    const first = items[0]!;
    expect(first.headline).toContain("Bench-2");
    expect(first.canonical_url).toBe("https://example.com/fixture-labs/bench-2");
    expect(first.source_ids).toEqual({ fixture_id: "fx-001" });
    expect(first.hn_points).toBe(128);
    expect(first.hn_comments).toBe(42);
    // fetched_at stamped by the injected clock → deterministic
    expect(first.fetched_at).toBe(FIXTURE_NOW.toISOString());

    // the second fixture item's excerpt was recorded >300 chars on purpose —
    // map() must truncate it to a valid RawItem excerpt
    expect(items[1]!.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    expect(items[1]!.excerpt.length).toBeGreaterThan(0);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("filters items outside the fetch window", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-01-10T15:00:00Z"), to: new Date("2026-01-12T00:00:00Z") },
      expectMinItems: 1,
    });
    expect(items).toHaveLength(1);
    expect(items[0]!.source_ids).toEqual({ fixture_id: "fx-002" });
  });
});

describe("the no-network guarantee", () => {
  it("replayFetcher answers only recorded URLs", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const fetcher = replayFetcher(fixture, FIXTURE_PATH);
    const res = await fetcher(ENDPOINT);
    expect(res.status).toBe(200);
    await expect(fetcher("https://unrecorded.invalid/x")).rejects.toBeInstanceOf(
      UnrecordedRequestError,
    );
  });

  it("health() reports ok against the replayed endpoint", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("health() reports failure when the endpoint is unrecorded", async () => {
    const emptyFixture = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const health = await adapter().health({ fetch: replayFetcher(emptyFixture) });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unrecorded URL");
  });
});
