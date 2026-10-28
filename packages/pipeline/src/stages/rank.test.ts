import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import fixture from "../../testdata/rank/stories.json";
import expectedFixture from "../../testdata/rank/stories.expected.json";
import { loadSourcesConfig, type SourceEntry } from "../config.js";
import type { ItemCluster } from "./dedupe.js";
import type { NormalizedItem } from "./normalize.js";
import {
  configuredWeight,
  DEFAULT_PUBLISHER_WEIGHT,
  ENGAGEMENT_SATURATION,
  rank,
  RECENCY_HALF_LIFE_DAYS,
  RECENCY_UNPARSEABLE,
} from "./rank.js";

const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));

/** Injected reference instant — 2026-10-28T12:00Z, matching the fixture comments. */
const NOW = new Date("2026-10-28T12:00:00.000Z");
const SOURCES = fixture.sources as unknown as SourceEntry[];

/** P1 emits clusters with `item` = earliest-published member; fixtures carry `items` in member order. */
const clusters = fixture.clusters.map(
  (c) => ({ id: c.id, item: c.items[0], items: c.items }) as unknown as ItemCluster,
);

const OPTS = { sources: SOURCES, now: () => NOW };

const mkMember = (over: Partial<NormalizedItem>): NormalizedItem => ({
  adapter: "fixture",
  headline: "H",
  canonical_url: "https://a.com/x",
  publisher: "P",
  published_at: "2026-10-28T09:00:00.000Z",
  fetched_at: "2026-10-28T12:00:00.000Z",
  excerpt: "Some excerpt text.",
  source_ids: {},
  title_key: "h",
  ...over,
});

const mkCluster = (id: string, members: NormalizedItem[]): ItemCluster => ({
  id,
  item: members[0]!,
  items: members,
});

describe("rank — fixture ordering", () => {
  const ranked = rank(clusters, OPTS);

  it("orders multi-source + fresh + high-engagement over single-source stale", () => {
    expect(ranked.map((c) => c.id)).toEqual(expectedFixture.order);
  });

  it("emits a per-item score breakdown with every factor", () => {
    const top = ranked[0]!;
    expect(top.score).toBeGreaterThan(ranked[1]!.score);
    // 3 distinct publishers (TechCrunch, The Verge, Hacker News) → 3/4
    expect(top.score_breakdown.source_count).toBe(3);
    expect(top.score_breakdown.source_count_factor).toBeCloseTo(0.75, 6);
    expect(top.score_breakdown.publishers).toEqual([
      "Hacker News",
      "TechCrunch",
      "The Verge",
    ]);
    // TC resolves to weight 1.0 via newsroom_feed → techcrunch-ai (max wins)
    expect(top.score_breakdown.publisher_weight).toBe(1.0);
    // published 09:00, reference 12:00 → 0.125 days → 2^(−0.125/3)
    expect(top.score_breakdown.age_days).toBeCloseTo(0.125, 6);
    expect(top.score_breakdown.recency).toBeCloseTo(
      Math.pow(2, -0.125 / RECENCY_HALF_LIFE_DAYS),
      6,
    );
    // HN member: 900 points + 420 comments → raw 1320 → 1 + 1320/1820
    expect(top.score_breakdown.engagement_raw).toBe(1320);
    expect(top.score_breakdown.engagement_present).toBe(true);
    expect(top.score_breakdown.engagement).toBeCloseTo(
      1 + 1320 / (1320 + ENGAGEMENT_SATURATION),
      6,
    );
    expect(top.score).toBeCloseTo(
      top.score_breakdown.source_count_factor *
        top.score_breakdown.publisher_weight *
        top.score_breakdown.recency *
        top.score_breakdown.engagement,
      10,
    );
  });

  it("resolves weights via *_feed provenance and meta.publisher", () => {
    const reddit = ranked.find((c) => c.id.includes("reddit.com"))!;
    // source_ids.reddit_feed = reddit-machinelearning → weight 0.7
    expect(reddit.score_breakdown.publisher_weight).toBe(0.7);
    expect(reddit.score_breakdown.engagement_present).toBe(true);
    expect(reddit.score_breakdown.engagement).toBeCloseTo(
      1 + 260 / (260 + ENGAGEMENT_SATURATION),
      6,
    );

    const edgar = ranked.find((c) => c.id.includes("sec.gov"))!;
    // no *_feed key → publisherKey("SEC EDGAR") matches meta.publisher → 1.0
    expect(edgar.score_breakdown.publisher_weight).toBe(1.0);
    // no engagement fields captured → neutral, not zero
    expect(edgar.score_breakdown.engagement_present).toBe(false);
    expect(edgar.score_breakdown.engagement).toBe(1.0);
  });

  it("demotes the stale secondary-tier story on both weight and recency", () => {
    const stale = ranked[ranked.length - 1]!;
    expect(stale.id).toBe("https://www.ft.com/content/acme-ai-40m");
    expect(stale.score_breakdown.source_count).toBe(1);
    expect(stale.score_breakdown.source_count_factor).toBe(0.5);
    expect(stale.score_breakdown.publisher_weight).toBe(0.6);
    // 2026-10-21T15:00 → 6.875 days before the reference
    expect(stale.score_breakdown.age_days).toBeCloseTo(6.875, 6);
    expect(stale.score_breakdown.recency).toBeCloseTo(
      Math.pow(2, -6.875 / RECENCY_HALF_LIFE_DAYS),
      6,
    );
    expect(stale.score).toBeLessThan(0.1);
  });
});

