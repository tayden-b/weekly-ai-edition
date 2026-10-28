/**
 * A2 — `hn-algolia`: Hacker News via the Algolia HN API (PLAN §5.1).
 *
 * Feeds Launches (front-page + "Show HN" items, AI-filtered) and Discourse
 * (comment-count-weighted). The API is free, needs no key, and is stable:
 * `hn.algolia.com/api/v1/search` and `…/search_by_date`.
 *
 * Query design:
 *  - `front_page` is a *snapshot* tag — it marks what is on the front page
 *    right now, regardless of submission date. We fetch it from `search`
 *    unfiltered by window: the daily ingest re-captures it, and a story that
 *    is still on the front page stays "front page" even if submitted days
 *    ago. Window-filtering it by `created_at` would wrongly drop those.
 *  - `show_hn` is a stream: `search_by_date` ordered newest-first, bounded by
 *    `numericFilters=created_at_i>=from,created_at_i<=to`, paginated.
 *  - AI filter: HN is a general-tech firehose, so both queries keep only
 *    hits whose title (or Show HN body text) matches `HN_AI_TERMS` —
 *    word-boundary, case-insensitive, so "AI" can't match "said". The term
 *    list derives from the edition's page taxonomy (C3: models, performance,
 *    launches, funding, deals, markets, discourse) and lives as data in
 *    `config/sources.yaml` → `meta.ai_terms`; `HN_AI_TERMS` is the in-code
 *    default, kept in sync by test. This is a recall filter — `classify`
 *    (P4) decides page/`unsorted` downstream.
 *  - One request at a time with ≥ `minRequestIntervalMs` between request
 *    starts — the configured courtesy limit, never parallel bursts.
 *  - A per-query failure is caught and degrades to whatever the other query
 *    returned; `health()` reports endpoint state without throwing.
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

export const HN_ADAPTER_ID = "hn-algolia";
export const HN_API_BASE = "https://hn.algolia.com/api/v1";

/** HN item permalink for link-less hits (self posts). */
const hnItemUrl = (objectID: string) => `https://news.ycombinator.com/item?id=${objectID}`;

/**
 * AI filter terms, derived from the page taxonomy (C3's taxonomy IS the page
 * types: models, performance, launches, funding, deals, markets, discourse).
 * Mirrored in `config/sources.yaml` → `hn-algolia.meta.ai_terms`; a test keeps
 * the two identical. Terms match on word boundaries, case-insensitively —
 * recall-oriented on purpose; P4 does the precise classification.
 */
export const HN_AI_TERMS: readonly string[] = [
  // — umbrella
  "AI",
  "artificial intelligence",
  "machine learning",
  "deep learning",
  "neural net",
  "generative AI",
  "GenAI",
  // — models & techniques
  "LLM",
  "large language model",
  "foundation model",
  "reasoning model",
  "diffusion",
  "transformer",
  "multimodal",
  "embedding",
  "fine-tuning",
  "fine-tune",
  "RLHF",
  "RAG",
  "inference",
  "context window",
  "text-to-image",
  "text-to-video",
  "text-to-speech",
  "speech-to-text",
  // — agents & tooling
  "AI agent",
  "agent",
  "agentic",
  "agents",
  "coding agent",
  "vibe coding",
  "MCP",
  "model context protocol",
  "prompt engineering",
  // — labs & flagship products (taxonomy companies)
  "OpenAI",
  "ChatGPT",
  "GPT",
  "Anthropic",
  "Claude",
  "DeepMind",
  "Gemini",
  "Llama",
  "Mistral",
  "DeepSeek",
  "Qwen",
  "xAI",
  "Grok",
  "Copilot",
  "Perplexity",
  "Midjourney",
  "Stable Diffusion",
  "Stability AI",
  "Cohere",
  "Hugging Face",
  "Sora",
  "Kimi",
  "Moonshot",
  "Cursor",
  "vLLM",
  "llama.cpp",
  "Ollama",
  "LangChain",
  // — markets & compute side of AI
  "NVIDIA",
  "GPU cluster",
  "AI chip",
  "AI startup",
  "AI funding",
];

/** Compile a term list into one case-insensitive word-boundary matcher. */
export function compileAiTermMatcher(terms: readonly string[]): (text: string) => boolean {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
  return (text) => re.test(text);
}

// ---------------------------------------------------------------------------
// Algolia response shape (the slice we read — the API returns more)
// ---------------------------------------------------------------------------

interface HnHit {
  objectID?: string;
  title?: string | null;
  url?: string | null;
  created_at?: string;
  points?: number | null;
  num_comments?: number | null;
  story_text?: string | null;
}

interface HnSearchResponse {
  hits?: HnHit[];
  page?: number;
  nbPages?: number;
}

// ---------------------------------------------------------------------------
// story_text → readable excerpt
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  x27: "'",
  "39": "'",
  "039": "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/**
 * HN `story_text` is HTML-ish (paragraph `<p>`s, `<a>`s, entities). Reduce it
 * to plain text for the ≤300-char publisher excerpt.
 */
