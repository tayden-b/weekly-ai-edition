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
import {
  createProductHuntAdapter,
  PRODUCT_HUNT_ADAPTER_ID,
  PRODUCT_HUNT_DEFAULT_TOPICS,
  PRODUCT_HUNT_TOKEN_ENV,
} from "./product-hunt.js";

const FIXTURE_PATH = fileURLToPath(
  new URL("./__fixtures__/product-hunt.json", import.meta.url),
);
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));

/** Enabled adapter: token injected the way ingest would read it from env. */
const enabled = () =>
  createProductHuntAdapter({ token: "ph-test-token", minRequestIntervalMs: 0 });

describe("product-hunt adapter through runAdapterFixture", () => {
  it("replays the GraphQL response shape → RawItem[]", async () => {
    const { items, mapped } = await runAdapterFixture(enabled(), FIXTURE_PATH);
    expect(enabled().id).toBe(PRODUCT_HUNT_ADAPTER_ID);

    // map emits every node (3); fetch keeps the two inside the window.
    expect(mapped).toHaveLength(3);
    expect(items.map((i) => i.source_ids.ph_post_id).sort()).toEqual(["904101", "904103"]);
    for (const item of [...items, ...mapped]) {
      expect(isRawItem(item)).toBe(true);
    }

    const first = items.find((i) => i.source_ids.ph_post_id === "904101")!;
    expect(first.headline).toBe("Benchline AI");
    expect(first.publisher).toBe("Product Hunt");
    expect(first.canonical_url).toBe("https://www.producthunt.com/posts/benchline-ai");
    expect(first.excerpt).toContain("Evals for coding agents");
    expect(first.fetched_at).toBe(FIXTURE_NOW.toISOString());

    // url null → /posts/<slug> fallback; tagline null → name as excerpt.
    const slugOnly = items.find((i) => i.source_ids.ph_post_id === "904103")!;
    expect(slugOnly.canonical_url).toBe("https://www.producthunt.com/posts/slugette");
    expect(slugOnly.excerpt).toBe("Slugette");
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(enabled(), FIXTURE_PATH);
    const b = await runAdapterFixture(enabled(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("map() returns [] on a GraphQL errors payload", () => {
    const out = enabled().map({ errors: [{ message: "invalid token" }] }, FIXTURE_NOW);
    expect(out).toEqual([]);
  });
});

describe("product-hunt disabled-by-default behaviour (no secrets, HANDOFF)", () => {
  it("the token env var is documented and never committed", () => {
    expect(PRODUCT_HUNT_TOKEN_ENV).toBe("PRODUCT_HUNT_TOKEN");
  });

  it("fetch() returns [] without touching the network when no token exists", async () => {
    const fetcherThatMustNotBeCalled = replayFetcher({ responses: [{ body: {} }] });
    const items = await createProductHuntAdapter({ token: "" }).fetch(
      { from: new Date(0), to: FIXTURE_NOW },
      { fetch: fetcherThatMustNotBeCalled, now: () => FIXTURE_NOW },
    );
    expect(items).toEqual([]); // an unrecorded request would have thrown
  });

  it("health() reports disabled — ok:false, never a throw — when no token exists", async () => {
    const health = await createProductHuntAdapter({ token: "" }).health({
      fetch: replayFetcher({ responses: [{ body: {} }] }),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("disabled");
    expect(health.detail).toContain(PRODUCT_HUNT_TOKEN_ENV);
    expect(health.checked_at).toBe(FIXTURE_NOW.toISOString());
  });

  it("the sources.yaml entry is enabled:false with the token lookup documented", () => {
    const entry = loadSourcesConfig(repo("config/sources.yaml")).find(
      (s) => s.adapter === PRODUCT_HUNT_ADAPTER_ID,
    )!;
    expect(entry.id).toBe("product-hunt");
    expect(entry.enabled).toBe(false);
    expect(entry.license).toContain(PRODUCT_HUNT_TOKEN_ENV);
  });

  it("config meta.topics mirrors the adapter's default topic filter", () => {
    const entry = loadSourcesConfig(repo("config/sources.yaml")).find(
      (s) => s.adapter === PRODUCT_HUNT_ADAPTER_ID,
    )!;
    expect((entry.meta as { topics?: string[] } | undefined)?.topics).toEqual([
      ...PRODUCT_HUNT_DEFAULT_TOPICS,
    ]);
  });
});

describe("product-hunt with a token", () => {
  it("health() pings the endpoint and reports ok", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await enabled().health({
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => FIXTURE_NOW,
    });
    expect(health.ok).toBe(true);
    expect(health.detail).toContain("HTTP 200");
  });

  it("health() reports failure, never throws, on an unreachable endpoint", async () => {
    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const health = await enabled().health({ fetch: replayFetcher(empty) });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unrecorded URL");
  });
});
