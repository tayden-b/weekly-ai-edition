import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { isRawItem } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import {
  FIXTURE_NOW,
  loadAdapterFixture,
  replayFetcher,
  runAdapterFixture,
  UnrecordedRequestError,
} from "../testing/harness.js";
import {
  createGitHubReleasesAdapter,
  GITHUB_RELEASES_ADAPTER_ID,
  repoFromReleasesEndpoint,
} from "./github-releases.js";

const FIXTURE_PATH = fileURLToPath(
  new URL("./__fixtures__/github-releases.json", import.meta.url),
);
const ENDPOINT = "https://api.github.com/repos/fixture-oss/launchbox/releases";

const adapter = () =>
  createGitHubReleasesAdapter({ endpoint: ENDPOINT, minRequestIntervalMs: 0 });

describe("github-releases adapter through runAdapterFixture", () => {
  it("replays the fixture: drafts skipped, prereleases kept, window applied", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(adapter().id).toBe(GITHUB_RELEASES_ADAPTER_ID);

    // map emits every non-draft record (3); fetch keeps the two in-window.
    expect(mapped).toHaveLength(3);
    expect(items).toHaveLength(2);
    for (const item of [...items, ...mapped]) {
      expect(isRawItem(item)).toBe(true);
    }

    const tags = items.map((i) => i.source_ids.github_release_tag);
    expect(tags).toEqual(["v2.4.0", "v2.5.0-rc.1"]); // prerelease kept, draft dropped
    for (const item of items) {
      expect(item.source_ids.github_repo).toBe("fixture-oss/launchbox");
      expect(item.publisher).toBe("GitHub: fixture-oss/launchbox");
      expect(item.fetched_at).toBe(FIXTURE_NOW.toISOString());
    }
    expect(items[0]!.canonical_url).toBe(
      "https://github.com/fixture-oss/launchbox/releases/tag/v2.4.0",
    );
    // The >300-char release-notes body is truncated to a valid excerpt.
    expect(items[0]!.excerpt.length).toBeLessThanOrEqual(300);
    // Empty-name release falls back to its tag as the headline.
    expect(mapped.find((i) => i.source_ids.github_release_tag === "v2.9.0")!.headline).toBe(
      "v2.9.0",
    );
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH);
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH);
    expect(a).toEqual(b);
  });

  it("drops releases published outside the window", async () => {
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from: new Date("2026-01-13T00:00:00Z"), to: new Date("2026-01-15T00:00:00Z") },
      expectMinItems: 1,
    });
    expect(items.map((i) => i.source_ids.github_release_tag)).toEqual(["v2.5.0-rc.1"]);
  });

  it("uses a publisher override when configured", async () => {
    const a = createGitHubReleasesAdapter({ endpoint: ENDPOINT, publisher: "vLLM" });
    const { mapped } = await runAdapterFixture(a, FIXTURE_PATH);
    expect(mapped[0]!.publisher).toBe("vLLM");
  });
});

describe("github-releases endpoint parsing + health", () => {
  it("parses owner/repo from the configured endpoint and rejects others", () => {
    expect(repoFromReleasesEndpoint(ENDPOINT)).toBe("fixture-oss/launchbox");
    expect(() =>
      createGitHubReleasesAdapter({ endpoint: "https://example.com/not-releases" }),
    ).toThrow(/repos/);
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

  it("health() reports failure, never throws, when the endpoint is unrecorded", async () => {
    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const health = await adapter().health({ fetch: replayFetcher(empty) });
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("unrecorded URL");
  });

  it("fetch() degrades to [] when every request fails", async () => {
    const empty = { responses: [{ url: "https://other.invalid/x", body: {} }] };
    const items = await adapter().fetch(
      { from: new Date(0), to: FIXTURE_NOW },
      { fetch: replayFetcher(empty), now: () => FIXTURE_NOW },
    );
    expect(items).toEqual([]);
  });
});

describe("github-releases registration in config/sources.yaml", () => {
  const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
  const sources = loadSourcesConfig(repo("config/sources.yaml"));
  const entries = sources.filter((s) => s.adapter === GITHUB_RELEASES_ADAPTER_ID);

  it("is registered once per flagship OSS repo, each endpoint parseable", () => {
    expect(entries.length).toBeGreaterThanOrEqual(5); // vllm, llama.cpp, ollama, langchain, transformers
    for (const e of entries) {
      expect(repoFromReleasesEndpoint(e.endpoint), e.id).toBeDefined();
      expect(e.enabled, e.id).toBe(true);
      expect(e.license, e.id).toMatch(/GitHub/i);
    }
  });

  it("requests URLs the fixture did not record → UnrecordedRequestError (no network)", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const fetcher = replayFetcher(fixture, FIXTURE_PATH);
    await expect(fetcher("https://api.github.com/other")).rejects.toBeInstanceOf(
      UnrecordedRequestError,
    );
  });
});
