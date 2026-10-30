/**
 * A9 — `reddit-json`: Reddit public listing JSON adapter (PLAN §5.1
 * Discourse row: r/MachineLearning, r/LocalLLaMA, r/artificial).
 *
 * Each `adapter: reddit-json` entry in `config/sources.yaml` is ONE
 * subreddit listing endpoint (e.g. `…/r/LocalLLaMA/top.json` with
 * `meta.params.t = week`); the ingest layer builds one adapter instance per
 * entry via `redditAdapterFromEntry`, so a blocked or dead subreddit feed
 * degrades only itself — `fetch` never throws.
 *
 * Storage rule (brief): permalink → `canonical_url`, subreddit + post id +
 * outbound link in `source_ids`, `score`/`num_comments` in the engagement
 * fields (`reddit_score`, `reddit_comments`) for rank + discourse weighting.
 * Excerpt is the post's own `selftext` capped at ≤300 chars — never comment
 * bodies. Cross-source corroboration (the ≥2-publishers discourse rule) is
 * enforced downstream (P7/P4), not here.
 *
 * Licence/rate posture (sources.yaml): Reddit API terms posture for
 * read-only public JSON — declared UA required, ≤1 req/s courtesy. One
 * request per instance per run meets that structurally. Note: Reddit 403s
 * datacenter IPs (verified 2026-10-28 — the `.rss` sibling endpoint stayed
 * reachable); the adapter treats any non-2xx as "zero items this run" and
 * `health()` surfaces the status rather than throwing.
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
import type { SourceEntry } from "../config.js";

export const REDDIT_ADAPTER_ID = "reddit-json";

/** Canonical reddit.com origin permalinks resolve against. */
const REDDIT_ORIGIN = "https://www.reddit.com";

/** Default listing page size (children per request). */
const DEFAULT_LIMIT = 25;

export interface RedditAdapterOptions {
  /** `sources.yaml` entry id, e.g. "reddit-localllama" — provenance on source_ids. */
  id: string;
  /** Listing URL this instance GETs (`…/r/<sub>/<sort>.json`). */
  endpoint: string;
  /**
   * Subreddit slug (derived from the endpoint's `/r/<sub>/` segment when
   * omitted). Per-item `data.subreddit` always wins on mapped items.
   */
  subreddit?: string;
  /**
   * Publisher display name stamped on `RawItem.publisher` (entry
   * `meta.publisher`); defaults to `r/<subreddit>`.
   */
  publisher?: string;
  /** Query params merged into the request URL (entry `meta.params`, e.g. `{t: "week"}`). */
  params?: Record<string, string>;
  /** `limit` listing param (default 25); entry `meta.limit`, a `limit` in `params` wins. */
  limit?: number;
}

/**
 * Build an adapter instance from a `config/sources.yaml` entry — the
 * config-driven wiring P3 calls per `adapter: reddit-json` entry.
 * Returns `null` for entries that are disabled or belong to another adapter.
 */
export function redditAdapterFromEntry(entry: SourceEntry): SourceAdapter | null {
  if (entry.adapter !== REDDIT_ADAPTER_ID || !entry.enabled) return null;
  const meta = entry.meta ?? {};
  const params: Record<string, string> = {};
  if (typeof meta.params === "object" && meta.params !== null && !Array.isArray(meta.params)) {
    for (const [k, v] of Object.entries(meta.params)) {
      if (typeof v === "string" || typeof v === "number") params[k] = String(v);
    }
  }
  return createRedditAdapter({
    id: entry.id,
    endpoint: entry.endpoint,
    ...(typeof meta.publisher === "string" ? { publisher: meta.publisher } : {}),
    ...(typeof meta.subreddit === "string" ? { subreddit: meta.subreddit } : {}),
    ...(typeof meta.limit === "number" ? { limit: meta.limit } : {}),
    params,
  });
}

// ---------------------------------------------------------------------------
// Reddit listing payload shapes (typed to what we use — t3 carries far more)
// ---------------------------------------------------------------------------

/** The `data` node of one `kind: "t3"` listing child. */
interface RedditPost {
  /** Base36 post id ("1xer30z"). */
  id?: string;
  /** Fullname ("t3_1xer30z") — the canonical post id. */
  name?: string;
  title?: string;
  /** `/r/<sub>/comments/<id>/<slug>/` path. */
  permalink?: string;
  /** Subreddit display name with canonical casing ("LocalLLaMA"). */
  subreddit?: string;
  /** Upvotes − downvotes; may be negative. */
  score?: number;
  num_comments?: number;
  /** Epoch seconds. */
  created_utc?: number;
  /** Post body for self-posts; "" for link posts, "[removed]"/"[deleted]" when gone. */
  selftext?: string;
  /** Link-post outbound URL (the linked article/tweet); self-posts point at reddit. */
  url?: string;
  is_self?: boolean;
  link_flair_text?: string | null;
  stickied?: boolean;
  over_18?: boolean;
}

