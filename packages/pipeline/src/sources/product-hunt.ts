/**
 * A6 — `product-hunt`: Product Hunt GraphQL API → Launches (PLAN §5.1).
 *
 * The v2 API requires a free developer token. Per HANDOFF no secrets
 * exist and none may be committed, so the token is read from
 * `PRODUCT_HUNT_TOKEN` in the environment AT CALL TIME — it never appears
 * in code, config, or fixtures. When no token is present the adapter
 * reports itself disabled rather than failing:
 *   - `fetch` returns `[]` without touching the network;
 *   - `health` reports `{ ok: false, detail: "disabled — …" }`.
 * `config/sources.yaml` keeps the `product-hunt` entry `enabled: false`
 * until a token is provided via the environment; a run then degrades the
 * Launches page gracefully instead of breaking.
 *
 * With a token: per topic (default `["artificial-intelligence"]` — PH is
 * a general-product firehose, and this is the AI edition's Launches
 * source; P4 still classifies downstream) it POSTs the `posts` query
 * bounded by `postedAfter`/`postedBefore`, paginating `endCursor` up to
 * `maxPages`. Requests run sequentially ≥ `minRequestIntervalMs` apart;
 * a per-topic failure degrades to the other topics' items and `health()`
 * never throws.
 *
 * Mapping (per post node):
 *  - `headline`      ← `name`
 *  - `canonical_url` ← `url` (the PH post page; `posts/<slug>` fallback)
 *  - `publisher`     ← "Product Hunt"
 *  - `published_at`  ← `createdAt`
 *  - `excerpt`       ← `tagline` (≤300 chars; `name` fallback)
 *  - `source_ids`    ← `{ ph_post_id }`
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

export const PRODUCT_HUNT_ADAPTER_ID = "product-hunt";
export const PRODUCT_HUNT_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";

/** Env var the token is read from — documented, never committed. */
export const PRODUCT_HUNT_TOKEN_ENV = "PRODUCT_HUNT_TOKEN";

/**
 * Default topic filter — PH is a general-product firehose and this is the
 * AI edition's Launches source. Mirrored in `config/sources.yaml` →
 * `product-hunt.meta.topics`; a test keeps the two identical.
 */
export const PRODUCT_HUNT_DEFAULT_TOPICS: readonly string[] = ["artificial-intelligence"];

const POSTS_QUERY = `query Launches(
  $topic: String,
  $postedAfter: DateTime,
  $postedBefore: DateTime,
  $first: Int!,
  $after: String
) {
  posts(
    topic: $topic
    postedAfter: $postedAfter
    postedBefore: $postedBefore
    order: NEWEST
    first: $first
    after: $after
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        id
        name
        tagline
        createdAt
        url
        slug
        votesCount
      }
    }
  }
}`;

// ---------------------------------------------------------------------------
// GraphQL response shape (the slice we read — the API returns more)
// ---------------------------------------------------------------------------

interface PhPostNode {
  id?: string | number;
  name?: string | null;
  tagline?: string | null;
  createdAt?: string | null;
  url?: string | null;
  slug?: string | null;
  votesCount?: number | null;
}

interface PhPostsResponse {
  data?: {
    posts?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      edges?: { node?: PhPostNode }[];
    };
  };
  errors?: { message?: string }[];
}