describe("rank — factors", () => {
  it("counts distinct publishers, not members", () => {
    const c = mkCluster("c", [
      mkMember({ canonical_url: "https://a.com/1", publisher: "TechCrunch" }),
      mkMember({ canonical_url: "https://b.com/2", publisher: "techcrunch" }),
      mkMember({ canonical_url: "https://c.com/3", publisher: "The Verge" }),
    ]);
    const [r] = rank([c], OPTS);
    expect(r!.score_breakdown.source_count).toBe(2);
    expect(r!.score_breakdown.source_count_factor).toBeCloseTo(2 / 3, 6);
  });

  it("treats absent engagement as the neutral factor 1.0, present-zero as 1.0 + lift", () => {
    const absent = mkCluster("absent", [mkMember({ canonical_url: "https://a.com/1" })]);
    const zero = mkCluster("zero", [
      mkMember({ canonical_url: "https://b.com/2", hn_points: 0 }),
    ]);
    const low = mkCluster("low", [
      mkMember({ canonical_url: "https://c.com/3", hn_points: 10 }),
    ]);
    const [a, z, l] = [rank([absent], OPTS)[0]!, rank([zero], OPTS)[0]!, rank([low], OPTS)[0]!];
    expect(a.score_breakdown.engagement_present).toBe(false);
    expect(a.score_breakdown.engagement).toBe(1.0);
    // captured as zero: present, but still no lift
    expect(z.score_breakdown.engagement_present).toBe(true);
    expect(z.score_breakdown.engagement).toBe(1.0);
    expect(l.score_breakdown.engagement).toBeCloseTo(1 + 10 / (10 + ENGAGEMENT_SATURATION), 6);
    expect(l.score_breakdown.engagement).toBeGreaterThan(1.0);
  });

  it("sums engagement across members of a cluster", () => {
    const c = mkCluster("c", [
      mkMember({ canonical_url: "https://a.com/1", hn_points: 100 }),
      mkMember({ canonical_url: "https://b.com/2", hn_comments: 50, reddit_score: 40 }),
    ]);
    const [r] = rank([c], OPTS);
    expect(r!.score_breakdown.engagement_raw).toBe(190);
  });

  it("clamps future-dated stories to recency 1 and degrades unparseable to RECENCY_UNPARSEABLE", () => {
    const future = mkCluster("future", [
      mkMember({ canonical_url: "https://a.com/1", published_at: "2026-11-05T00:00:00.000Z" }),
    ]);
    const broken = mkCluster("broken", [
      mkMember({ canonical_url: "https://b.com/2", published_at: "not a date" }),
    ]);
    expect(rank([future], OPTS)[0]!.score_breakdown.recency).toBe(1.0);
    const b = rank([broken], OPTS)[0]!;
    expect(b.score_breakdown.age_days).toBeNull();
    expect(b.score_breakdown.recency).toBe(RECENCY_UNPARSEABLE);
  });

  it("honours the half-life option; Infinity disables recency", () => {
    const c = mkCluster("c", [
      mkMember({ canonical_url: "https://a.com/1", published_at: "2026-10-25T12:00:00.000Z" }),
    ]);
    const one = rank([c], { ...OPTS, halfLifeDays: 1 })[0]!;
    const inf = rank([c], { ...OPTS, halfLifeDays: Number.POSITIVE_INFINITY })[0]!;
    expect(one.score_breakdown.recency).toBeCloseTo(0.125, 6); // 3 days at half-life 1
    expect(inf.score_breakdown.recency).toBe(1.0);
  });
});

