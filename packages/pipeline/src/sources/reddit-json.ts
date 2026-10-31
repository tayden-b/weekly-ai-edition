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
 * AI-relevance filter (plan-defect #57): like every other adapter the
 * relevance terms live in config — entry `meta.ai_terms` seeds
 * `opts.aiTerms`, matched on word boundaries over the post's title +
 * selftext in `map` (same `compileAiTermMatcher` hn-algolia and sec-edgar
 * use). For the three configured subs the subreddit choice itself is the
 * relevance bound and `meta.ai_terms` is deliberately empty — the fixtures
 * show an HN-shaped term list would cut flagship content (the weekly
 * megathread carries no keyword). The key exists for future/non-topical
 * subs; unset or empty = unfiltered.
 *
 * Licence/rate posture (sources.yaml): Reddit API terms posture for
 * read-only public JSON — declared UA required, ≤1 req/s courtesy. One
 * request per instance per run meets that structurally. Note: Reddit 403s
 * datacenter IPs (verified 2026-10-28 — the `.rss` sibling endpoint stayed
 * reachable); the adapter treats any non-2xx as "zero items this run" and
 * `health()` surfaces the status rather than throwing.
 *
 * `.rss` fallback (plan-defect #67): the `.json` block is an edge block
 * (`retry-after: 0`, no `x-ratelimit-*` headers — it doesn't consume the
 * rate bucket), while the sibling `<same path>.rss` Atom feed stays
 * reachable but rate-limits to ~1 req/min per egress IP. So `fetch` tries
 * `.json` first — the richer path carrying score/num_comments — and on any
 * non-2xx/parse failure falls back to the `.rss` sibling, honouring
 * `x-ratelimit-reset` on a single 429 retry. All instances share one
 * process-wide request queue so a run's N subreddit fetches never burst
 * into the tiny bucket; engagement fields are absent on the Atom path
 * (the feed carries none) — tolerated downstream, contract stays valid.
 */

import { XMLParser } from "fast-xml-parser";

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
import { compileAiTermMatcher } from "./hn-algolia.js";
import { decodeEntities, htmlToText } from "./newsroom-rss.js";

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
  /**
   * AI-relevance terms (entry `meta.ai_terms`): an item survives `map` iff
   * ≥1 term matches on a word boundary over the raw title + selftext,
   * case-insensitive. Undefined/empty = unfiltered — sourced from config
   * like `hn-algolia`/`sec-edgar`, never a code default.
   */
  aiTerms?: readonly string[];
  /**
   * Cap (ms) on the 429 `x-ratelimit-reset` wait before the `.rss` fallback
   * gives up — default 75s (the observed bucket resets inside ~60s). A
   * hint beyond the cap skips the retry rather than parking the run.
   */
  rateLimitWaitCapMs?: number;
  /** Injectable waiter for the 429 retry — tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
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
    ...(Array.isArray(meta.ai_terms)
      ? { aiTerms: meta.ai_terms.filter((t): t is string => typeof t === "string") }
      : {}),
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
// `.rss` fallback — Atom payload shapes (fxp-parsed; see plan-defect #67)
// ---------------------------------------------------------------------------

const atomParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

type XmlNode = Record<string, unknown>;

function asList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Pull text out of a parsed node: "x", 5, or { "#text": "x", "@_a": "b" }. */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (node !== null && typeof node === "object" && "#text" in node) {
    const t = (node as { "#text"?: unknown })["#text"];
    if (typeof t === "string") return t;
    if (t !== undefined && t !== null) return String(t);
  }
  return "";
}

/** One `<entry>` of a subreddit `.rss` Atom feed. */
interface AtomEntry {
  id: string;
  title: string;
  link: string;
  updated: string;
  categoryTerm: string;
  /** Still entity-escaped inner HTML (selftext + the "submitted by" tail). */
  contentHtml: string;
}

/** `<content type="html">` → the post's own text (the "submitted by /u/…
 *  [link] [comments]" footer is reddit chrome, not publisher text). */
function rssSelftext(contentHtml: string): string {
  const html = decodeEntities(contentHtml);
  const tail = html.search(/\ssubmitted by\s/i);
  const text = htmlToText(tail >= 0 ? html.slice(0, tail) : html).trim();
  // postSelftext's tombstones apply here too — a deleted self-post's Atom
  // content still reads "[removed]"/"[deleted]", which is not publisher text
  return text === "[removed]" || text === "[deleted]" ? "" : text;
}

/** The `[link]` footer anchor is a link post's outbound URL (the permalink
 *  itself on self posts) — kept for cross-source dedupe like `data.url`. */
function rssOutboundUrl(contentHtml: string): string | null {
  const html = decodeEntities(contentHtml);
  const href = /<a[^>]+href="([^"]+)"[^>]*>\s*\[link\]\s*<\/a>/i.exec(html)?.[1];
  if (href === undefined) return null;
  try {
    const host = new URL(href).hostname;
    return host === "reddit.com" || host.endsWith(".reddit.com") ? null : href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** `…/r/LocalLLaMA/top.json` → `LocalLLaMA`; "" when the URL has no /r/ segment. */
export function subredditFromEndpoint(endpoint: string): string {
  return /\/r\/([^/?#]+)/.exec(endpoint)?.[1] ?? "";
}

/** `…/r/LocalLLaMA/top.json` → `…/r/LocalLLaMA/top.rss`; "" when the path
 *  doesn't end in `.json` — the fallback only exists for `.json` listings. */
function rssEndpoint(endpoint: string): string {
  try {
    const u = new URL(endpoint);
    if (!u.pathname.endsWith(".json")) return "";
    u.pathname = u.pathname.slice(0, -".json".length) + ".rss";
    return u.toString();
  } catch {
    return "";
  }
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

/** One t3 child → RawItem; null when required fields are absent or filtered. */
function postToItem(
  post: RedditPost,
  opts: RedditAdapterOptions,
  fetchedAt: Date,
  matchesAi: ((text: string) => boolean) | null,
): RawItem | null {
  const headline = (post.title ?? "").trim();
  if (matchesAi !== null && !matchesAi(`${headline} ${postSelftext(post)}`)) return null;
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

/** One Atom `<entry>` → RawItem; null when required fields are absent or
 *  filtered. The feed carries no score/num_comments — engagement fields
 *  stay absent (schema-optional, tolerated by rank/dedupe). */
function entryToItem(
  entry: AtomEntry,
  opts: RedditAdapterOptions,
  fetchedAt: Date,
  matchesAi: ((text: string) => boolean) | null,
): RawItem | null {
  const headline = entry.title.trim();
  const selftext = rssSelftext(entry.contentHtml);
  if (matchesAi !== null && !matchesAi(`${headline} ${selftext}`)) return null;
  const canonical_url = entry.link.trim();
  const published = Date.parse(entry.updated);
  if (headline === "" || canonical_url === "" || Number.isNaN(published)) return null;
  const subreddit =
    entry.categoryTerm || opts.subreddit || subredditFromEndpoint(opts.endpoint);
  const publisher = opts.publisher ?? (subreddit !== "" ? `r/${subreddit}` : "Reddit");

  const source_ids: Record<string, string> = {
    reddit_feed: opts.id,
    reddit_id: entry.id,
    reddit_subreddit: subreddit,
  };
  const outbound = rssOutboundUrl(entry.contentHtml);
  if (outbound !== null) source_ids.reddit_url = outbound;

  return {
    headline,
    canonical_url,
    publisher,
    published_at: new Date(published).toISOString(),
    fetched_at: fetchedAt.toISOString(),
    excerpt: toExcerpt(selftext || headline),
    source_ids,
  };
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Default cap on a 429 `x-ratelimit-reset` wait — the observed `.rss`
 *  bucket resets inside ~60s, so anything past 75s is a lost window. */
const DEFAULT_RATELIMIT_WAIT_CAP_MS = 75_000;

/**
 * Process-wide serial queue for every reddit request this module makes.
 * The `.rss` bucket is ~1 req/min PER EGRESS IP — ingest fires all adapter
 * fetches via `Promise.all`, so without this the three configured subs
 * would burst into 429s. Each `fetch`/`health` call is one queued job;
 * inside a job the .json→.rss→429-retry sequence runs back-to-back.
 */
let redditQueue: Promise<void> = Promise.resolve();

function enqueueReddit<T>(job: () => Promise<T>): Promise<T> {
  const next = redditQueue.then(job);
  redditQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function createRedditAdapter(opts: RedditAdapterOptions): SourceAdapter {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const waitCapMs = opts.rateLimitWaitCapMs ?? DEFAULT_RATELIMIT_WAIT_CAP_MS;
  const wait = opts.sleep ?? sleep;
  const matchesAi =
    opts.aiTerms !== undefined && opts.aiTerms.length > 0
      ? compileAiTermMatcher(opts.aiTerms)
      : null;

  function requestUrl(): string {
    const u = new URL(opts.endpoint);
    for (const [k, v] of Object.entries(opts.params ?? {})) u.searchParams.set(k, v);
    if (!u.searchParams.has("limit")) u.searchParams.set("limit", String(limit));
    return u.toString();
  }

  /** `.rss` sibling of requestUrl() — same params + limit (`t` filters
   *  top.rss too, verified 2026-10-31); "" when the endpoint isn't a
   *  `.json` URL. */
  function rssRequestUrl(): string {
    const base = rssEndpoint(opts.endpoint);
    if (base === "") return "";
    const u = new URL(base);
    for (const [k, v] of Object.entries(opts.params ?? {})) u.searchParams.set(k, v);
    if (!u.searchParams.has("limit")) u.searchParams.set("limit", String(limit));
    return u.toString();
  }

  const init = (c: AdapterContext, accept: string): RequestInit => ({
    headers: { "user-agent": c.userAgent, accept },
  });

  /** `.json` first (score/num_comments live only there), then the `.rss`
   *  sibling with one 429 retry honouring `x-ratelimit-reset`. Returns the
   *  body `map` understands, or null when every path degraded this run. */
  async function getListing(c: AdapterContext): Promise<unknown | null> {
    try {
      const res = await c.fetch(requestUrl(), init(c, "application/json"));
      if (res.ok) return await res.json();
    } catch {
      // fall through to the .rss sibling
    }
    const rss = rssRequestUrl();
    if (rss === "") return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await c.fetch(rss, init(c, "application/atom+xml"));
        if (res.ok) return await res.text();
        if (res.status !== 429 || attempt === 1) return null;
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        const waitMs =
          Number.isFinite(reset) && reset > 0 ? reset * 1000 : DEFAULT_RATELIMIT_WAIT_CAP_MS / 2;
        if (waitMs > waitCapMs) return null; // don't park the run on a dead window
        await wait(waitMs);
      } catch {
        return null;
      }
    }
    return null;
  }

  const adapter: SourceAdapter = {
    id: REDDIT_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      // a gated/dead sub degrades itself, never the run
      const payload = await enqueueReddit(() => getListing(c));
      if (payload === null) return [];
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
      return enqueueReddit(async () => {
        try {
          const res = await c.fetch(requestUrl(), init(c, "application/json"));
          if (res.ok) return { ok: true, detail: `${opts.id} → HTTP 200`, checked_at };
          const jsonStatus = res.status;
          const rss = rssRequestUrl();
          if (rss !== "") {
            const rssRes = await c.fetch(rss, init(c, "application/atom+xml"));
            if (rssRes.ok) {
              return {
                ok: true,
                detail: `${opts.id} → json HTTP ${jsonStatus}, rss HTTP 200`,
                checked_at,
              };
            }
            return {
              ok: false,
              detail: `${opts.id} → json HTTP ${jsonStatus}, rss HTTP ${rssRes.status}`,
              checked_at,
            };
          }
          return { ok: false, detail: `${opts.id} → HTTP ${jsonStatus}`, checked_at };
        } catch (err) {
          return { ok: false, detail: `${opts.id} → ${String(err)}`, checked_at };
        }
      });
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      // `.rss` fallback bodies arrive as XML text — anything else is the
      // t3 listing JSON.
      if (typeof payload === "string") {
        let feed: XmlNode;
        try {
          feed = atomParser.parse(payload) as XmlNode;
        } catch {
          return [];
        }
        const f = feed.feed as XmlNode | undefined;
        const seen = new Set<string>();
        const items: RawItem[] = [];
        for (const raw of asList(f?.entry as XmlNode | XmlNode[] | undefined)) {
          const linkNode = raw.link;
          const entry: AtomEntry = {
            id: textOf(raw.id),
            title: decodeEntities(textOf(raw.title)),
            link:
              typeof linkNode === "object" && linkNode !== null
                ? String((linkNode as XmlNode)["@_href"] ?? "")
                : textOf(linkNode),
            updated: textOf(raw.updated) || textOf(raw.published),
            categoryTerm: asList(raw.category as XmlNode | XmlNode[] | undefined)
              .map((cat) =>
                typeof cat === "object" && cat !== null
                  ? String(cat["@_term"] ?? "")
                  : textOf(cat),
              )
              .find((t) => t !== "") ?? "",
            contentHtml: textOf(raw.content),
          };
          const item = entryToItem(entry, opts, fetchedAt, matchesAi);
          if (item === null) continue;
          const key = item.source_ids.reddit_id || item.canonical_url;
          if (seen.has(key)) continue;
          seen.add(key);
          items.push(item);
        }
        return items;
      }
      if (typeof payload !== "object" || payload === null) return [];
      const children = (payload as RedditListing).data?.children ?? [];
      const seen = new Set<string>();
      const items: RawItem[] = [];
      for (const child of children) {
        if (child.kind !== "t3" || child.data === undefined) continue;
        const item = postToItem(child.data, opts, fetchedAt, matchesAi);
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
