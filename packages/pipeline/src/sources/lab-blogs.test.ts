import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { adapterContext, isRawItem } from "../adapter.js";
import { loadSourcesConfig } from "../config.js";
import { loadAdapterFixture, replayFetcher, runAdapterFixture } from "../testing/harness.js";
import { createLabBlogsAdapter, LAB_BLOGS_ADAPTER_ID } from "./lab-blogs.js";

const FIXTURE_PATH = fileURLToPath(new URL("./__fixtures__/lab-blogs.json", import.meta.url));
const SOURCES_PATH = fileURLToPath(new URL("../../../../config/sources.yaml", import.meta.url));

// Deterministic clock just past the newest recorded date (2026-10-28).
const NOW = new Date("2026-10-29T00:00:00.000Z");
const WINDOW = { from: new Date(0), to: NOW };

const labSources = () =>
  loadSourcesConfig(SOURCES_PATH).filter((s) => s.adapter === LAB_BLOGS_ADAPTER_ID);
const adapter = () => createLabBlogsAdapter({ sources: labSources() });

describe("lab-blogs adapter through runAdapterFixture", () => {
  it("yields ≥1 valid RawItem per enabled lab feed (issue proof)", async () => {
    const { items, mapped } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: WINDOW,
      now: NOW,
    });
    expect(adapter().id).toBe(LAB_BLOGS_ADAPTER_ID);

    const publishers = new Set(items.map((i) => i.publisher));
    for (const entry of labSources().filter((s) => s.enabled)) {
      const expected = (entry.meta?.publisher as string | undefined) ?? entry.id;
      expect(publishers, `no item for ${entry.id}`).toContain(expected);
    }
    for (const item of [...items, ...mapped]) {
      expect(isRawItem(item)).toBe(true);
      expect(item.excerpt.length).toBeLessThanOrEqual(300);
      expect(item.canonical_url).toMatch(/^https:\/\//);
    }
    // fetched_at stamped by the injected clock → deterministic
    expect(new Set(items.map((i) => i.fetched_at))).toEqual(new Set([NOW.toISOString()]));
  });

  it("reports every enabled source ok in lastReport()", async () => {
    const a = adapter();
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const items = await a.fetch(WINDOW, {
      fetch: replayFetcher(fixture, FIXTURE_PATH),
      now: () => NOW,
    });
    const report = a.lastReport();
    const enabled = labSources().filter((s) => s.enabled);
    expect(report.map((r) => r.source).sort()).toEqual(enabled.map((s) => s.id).sort());
    for (const r of report) {
      expect(r.ok, `${r.source}: ${r.detail}`).toBe(true);
      expect(r.items, r.source).toBeGreaterThanOrEqual(1);
    }
    expect(items.length).toBeGreaterThanOrEqual(enabled.length);
  });

  it("is deterministic across runs", async () => {
    const a = await runAdapterFixture(adapter(), FIXTURE_PATH, { window: WINDOW, now: NOW });
    const b = await runAdapterFixture(adapter(), FIXTURE_PATH, { window: WINDOW, now: NOW });
    expect(a).toEqual(b);
  });

  it("filters items outside the fetch window", async () => {
    const from = new Date("2026-10-20T00:00:00Z");
    const { items } = await runAdapterFixture(adapter(), FIXTURE_PATH, {
      window: { from, to: NOW },
      now: NOW,
      expectMinItems: 1,
    });
    // the fixture mixes Oct-2026 items with DeepSeek/Qwen history back to 2024
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      const t = Date.parse(i.published_at);
      expect(t).toBeGreaterThanOrEqual(from.getTime());
      expect(t).toBeLessThanOrEqual(NOW.getTime());
    }
    // something in the fixture predates the window and must have been dropped
    const all = await runAdapterFixture(adapter(), FIXTURE_PATH, { window: WINDOW, now: NOW });
    expect(items.length).toBeLessThan(all.items.length);
  });
});