describe("rank — ordering + determinism", () => {
  it("breaks exact score ties by newest published_at, then cluster id", () => {
    // Identical factor inputs; halfLife ∞ keeps recency at 1 for both so the
    // scores are bit-for-bit equal and the comparator decides.
    const stale = mkCluster("aaa-first", [
      mkMember({ canonical_url: "https://a.com/1", published_at: "2026-10-27T12:00:00.000Z" }),
    ]);
    const fresh = mkCluster("zzz-last", [
      mkMember({ canonical_url: "https://b.com/2", published_at: "2026-10-28T12:00:00.000Z" }),
    ]);
    const tied = mkCluster("mmm-mid", [
      mkMember({ canonical_url: "https://c.com/3", published_at: "2026-10-28T12:00:00.000Z" }),
    ]);
    const ranked = rank([stale, fresh, tied], { ...OPTS, halfLifeDays: Number.POSITIVE_INFINITY });
    expect(ranked.map((c) => c.id)).toEqual(["mmm-mid", "zzz-last", "aaa-first"]);
    expect(ranked[0]!.score).toBe(ranked[1]!.score);
    expect(ranked[1]!.score).toBe(ranked[2]!.score);
  });

  it("input order does not change the ordering", () => {
    const forward = rank(clusters, OPTS);
    const backward = rank([...clusters].reverse(), OPTS);
    expect(backward.map((c) => c.id)).toEqual(forward.map((c) => c.id));
    expect(backward.map((c) => c.score)).toEqual(forward.map((c) => c.score));
  });

  it("is pure: input clusters untouched", () => {
    const snapshot = JSON.stringify(clusters);
    rank(clusters, OPTS);
    expect(JSON.stringify(clusters)).toBe(snapshot);
  });

  it("defaults the reference instant to the newest published_at in the batch", () => {
    const ranked = rank(clusters, { sources: SOURCES });
    // Newest member timestamp is the HN record at 11:00; the 09:00 TC-led
    // cluster is 2h old → still tops the ranking.
    expect(ranked[0]!.id).toBe("https://techcrunch.com/2026/10/28/openai-gpt-7/");
    expect(ranked[0]!.score_breakdown.age_days).toBeCloseTo(2 / 24, 6);
  });
});

describe("rank — config weight resolution", () => {
  it("weights come from config: meta.weight on the entry, else the neutral default", () => {
    const withWeight = SOURCES.find((s) => s.id === "theverge-ai")!;
    const without = SOURCES.find((s) => s.id === "sec-edgar-fts")!;
    expect(configuredWeight(withWeight)).toBe(0.9);
    expect(configuredWeight(without)).toBeUndefined();
  });

  it("real config/sources.yaml: every secondary entry carries an explicit weight", () => {
    const sources = loadSourcesConfig(repo("config/sources.yaml"));
    const weighted = sources.filter((s) => configuredWeight(s) !== undefined);
    expect(weighted.length).toBeGreaterThan(0);
    for (const s of weighted) {
      expect(s.tier).toBe("secondary");
      expect(configuredWeight(s)).toBeLessThan(DEFAULT_PUBLISHER_WEIGHT);
    }
    // and a primary entry resolves to the neutral default, not code magic
    const primary = sources.find((s) => s.tier === "primary")!;
    expect(configuredWeight(primary)).toBeUndefined();
  });
});