interface RedditListing {
  kind?: string;
  data?: {
    children?: Array<{ kind?: string; data?: RedditPost }>;
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** `…/r/LocalLLaMA/top.json` → `LocalLLaMA`; "" when the URL has no /r/ segment. */
export function subredditFromEndpoint(endpoint: string): string {
  return /\/r\/([^/?#]+)/.exec(endpoint)?.[1] ?? "";
}

/**
 * Post body text usable as the excerpt, else "". `[removed]` / `[deleted]`
 * selftext is reddit's tombstone, not publisher text.
 */
function postSelftext(post: RedditPost): string {
  const text = (post.selftext ?? "").trim();
  if (text === "" || text === "[removed]" || text === "[deleted]") return "";
  return text;
}

/** Permalink → canonical post URL; falls back to building one from ids. */
function postUrl(post: RedditPost, fallbackSub: string): string {
  if (typeof post.permalink === "string" && post.permalink !== "") {
    return new URL(post.permalink, REDDIT_ORIGIN).toString();
  }
  const sub = post.subreddit ?? fallbackSub;
  if (post.id !== undefined && post.id !== "" && sub !== "") {
    return `${REDDIT_ORIGIN}/r/${sub}/comments/${post.id}/`;
  }
  return "";
}

/**
 * The outbound URL a link post points at — worth keeping for cross-source
 * dedupe (the same story surfaced by a newsroom feed clusters on it). Self
 * posts and empty urls contribute nothing.
 */
function outboundUrl(post: RedditPost): string | null {
  if (post.is_self !== false) return null;
  const url = (post.url ?? "").trim();
  return /^https?:\/\//.test(url) ? url : null;
}

/** One t3 child → RawItem; null when required fields are absent. */
function postToItem(
  post: RedditPost,
  opts: RedditAdapterOptions,
  fetchedAt: Date,
): RawItem | null {
  const headline = (post.title ?? "").trim();
  const created = post.created_utc;
  const canonical_url = postUrl(post, opts.subreddit ?? "");
  if (headline === "" || canonical_url === "" || created === undefined || !Number.isFinite(created)) {
    return null;
  }
  const subreddit = post.subreddit ?? opts.subreddit ?? subredditFromEndpoint(opts.endpoint);
  const publisher = opts.publisher ?? (subreddit !== "" ? `r/${subreddit}` : "Reddit");
  const score = post.score;
  const comments = post.num_comments;

  const source_ids: Record<string, string> = {
    reddit_feed: opts.id,
    reddit_id: post.name ?? post.id ?? "",
    reddit_subreddit: subreddit,
  };
  const outbound = outboundUrl(post);
  if (outbound !== null) source_ids.reddit_url = outbound;
  const flair = (post.link_flair_text ?? "").trim();
  if (flair !== "") source_ids.reddit_flair = flair;

  return {
    headline,
    canonical_url,
    publisher,
    published_at: new Date(created * 1000).toISOString(),
    fetched_at: fetchedAt.toISOString(),
    excerpt: toExcerpt(postSelftext(post) || headline),
    source_ids,
    // Contract: engagement fields are non-negative — omit a negative score
    // rather than emit an invalid item (rare; not discourse-worthy anyway).
    ...(typeof score === "number" && Number.isFinite(score) && score >= 0
      ? { reddit_score: score }
      : {}),
    ...(typeof comments === "number" && Number.isFinite(comments) && comments >= 0
      ? { reddit_comments: comments }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

export function createRedditAdapter(opts: RedditAdapterOptions): SourceAdapter {
  const limit = opts.limit ?? DEFAULT_LIMIT;

  function requestUrl(): string {
    const u = new URL(opts.endpoint);
    for (const [k, v] of Object.entries(opts.params ?? {})) u.searchParams.set(k, v);
    if (!u.searchParams.has("limit")) u.searchParams.set("limit", String(limit));
    return u.toString();
  }

  const adapter: SourceAdapter = {
    id: REDDIT_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      let payload: unknown;
      try {
        const res = await c.fetch(requestUrl(), {
          headers: { "user-agent": c.userAgent, accept: "application/json" },
        });
        if (!res.ok) return []; // a gated/dead sub degrades itself, never the run
        payload = await res.json();
      } catch {
        return [];
      }
      const from = window.from.getTime();
      const to = window.to.getTime();
      return adapter.map(payload, fetchedAt).filter((item) => {
        const t = Date.parse(item.published_at);
        return t >= from && t <= to;
      });
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      try {
        const res = await c.fetch(requestUrl(), {
          headers: { "user-agent": c.userAgent, accept: "application/json" },
        });
        return { ok: res.ok, detail: `${opts.id} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: `${opts.id} → ${String(err)}`, checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      if (typeof payload !== "object" || payload === null) return [];
      const children = (payload as RedditListing).data?.children ?? [];
      const seen = new Set<string>();
      const items: RawItem[] = [];
      for (const child of children) {
        if (child.kind !== "t3" || child.data === undefined) continue;
        const item = postToItem(child.data, opts, fetchedAt);
        if (item === null) continue;
        const key = item.source_ids.reddit_id || item.canonical_url;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
      return items;
    },
  };

  return adapter;
}
