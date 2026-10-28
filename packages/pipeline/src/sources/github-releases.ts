/**
 * A6 — `github-releases`: GitHub Releases API for flagship OSS (PLAN §5.1).
 *
 * Feeds Models & Releases. Each `gh-*` source entry in
 * `config/sources.yaml` is one repo — its `endpoint` is that repo's
 * `…/repos/<owner>/<repo>/releases` REST URL, and the adapter is built
 * per entry (the repo list lives in config, never in code).
 *
 * Unauthenticated rate limits apply (60 req/hr per IP): the adapter
 * fetches newest-first pages and stops as soon as the window is covered —
 * a short page, a page whose oldest release predates `window.from`, or
 * `maxPages`, whichever comes first. Requests run sequentially with ≥
 * `minRequestIntervalMs` between starts; a failed page degrades to
 * whatever earlier pages returned and `health()` never throws.
 *
 * Mapping (per release):
 *  - `headline`      ← release `name` (falls back to `tag_name`)
 *  - `canonical_url` ← `html_url` (the release page)
 *  - `publisher`     ← `opts.publisher` ?? `GitHub: <owner>/<repo>`
 *  - `published_at`  ← `published_at` (falls back to `created_at`)
 *  - `excerpt`       ← release-notes `body`, ≤300 chars (headline if empty)
 *  - `source_ids`    ← `{ github_repo, github_release_tag }`
 *
 * Drafts are skipped; prereleases are real releases and are kept.
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

export const GITHUB_RELEASES_ADAPTER_ID = "github-releases";

/** Extract `owner/repo` from a `…/repos/<owner>/<repo>/releases` endpoint. */
export function repoFromReleasesEndpoint(endpoint: string): string | undefined {
  return /\/repos\/([^/]+\/[^/]+)\/releases/.exec(endpoint)?.[1];
}

// ---------------------------------------------------------------------------
// GitHub REST response shape (the slice we read — the API returns more)
// ---------------------------------------------------------------------------

interface GitHubRelease {
  tag_name?: string;
  name?: string | null;
  html_url?: string;
  published_at?: string | null;
  created_at?: string;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
}

export interface GitHubReleasesAdapterOptions {
  /** Source entry's endpoint: `…/repos/<owner>/<repo>/releases`. */
  endpoint: string;
  /** Publisher display name override. Default `GitHub: <owner>/<repo>`. */
  publisher?: string;
  /** Releases per page (GitHub max 100). Default 100. */
  perPage?: number;
  /** Page cap — courtesy under the 60 req/hr unauthenticated budget. Default 3. */
  maxPages?: number;
  /** Min ms between request starts. Default 1000. */
  minRequestIntervalMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createGitHubReleasesAdapter(
  opts: GitHubReleasesAdapterOptions,
): SourceAdapter {
  const repo = repoFromReleasesEndpoint(opts.endpoint);
  if (repo === undefined) {
    throw new Error(
      `github-releases: endpoint ${opts.endpoint} is not a …/repos/<owner>/<repo>/releases URL`,
    );
  }
  const publisher = opts.publisher ?? `GitHub: ${repo}`;
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 3;
  const minInterval = opts.minRequestIntervalMs ?? 1000;
  const base = opts.endpoint.replace(/\/+$/, "");

  /** Sequential GETs ≥ minInterval apart; throws only to the caller's catch. */
  async function getJson(url: string, ctx: AdapterContext, lastStart: { t: number }) {
    const wait = lastStart.t + minInterval - Date.now();
    if (lastStart.t > 0 && wait > 0) await sleep(wait);
    lastStart.t = Date.now();
    const res = await ctx.fetch(url, {
      headers: {
        "user-agent": ctx.userAgent,
        accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return (await res.json()) as unknown;
  }

  const adapter: SourceAdapter = {
    id: GITHUB_RELEASES_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      const lastStart = { t: 0 };
      const items: RawItem[] = [];

      for (let page = 1; page <= maxPages; page++) {
        const url = `${base}?per_page=${perPage}&page=${page}`;
        let body: unknown;
        try {
          body = await getJson(url, c, lastStart);
        } catch {
          break; // degraded: keep what earlier pages returned
        }
        const releases = Array.isArray(body) ? (body as GitHubRelease[]) : [];
        let oldest = Number.POSITIVE_INFINITY;
        for (const item of adapter.map(releases, fetchedAt)) {
          const t = Date.parse(item.published_at);
          if (t >= window.from.getTime() && t <= window.to.getTime()) items.push(item);
          if (t < oldest) oldest = t;
        }
        // Sorted newest-first: a short page or a page older than the window
        // means the window is fully covered.
        if (releases.length < perPage || oldest < window.from.getTime()) break;
      }
      return items;
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      try {
        const res = await c.fetch(`${base}?per_page=1`, {
          headers: {
            "user-agent": c.userAgent,
            accept: "application/vnd.github+json",
          },
        });
        return { ok: res.ok, detail: `${base} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      const releases = Array.isArray(payload) ? (payload as GitHubRelease[]) : [];
      const items: RawItem[] = [];
      for (const rel of releases) {
        if (rel.draft === true) continue;
        const published = rel.published_at ?? rel.created_at;
        if (typeof rel.html_url !== "string" || published === null || published === undefined) {
          continue;
        }
        const tag = rel.tag_name ?? "";
        const headline = rel.name?.trim() ? rel.name.trim() : tag;
        if (!headline) continue;
        items.push({
          headline,
          canonical_url: rel.html_url,
          publisher,
          published_at: published,
          fetched_at: fetchedAt.toISOString(),
          excerpt: toExcerpt(rel.body?.trim() ? rel.body : headline),
          source_ids: { github_repo: repo, github_release_tag: tag },
        });
      }
      return items;
    },
  };
  return adapter;
}
