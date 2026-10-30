/**
 * Reference adapter — `fixture` (C5).
 *
 * A trivial replay adapter that proves the `SourceAdapter` contract end to
 * end without any real source: `fetch` GETs its configured endpoint through
 * the injected fetcher (the harness's replay fetcher in tests) and `map`
 * turns the recorded `{items: [...]}` payload into `RawItem[]`.
 *
 * It is also the template for `A1`–`A10`: factory → `SourceAdapter`, pure
 * `map(payload, fetchedAt)`, live `fetch(window, ctx)`, non-throwing
 * `health()`.
 */

import {
  adapterContext,
  type AdapterContext,
  type AdapterHealth,
  type FetchWindow,
  type RawItem,
  type SourceAdapter,
  toExcerpt,
} from "../adapter.js";

export const FIXTURE_ADAPTER_ID = "fixture";

/** The payload shape this reference adapter understands. */
interface FixturePayload {
  items?: FixtureRecord[];
}

interface FixtureRecord {
  id: string | number;
  headline: string;
  url: string;
  publisher: string;
  published_at: string;
  excerpt: string;
  hn_comments?: number;
  hn_points?: number;
  reddit_score?: number;
}

export interface FixtureAdapterOptions {
  /** Endpoint the adapter GETs in `fetch`/`health`. */
  endpoint: string;
}

export function createFixtureAdapter(opts: FixtureAdapterOptions): SourceAdapter {
  const adapter: SourceAdapter = {
    id: FIXTURE_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      const res = await fetcher(opts.endpoint, {
        headers: { "user-agent": userAgent },
      });
      if (!res.ok) {
        throw new Error(`fixture adapter: HTTP ${res.status} from ${opts.endpoint}`);
      }
      const body = (await res.json()) as unknown;
      return adapter.map(body, now()).filter((item) => {
        const t = Date.parse(item.published_at);
        return t >= window.from.getTime() && t <= window.to.getTime();
      });
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      try {
        const res = await fetcher(opts.endpoint, {
          headers: { "user-agent": userAgent },
        });
        return {
          ok: res.ok,
          detail: `${opts.endpoint} → HTTP ${res.status}`,
          checked_at: now().toISOString(),
        };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at: now().toISOString() };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      const records = (payload as FixturePayload).items ?? [];
      return records.map((r): RawItem => {
        const item: RawItem = {
          headline: r.headline,
          canonical_url: r.url,
          publisher: r.publisher,
          published_at: r.published_at,
          fetched_at: fetchedAt.toISOString(),
          excerpt: toExcerpt(r.excerpt ?? ""),
          source_ids: { fixture_id: String(r.id) },
        };
        if (r.hn_comments !== undefined) item.hn_comments = r.hn_comments;
        if (r.hn_points !== undefined) item.hn_points = r.hn_points;
        if (r.reddit_score !== undefined) item.reddit_score = r.reddit_score;
        return item;
      });
    },
  };

  return adapter;
}