describe("map() attribution and parsing", () => {
  const fixture = loadAdapterFixture(FIXTURE_PATH);
  const bodyOf = (url: string) =>
    fixture.responses.find((r) => r.url === url)!.body as string;

  it("detects the source from a bare body via hostname", () => {
    const items = adapter().map(bodyOf("https://openai.com/news/rss.xml"), NOW);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]!.publisher).toBe("OpenAI");
  });

  it("accepts an explicit {source, body} payload", () => {
    const items = adapter().map(
      { source: "mistral-news", body: bodyOf("https://mistral.ai/sitemap-0.xml") },
      NOW,
    );
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]!.publisher).toBe("Mistral AI");
  });

  it("parses the sitemapindex slice to zero items (children are fetch-path only)", () => {
    const items = adapter().map(bodyOf("https://mistral.ai/sitemap.xml"), NOW);
    expect(items).toHaveLength(0);
  });

  it("parses the archived x.ai card markup into dated items", () => {
    const items = adapter().map(bodyOf("https://x.ai/news"), NOW);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]!.publisher).toBe("xAI");
    expect(items[0]!.canonical_url).toMatch(/^https:\/\/x\.ai\/news\//);
  });

  it("parses DeepSeek sidebar anchors (Title YYYY/MM/DD)", () => {
    const items = adapter().map(bodyOf("https://api-docs.deepseek.com/news/news261017"), NOW);
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const i of items) {
      expect(i.canonical_url).toMatch(/^https:\/\/api-docs\.deepseek\.com\/news\/news\d+$/);
      expect(i.published_at).toMatch(/^20\d\d-/);
    }
  });

  it("returns [] for garbage, unknown hosts, and non-string payloads", () => {
    expect(adapter().map("hello world", NOW)).toHaveLength(0);
    expect(adapter().map({ items: [] }, NOW)).toHaveLength(0);
    expect(adapter().map("", NOW)).toHaveLength(0);
  });
});

describe("health()", () => {
  it("reports per-source ok without throwing", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const health = await adapter().health(
      adapterContext({ fetch: replayFetcher(fixture, FIXTURE_PATH), now: () => NOW }),
    );
    expect(health.ok).toBe(true);
    expect(health.checked_at).toBe(NOW.toISOString());
    for (const s of labSources().filter((x) => x.enabled)) {
      expect(health.detail).toContain(`${s.id}: ok`);
    }
  });

  it("reports a failing source without throwing (degrades the page, not the run)", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const replay = replayFetcher(fixture, FIXTURE_PATH);
    // x.ai is Cloudflare-gated live — replay a 403 for that host.
    const fetcher = (async (u: string | URL | Request) => {
      const url = typeof u === "string" ? u : u instanceof URL ? u.toString() : u.url;
      if (new URL(url).hostname === "x.ai") return new Response("Forbidden", { status: 403 });
      return replay(u);
    }) as typeof fetch;
    const health = await adapter().health(adapterContext({ fetch: fetcher, now: () => NOW }));
    expect(health.ok).toBe(false);
    expect(health.detail).toContain("xai-news: ");
    expect(health.detail).toContain("openai-news: ok");
  });

  it("fetch() degrades: one failing source does not sink the others", async () => {
    const fixture = loadAdapterFixture(FIXTURE_PATH);
    const replay = replayFetcher(fixture, FIXTURE_PATH);
    const fetcher = (async (u: string | URL | Request) => {
      const url = typeof u === "string" ? u : u instanceof URL ? u.toString() : u.url;
      if (new URL(url).hostname === "x.ai") return new Response("Forbidden", { status: 403 });
      return replay(u);
    }) as typeof fetch;
    const a = adapter();
    const items = await a.fetch(WINDOW, { fetch: fetcher, now: () => NOW });
    const xai = a.lastReport().find((r) => r.source === "xai-news");
    expect(xai?.ok).toBe(false);
    expect(xai?.detail).toContain("403");
    expect(items.length).toBeGreaterThanOrEqual(12);
  });
});
