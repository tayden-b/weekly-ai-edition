import { describe, expect, it } from "vitest";

import crossFixture from "../../testdata/dedupe/cross-source.json";
import expectedFixture from "../../testdata/dedupe/cross-source.expected.json";
import {
  clusterSources,
  dedupe,
  DEFAULT_SIMHASH_THRESHOLD,
  hammingDistance,
  simhash,
} from "./dedupe.js";
import type { NormalizedItem } from "./normalize.js";

const items = crossFixture.items as unknown as NormalizedItem[];

const mkItem = (over: Partial<NormalizedItem>): NormalizedItem => ({
  adapter: "fixture",
  headline: "H",
  canonical_url: "https://a.com/x",
  publisher: "P",
  published_at: "2026-10-28T09:00:00.000Z",
  fetched_at: "2026-10-28T12:00:00.000Z",
  excerpt: "Some excerpt text.",
  source_ids: { fixture_id: "1" },
  title_key: "h",
  ...over,
});

describe("dedupe — fixture partition", () => {
  const clusters = dedupe(items);

  it("produces the expected two clusters in expected order", () => {
    expect(clusters).toHaveLength(expectedFixture.clusters.length);
    expectedFixture.clusters.forEach((exp, i) => {
      const c = clusters[i]!;
      expect(c.id).toBe(exp.id);
      expect(c.items).toHaveLength(exp.members.length);
      exp.members.forEach((m, j) => {
        const member = c.items[j]!;
        expect(member.adapter).toBe(m.adapter);
        expect(member.publisher).toBe(m.publisher);
        if (m.url) expect(member.canonical_url).toBe(m.url);
      });
    });
  });

  it("collapses the same adapter+url fetch: merged timestamps, unioned source_ids", () => {
    const tc = clusters[1]!.items[0]!;
    expect(tc.publisher).toBe("TechCrunch");
    // earliest published_at, latest fetched_at
    expect(tc.published_at).toBe("2026-10-28T09:45:00.000Z");
    expect(tc.fetched_at).toBe("2026-10-28T13:00:00.000Z");
    // richer (longer) excerpt wins; feed ids union sorted
    expect(tc.excerpt).toContain("largest model");
    expect(tc.source_ids.newsroom_feed).toBe("techcrunch-ai,techcrunch-launches");
    expect(tc.source_ids.rss_guid).toBe("tc-1");
  });

  it("unions the HN item sharing TechCrunch's URL and the Verge near-dup title", () => {
    const story = clusters[1]!;
    const pubs = story.items.map((i) => i.publisher);
    expect(pubs).toEqual(["TechCrunch", "The Verge", "Hacker News"]);
    // representative = earliest published member
    expect(story.item.publisher).toBe("TechCrunch");
  });

  it("keeps every source link in the EditionSource shape", () => {
    const sources = clusterSources(clusters[1]!);
    expect(sources).toHaveLength(3);
    for (const s of sources) {
      expect(s).toHaveProperty("url");
      expect(s).toHaveProperty("publisher");
      expect(s).toHaveProperty("published_at");
      expect(s).toHaveProperty("fetched_at");
      expect(s).toHaveProperty("adapter");
      expect(s).toHaveProperty("excerpt");
      expect(s).toHaveProperty("source_ids");
    }
    expect(sources.map((s) => s.adapter)).toEqual([
      "newsroom-rss",
      "newsroom-rss",
      "hn-algolia",
    ]);
  });
});

describe("dedupe — exact URL across adapters", () => {
  it("same canonical_url different adapters cluster even with dissimilar titles", () => {
    const a = mkItem({
      adapter: "hn-algolia",
      canonical_url: "https://a.com/x",
      title_key: "completely different words here",
      publisher: "Hacker News",
    });
    const b = mkItem({
      adapter: "newsroom-rss",
      canonical_url: "https://a.com/x",
      title_key: "another unrelated headline entirely",
      publisher: "TechCrunch",
    });
    const clusters = dedupe([a, b]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.items).toHaveLength(2);
  });
});

describe("dedupe — SimHash", () => {
  it("near-duplicate titles merge deterministically at the default threshold", () => {
    const a = mkItem({ canonical_url: "https://a.com/1", title_key: "openai launches gpt 6 with 2m context" });
    const b = mkItem({ canonical_url: "https://b.com/2", title_key: "openai launches gpt 6 with 2m context window" });
    expect(hammingDistance(simhash(a.title_key), simhash(b.title_key))).toBeLessThanOrEqual(
      DEFAULT_SIMHASH_THRESHOLD,
    );
    expect(dedupe([a, b])).toHaveLength(1);
  });

  it("unrelated titles stay in separate clusters", () => {
    const a = mkItem({ canonical_url: "https://a.com/1", title_key: "openai launches gpt 6 with 2m context" });
    const b = mkItem({ canonical_url: "https://b.com/2", title_key: "form d acme ai 40m series b" });
    expect(dedupe([a, b])).toHaveLength(2);
  });

  it("threshold is configurable", () => {
    const a = mkItem({ canonical_url: "https://a.com/1", title_key: "openai launches gpt 6 with 2m context" });
    const b = mkItem({ canonical_url: "https://b.com/2", title_key: "openai launches gpt 6 with 2m token context" });
    const d = hammingDistance(simhash(a.title_key), simhash(b.title_key));
    expect(dedupe([a, b], { threshold: 0 })).toHaveLength(2);
    expect(dedupe([a, b], { threshold: d })).toHaveLength(1);
  });

  it("titles too short to fingerprint never simhash-merge", () => {
    const a = mkItem({ canonical_url: "https://a.com/1", title_key: "ai" });
    const b = mkItem({ canonical_url: "https://b.com/2", title_key: "ai" });
    // exact same short title, different URLs: no SimHash edge
    expect(dedupe([a, b])).toHaveLength(2);
  });
});

describe("dedupe — determinism", () => {
  it("input order does not change the partition", () => {
    const forward = dedupe(items);
    const backward = dedupe([...items].reverse());
    expect(backward.map((c) => c.id)).toEqual(forward.map((c) => c.id));
    for (let i = 0; i < forward.length; i++) {
      expect(backward[i]!.items.map((m) => `${m.adapter}|${m.canonical_url}`)).toEqual(
        forward[i]!.items.map((m) => `${m.adapter}|${m.canonical_url}`),
      );
      expect(backward[i]!.item).toEqual(forward[i]!.item);
    }
  });

  it("is pure: input array and records untouched", () => {
    const snapshot = JSON.stringify(items);
    dedupe(items);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
