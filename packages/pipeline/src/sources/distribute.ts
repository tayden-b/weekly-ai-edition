/**
 * A10 — distribute.software adapter (PLAN.md §5.1): a SECONDARY source for
 * the Models and Launches pages — corroboration and ranking signals only,
 * never the sole source for a page item (§9 single-creator containment).
 *
 * Endpoint coverage (verified live 2026-10-28):
 *
 *  - `distribute-releases` → GET `/api/v1/releases` → `{ "releases": [...] }`
 *    (kind `json-api`; lab-release records feeding Models & Releases).
 *  - `distribute-stories`  → GET `/api/v1/stories`  → `{ "stories": [...] }`
 *    (kind `json-api`; media/HN story records feeding Launches).
 *    Both feeds return the same record shape; stories records may add
 *    `score` + `discussionUrl` when `source` is `hn`.
 *
 *  Query params: `limit` is honoured (default 30) but capped server-side
 *  at 100 — the response is "latest N", no cursor/total. `offset`,
 *  `page`, `days`, and `from` are IGNORED, so there is no server-side
 *  windowing — `fetch` requests `maxItems` records and filters
 *  `publishedAt` to `window` client-side. The 100-cap covers ~2 days of
 *  stories and the full releases history, which fits the daily ingest
 *  cadence (P3) — a single run never needs deeper backfill. No other v1
 *  endpoints exist (`/api/v1/*` 404s; the site is otherwise rendered HTML).
 *  `robots.txt` carries no crawl restrictions; the courtesy rate-limit in
 *  `config/sources.yaml` stays ≤1 req/s and one request per ingest run is
 *  all this adapter needs.
 *
 * Licence / canonical-URL rule (recorded per entry in `config/sources.yaml`):
 * we are a downstream consumer of an aggregation feed. Items carry the
 * record's canonical OUTBOUND `url` (the publisher article the item links
 * out to) — that is the page's citable source. The item's on-site
 * permalink (`siteUrl`) is kept as `source_ids.distribute_url` for
 * provenance of where the record was fetched. When `source` is `hn`, the
 * real discussion link stays in `source_ids.hn_discussion_url` and the HN
 * `score` maps to `hn_points` for ranking.
 *
 * The API returns no description field: the excerpt is the record's
 * verbatim `title` (publisher's own text, ≤300 chars — the A3 fallback
 * convention), never our prose.
 *
 * Store rule: `distribute_id`, `distribute_url`, `distribute_source`, and
 * the record's `companies` slugs go in `source_ids` — company tags are the
 * feed's own slugs and line up with `config/companies.yaml`.
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

export const DISTRIBUTE_ADAPTER_ID = "distribute-software";

/**
 * Fallback publisher when a record carries no `outlet` — the feed itself
 * is then the citable publisher of the stored link.
 */
export const DISTRIBUTE_PUBLISHER = "distribute.software";

/**
 * Default page size requested per fetch. The API returns "latest N" with
 * no offset/cursor, so this must comfortably cover a week's volume
 * (verified live: ~30 stories/day, ~30 releases/month).
 */
export const DISTRIBUTE_DEFAULT_LIMIT = 250;

export interface DistributeAdapterOptions {
  /** sources.yaml entry id, e.g. "distribute-releases" — stamped on
   * `source_ids.feed` so rank's weight provenance can reach `meta.weight`. */
  id: string;
  /** Endpoint URL from `config/sources.yaml` (`/api/v1/releases` or `/api/v1/stories`). */
  endpoint: string;
  /** Records requested per fetch (default `DISTRIBUTE_DEFAULT_LIMIT`). */
  maxItems?: number;
}

// ---------------------------------------------------------------------------
// Payload shapes (typed to what we use — the API returns more)
// ---------------------------------------------------------------------------

interface DistributeRecord {
  id?: string;
  type?: string;
  title?: string;
  /** Canonical outbound URL (the linked publisher article). */
  url?: string;
  /** ISO-8601 timestamp, e.g. "2026-10-28T17:00:58.000Z". */
  publishedAt?: string;
  /** Day bucket, e.g. "2026-10-28" — fallback when publishedAt is absent. */
  date?: string;
  /** "lab" | "media" | "hn" — which upstream the record aggregates. */
  source?: string;
  /** Publisher display name of the outbound link, e.g. "Google DeepMind". */
  outlet?: string;
  /** The record's permalink on distribute.software. */
  siteUrl?: string;
  /** HN score when source === "hn". */
  score?: number;
  /** HN discussion link when source === "hn". */
  discussionUrl?: string;
  /** Company slugs matching config/companies.yaml. */
  companies?: string[];
}

interface DistributePayload {
  releases?: DistributeRecord[];
  stories?: DistributeRecord[];
}

// ---------------------------------------------------------------------------
// the adapter
// ---------------------------------------------------------------------------

export function createDistributeAdapter(opts: DistributeAdapterOptions): SourceAdapter {
  const maxItems = opts.maxItems ?? DISTRIBUTE_DEFAULT_LIMIT;

  function mapRecord(r: DistributeRecord, fetchedAt: Date): RawItem | null {
    const title = r.title?.trim();
    const url = r.url?.trim();
    const published_at = isoOrNull(r.publishedAt) ?? isoOrNull(r.date);
    if (!title || !url || !published_at) return null;

    const source_ids: Record<string, string> = { feed: opts.id };
    if (r.id) source_ids.distribute_id = r.id;
    if (r.siteUrl) source_ids.distribute_url = r.siteUrl;
    if (r.source) source_ids.distribute_source = r.source;
    if (r.companies && r.companies.length > 0) {
      source_ids.distribute_companies = r.companies.join(",");
    }
    if (r.discussionUrl) source_ids.hn_discussion_url = r.discussionUrl;

    const item: RawItem = {
      headline: title,
      canonical_url: url,
      publisher: r.outlet?.trim() || DISTRIBUTE_PUBLISHER,
      published_at,
      fetched_at: fetchedAt.toISOString(),
      excerpt: toExcerpt(title),
      source_ids,
    };
    if (typeof r.score === "number" && Number.isFinite(r.score) && r.score >= 0) {
      item.hn_points = r.score;
    }
    return item;
  }

  function requestUrl(): string {
    const u = new URL(opts.endpoint);
    u.searchParams.set("limit", String(maxItems));
    return u.toString();
  }

  return {
    id: DISTRIBUTE_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      try {
        const res = await fetcher(requestUrl(), {
          headers: { "user-agent": userAgent },
        });
        if (!res.ok) return [];
        return this.map(await res.json(), now()).filter((item) => {
          const t = Date.parse(item.published_at);
          return t >= window.from.getTime() && t <= window.to.getTime();
        });
      } catch {
        return []; // one source's failure degrades its page, never the run
      }
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      try {
        const u = new URL(opts.endpoint);
        u.searchParams.set("limit", "1");
        const res = await fetcher(u.toString(), {
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
      const p = payload as DistributePayload;
      const records = [...(p.releases ?? []), ...(p.stories ?? [])];
      return records
        .map((r) => mapRecord(r, fetchedAt))
        .filter((i): i is RawItem => i !== null);
    },
  };
}

function isoOrNull(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