export interface ProductHuntAdapterOptions {
  /** GraphQL endpoint. Default `PRODUCT_HUNT_ENDPOINT`. */
  endpoint?: string;
  /**
   * Developer token. Default: `process.env.PRODUCT_HUNT_TOKEN`, resolved per
   * call so a token provisioned after construction still activates the
   * adapter. Empty/missing token = disabled, never a failure.
   */
  token?: string;
  /**
   * PH topic slugs to query — one `posts` call per topic. Default
   * `PRODUCT_HUNT_DEFAULT_TOPICS` (mirrored in config `meta.topics`).
   */
  topics?: readonly string[];
  /** Posts per page per topic (PH max ~50). Default 50. */
  first?: number;
  /** Page cap per topic (courtesy). Default 3. */
  maxPages?: number;
  /** Min ms between request starts. Default 1000. */
  minRequestIntervalMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createProductHuntAdapter(opts: ProductHuntAdapterOptions = {}): SourceAdapter {
  const endpoint = opts.endpoint ?? PRODUCT_HUNT_ENDPOINT;
  const topics = opts.topics ?? PRODUCT_HUNT_DEFAULT_TOPICS;
  const first = opts.first ?? 50;
  const maxPages = opts.maxPages ?? 3;
  const minInterval = opts.minRequestIntervalMs ?? 1000;

  /** Empty string counts as unset — a disabled source, not a bad token. */
  const resolveToken = () => opts.token ?? process.env[PRODUCT_HUNT_TOKEN_ENV];
  const disabledDetail = `disabled — ${PRODUCT_HUNT_TOKEN_ENV} not set (see config/sources.yaml → product-hunt)`;

  /** Sequential POSTs ≥ minInterval apart; throws only to the caller's catch. */
  async function postGraphql(
    variables: Record<string, unknown>,
    token: string,
    ctx: AdapterContext,
    lastStart: { t: number },
  ): Promise<PhPostsResponse> {
    const wait = lastStart.t + minInterval - Date.now();
    if (lastStart.t > 0 && wait > 0) await sleep(wait);
    lastStart.t = Date.now();
    const res = await ctx.fetch(endpoint, {
      method: "POST",
      headers: {
        "user-agent": ctx.userAgent,
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: POSTS_QUERY, variables }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
    const body = (await res.json()) as PhPostsResponse;
    if (body.errors !== undefined && body.errors.length > 0) {
      throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join("; ")}`);
    }
    return body;
  }

  const adapter: SourceAdapter = {
    id: PRODUCT_HUNT_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const token = resolveToken();
      if (!token) return []; // disabled — degrade the page, never the run

      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      const lastStart = { t: 0 };
      const byPostId = new Map<string, RawItem>();

      for (const topic of topics) {
        let cursor: string | null = null;
        for (let page = 0; page < maxPages; page++) {
          let body: PhPostsResponse;
          try {
            body = await postGraphql(
              {
                topic,
                postedAfter: window.from.toISOString(),
                postedBefore: window.to.toISOString(),
                first,
                after: cursor,
              },
              token,
              c,
              lastStart,
            );
          } catch {
            break; // degraded: keep other topics' items
          }
          for (const item of adapter.map(body, fetchedAt)) {
            const t = Date.parse(item.published_at);
            if (t >= window.from.getTime() && t <= window.to.getTime()) {
              byPostId.set(item.source_ids.ph_post_id!, item);
            }
          }
          const pageInfo = body.data?.posts?.pageInfo;
          const nextCursor = pageInfo?.endCursor;
          if (pageInfo?.hasNextPage !== true || nextCursor === undefined || nextCursor === null) {
            break;
          }
          cursor = nextCursor;
        }
      }
      return [...byPostId.values()];
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      const token = resolveToken();
      if (!token) {
        return { ok: false, detail: disabledDetail, checked_at };
      }
      try {
        const res = await c.fetch(endpoint, {
          method: "POST",
          headers: {
            "user-agent": c.userAgent,
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query: "{ posts(first: 1) { totalCount } }" }),
        });
        return { ok: res.ok, detail: `${endpoint} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      const edges = (payload as PhPostsResponse).data?.posts?.edges ?? [];
      const items: RawItem[] = [];
      for (const edge of edges) {
        const node = edge.node;
        if (node === undefined) continue;
        if (typeof node.name !== "string" || !node.name.trim() || !node.createdAt) continue;
        const url = node.url?.trim()
          ? node.url
          : node.slug
            ? `https://www.producthunt.com/posts/${node.slug}`
            : undefined;
        const id = node.id;
        if (url === undefined || (typeof id !== "string" && typeof id !== "number")) continue;
        items.push({
          headline: node.name.trim(),
          canonical_url: url,
          publisher: "Product Hunt",
          published_at: node.createdAt,
          fetched_at: fetchedAt.toISOString(),
          excerpt: toExcerpt(node.tagline?.trim() ? node.tagline : node.name),
          source_ids: { ph_post_id: String(id) },
        });
      }
      return items;
    },
  };
  return adapter;
}
