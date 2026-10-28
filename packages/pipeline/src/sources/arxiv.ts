/**
 * A7 — `arxiv`: lab-org papers from the arXiv API (PLAN §5.1, Performance).
 *
 * Endpoint: `https://export.arxiv.org/api/query` (Atom). arXiv's robots.txt
 * disallows crawling the HTML site; the export API is the sanctioned
 * machine-access path — ToU: free for non-commercial use, identify via UA,
 * ≤1 request per 3 seconds, bulk via Kaggle instead.
 *
 * Query design:
 *  - The API has no affiliation field, so per lab org we query
 *    `all:"<org name>" AND (cat:cs.AI OR cat:cs.CL OR cat:cs.CV OR
 *    cat:cs.LG OR cat:stat.ML)` sorted by submittedDate. `all:` searches
 *    title/abstract/comments — this is a *recall* filter: it returns papers
 *    BY a lab org and papers merely ABOUT one; precise attribution is the
 *    classifier's job (P4), not the adapter's.
 *  - `published` (original submission date) is what the window bounds —
 *    `updated` would re-surface old papers on minor revisions.
 *  - `arxiv_id` strips the `vN` suffix: a version bump is the same paper,
 *    and dedupe across org queries keys on it.
 *  - One request per org, ≥3s between starts (arXiv ToU). A per-org failure
 *    degrades to the other orgs' items; `health()` never throws.
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

export const ARXIV_ADAPTER_ID = "arxiv";
export const ARXIV_API_BASE = "https://export.arxiv.org/api/query";

/** AI-benchmark-relevant arXiv subject categories. */
export const ARXIV_CATEGORIES: readonly string[] = [
  "cs.AI",
  "cs.CL",
  "cs.CV",
  "cs.LG",
  "stat.ML",
];

/** Lab orgs mirrored from config/sources.yaml → arxiv-lab-papers.meta. */
export const ARXIV_SEARCH_ORGS: readonly string[] = [
  "OpenAI",
  "Anthropic",
  "Google DeepMind",
  "Meta AI",
  "Microsoft Research",
  "DeepSeek",
  "Mistral AI",
  "Qwen",
];

// ---------------------------------------------------------------------------
// Atom parsing
// ---------------------------------------------------------------------------

interface AtomEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
}

interface AtomFeed {
  feed?: { entry?: AtomEntry | AtomEntry[] };
}

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

/** `http://arxiv.org/abs/2610.35269v2` → `2610.35269` (unversioned id). */
export function arxivIdOf(absUrl: string): string | null {
  const m = /arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})(v\d+)?$/i.exec(absUrl.trim());
  return m?.[1] ?? null;
}

/** One Atom feed document → RawItems (window filtering is fetch's job). */
function mapAtom(xml: string, fetchedAt: Date): RawItem[] {
  let doc: AtomFeed;
  try {
    doc = parser.parse(xml) as AtomFeed;
  } catch {
    return [];
  }
  const raw = doc.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const items: RawItem[] = [];
  for (const e of entries) {
    const idUrl = typeof e.id === "string" ? e.id.trim() : "";
    const arxivId = arxivIdOf(idUrl);
    const headline = typeof e.title === "string" ? e.title.replace(/\s+/g, " ").trim() : "";
    const published = typeof e.published === "string" ? e.published : "";
    if (!arxivId || !headline || Number.isNaN(Date.parse(published))) continue;
    items.push({
      headline,
      canonical_url: `https://arxiv.org/abs/${arxivId}`,
      publisher: "arXiv",
      published_at: new Date(published).toISOString(),
      fetched_at: fetchedAt.toISOString(),
      excerpt: toExcerpt(typeof e.summary === "string" ? e.summary : headline),
      source_ids: { arxiv_id: arxivId },
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface ArxivAdapterOptions {
  /** API base, no trailing slash. Default `ARXIV_API_BASE`. */
  baseUrl?: string;
  /** Lab org names to query (`all:"<org>"`). Default `ARXIV_SEARCH_ORGS`. */
  searchOrgs?: readonly string[];
  /** arXiv categories the query is bounded to. Default `ARXIV_CATEGORIES`. */
  categories?: readonly string[];
  /** max_results per org query (API cap 2000; default 50). */
  maxResults?: number;
  /** Min ms between request starts — arXiv ToU is ≤1 req/3s. Default 3100. */
  minRequestIntervalMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createArxivAdapter(opts: ArxivAdapterOptions = {}): SourceAdapter {
  const baseUrl = (opts.baseUrl ?? ARXIV_API_BASE).replace(/\/+$/, "");
  const orgs = opts.searchOrgs ?? ARXIV_SEARCH_ORGS;
  const categories = opts.categories ?? ARXIV_CATEGORIES;
  const maxResults = opts.maxResults ?? 50;
  const minInterval = opts.minRequestIntervalMs ?? 3100;

  const catClause = categories.map((c) => `cat:${c}`).join(" OR ");
  const queryUrl = (org: string) =>
    `${baseUrl}?search_query=${encodeURIComponent(`all:"${org}" AND (${catClause})`)}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;

  return {
    id: ARXIV_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      const lastStart = { t: 0 };
      const byId = new Map<string, RawItem>();

      for (const org of orgs) {
        let body: string;
        try {
          const wait = lastStart.t + minInterval - Date.now();
          if (lastStart.t > 0 && wait > 0) await sleep(wait);
          lastStart.t = Date.now();
          const res = await c.fetch(queryUrl(org), {
            headers: { "user-agent": c.userAgent },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status} from ${baseUrl}`);
          body = await res.text();
        } catch {
          continue; // org query failed — degrade to the other orgs
        }
        for (const item of this.map(body, fetchedAt)) {
          if (inWindow(item.published_at, window)) {
            byId.set(item.source_ids.arxiv_id!, item);
          }
        }
      }
      return [...byId.values()];
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      try {
        const res = await c.fetch(`${baseUrl}?search_query=all:electron&max_results=1`, {
          headers: { "user-agent": c.userAgent },
        });
        return { ok: res.ok, detail: `${baseUrl} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      return typeof payload === "string" ? mapAtom(payload, fetchedAt) : [];
    },
  };
}

function inWindow(iso: string, window: FetchWindow): boolean {
  const t = Date.parse(iso);
  return t >= window.from.getTime() && t <= window.to.getTime();
}