function hnTextToPlain(text: string): string {
  return text
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>.*?<\/a>/gis, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&(#x?[0-9a-f]+|[a-z]+);/gi,
      (m, e: string) => HTML_ENTITIES[e.toLowerCase().replace(/^#/, "")] ?? m,
    );
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface HnAdapterOptions {
  /** API base, no trailing slash. Default `HN_API_BASE`. */
  baseUrl?: string;
  /** Terms a hit must match to be kept. Default `HN_AI_TERMS`. */
  aiTerms?: readonly string[];
  /** hitsPerPage for the paginated show_hn query. Default 200. */
  hitsPerPage?: number;
  /** Page cap per query (courtesy). Default 5. */
  maxPages?: number;
  /** Min ms between request starts (≤1 req/s courtesy). Default 1000. */
  minRequestIntervalMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHnAlgoliaAdapter(opts: HnAdapterOptions = {}): SourceAdapter {
  const baseUrl = (opts.baseUrl ?? HN_API_BASE).replace(/\/+$/, "");
  const hitsPerPage = opts.hitsPerPage ?? 200;
  const maxPages = opts.maxPages ?? 5;
  const minInterval = opts.minRequestIntervalMs ?? 1000;
  const matchesAi = compileAiTermMatcher(opts.aiTerms ?? HN_AI_TERMS);

  const frontPageUrl = `${baseUrl}/search?tags=front_page&hitsPerPage=${Math.min(hitsPerPage, 50)}`;
  const showHnUrl = (window: FetchWindow, page: number) =>
    `${baseUrl}/search_by_date?tags=show_hn` +
    `&numericFilters=${encodeURIComponent(
      `created_at_i>=${Math.floor(window.from.getTime() / 1000)},created_at_i<=${Math.floor(
        window.to.getTime() / 1000,
      )}`,
    )}&hitsPerPage=${hitsPerPage}&page=${page}`;

  /** Sequential GETs ≥ minInterval apart; throws only to the caller's catch. */
  async function getJson(url: string, ctx: AdapterContext, lastStart: { t: number }) {
    const wait = lastStart.t + minInterval - Date.now();
    if (lastStart.t > 0 && wait > 0) await sleep(wait);
    lastStart.t = Date.now();
    const res = await ctx.fetch(url, { headers: { "user-agent": ctx.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return (await res.json()) as unknown;
  }

  return {
    id: HN_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      const lastStart = { t: 0 };
      const byObjectId = new Map<string, RawItem>();

      // front_page snapshot — per-query failure degrades, never kills the run.
      try {
        const body = await getJson(frontPageUrl, c, lastStart);
        for (const item of this.map(body, fetchedAt)) byObjectId.set(item.source_ids.hn_object_id!, item);
      } catch {
        // degraded: continue with show_hn
      }

      // show_hn stream — paginated, window-bounded server-side + client-side.
      for (let page = 0; page < maxPages; page++) {
        let body: unknown;
        try {
          body = await getJson(showHnUrl(window, page), c, lastStart);
        } catch {
          break; // degraded: keep what we have
        }
        const items = this.map(body, fetchedAt);
        for (const item of items) {
          const t = Date.parse(item.published_at);
          if (t >= window.from.getTime() && t <= window.to.getTime()) {
            byObjectId.set(item.source_ids.hn_object_id!, item);
          }
        }
        const resp = body as HnSearchResponse;
        if ((resp.page ?? 0) + 1 >= (resp.nbPages ?? 1)) break;
      }

      return [...byObjectId.values()];
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      try {
        const res = await c.fetch(`${baseUrl}/search?tags=front_page&hitsPerPage=1`, {
          headers: { "user-agent": c.userAgent },
        });
        return { ok: res.ok, detail: `${baseUrl} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      const hits = (payload as HnSearchResponse).hits ?? [];
      const items: RawItem[] = [];
      for (const hit of hits) {
        if (!hit.objectID || !hit.title?.trim() || !hit.created_at) continue;

        const plainText = hit.story_text ? hnTextToPlain(hit.story_text) : "";
        if (!matchesAi(`${hit.title} ${plainText}`)) continue;

        // Show HN self-posts carry the submitter's text — that's the excerpt.
        // Link posts have none; the headline stands in (it is publisher text,
        // never our prose).
        const excerpt = toExcerpt(plainText.trim() ? plainText : hit.title);

        const item: RawItem = {
          headline: hit.title,
          canonical_url: hit.url?.trim() ? hit.url : hnItemUrl(hit.objectID),
          publisher: "Hacker News",
          published_at: hit.created_at,
          fetched_at: fetchedAt.toISOString(),
          excerpt,
          source_ids: { hn_object_id: hit.objectID },
        };
        if (typeof hit.points === "number" && hit.points >= 0) item.hn_points = hit.points;
        if (typeof hit.num_comments === "number" && hit.num_comments >= 0) {
          item.hn_comments = hit.num_comments;
        }
        items.push(item);
      }
      return items;
    },
  };
}
