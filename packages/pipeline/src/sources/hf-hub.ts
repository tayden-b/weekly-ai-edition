/**
 * A6 — `hf-hub`: Hugging Face Hub API — new model repos from the lab orgs
 * (PLAN §5.1 Models & Releases).
 *
 * The configured source entry (`hf-hub-models`) carries the lab-org list
 * in `meta.orgs`; the adapter receives it via `opts.orgs` — the list
 * lives in config, never in code. Per org it fetches
 * `?author=<org>&sort=createdAt&direction=-1` pages and keeps models whose
 * `createdAt` is inside the fetch window; pagination stops on a short
 * page, on a page whose oldest model predates `window.from` (sorted
 * newest-first), or at `maxPages`. Per-org failures degrade to the other
 * orgs' items; `health()` never throws.
 *
 * Mapping (per model record):
 *  - `headline`      ← model `id` ("org/name" — the repo's own name)
 *  - `canonical_url` ← `https://huggingface.co/<id>`
 *  - `publisher`     ← the org segment of `id` — the entity that published
 *                      (`author` is null in list responses, so it is
 *                      derived from `id`)
 *  - `published_at`  ← `createdAt`
 *  - `excerpt`       ← model id + `pipeline_tag`, ≤300 chars
 *  - `source_ids`    ← `{ hf_model_id }`
 *
 * Private models and records without `createdAt` are skipped.
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

export const HF_HUB_ADAPTER_ID = "hf-hub";
export const HF_HUB_API_ENDPOINT = "https://huggingface.co/api/models";

// ---------------------------------------------------------------------------
// HF Hub list-response shape (the slice we read — the API returns more)
// ---------------------------------------------------------------------------

interface HfModel {
  id?: string;
  author?: string | null;
  createdAt?: string;
  pipeline_tag?: string | null;
  private?: boolean;
}

export interface HfHubAdapterOptions {
  /** Lab orgs to scan — from `sources.yaml → hf-hub-models.meta.orgs`. Required. */
  orgs: readonly string[];
  /** List endpoint. Default `HF_HUB_API_ENDPOINT`. */
  endpoint?: string;
  /** Models per page per org. Default 100. */
  limit?: number;
  /** Page cap per org (courtesy). Default 3. */
  maxPages?: number;
  /** Min ms between request starts. Default 1000. */
  minRequestIntervalMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHfHubAdapter(opts: HfHubAdapterOptions): SourceAdapter {
  if (opts.orgs.length === 0) {
    throw new Error("hf-hub: opts.orgs must list at least one org (config meta.orgs)");
  }
  const orgs = [...opts.orgs];
  const endpoint = (opts.endpoint ?? HF_HUB_API_ENDPOINT).replace(/\/+$/, "");
  const limit = opts.limit ?? 100;
  const maxPages = opts.maxPages ?? 3;
  const minInterval = opts.minRequestIntervalMs ?? 1000;

  /** Sequential GETs ≥ minInterval apart; throws only to the caller's catch. */
  async function getJson(url: string, ctx: AdapterContext, lastStart: { t: number }) {
    const wait = lastStart.t + minInterval - Date.now();
    if (lastStart.t > 0 && wait > 0) await sleep(wait);
    lastStart.t = Date.now();
    const res = await ctx.fetch(url, { headers: { "user-agent": ctx.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return (await res.json()) as unknown;
  }

  const adapter: SourceAdapter = {
    id: HF_HUB_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      const lastStart = { t: 0 };
      const byModelId = new Map<string, RawItem>();

      for (const org of orgs) {
        for (let page = 0; page < maxPages; page++) {
          const url =
            `${endpoint}?author=${encodeURIComponent(org)}` +
            `&sort=createdAt&direction=-1&limit=${limit}&skip=${page * limit}`;
          let body: unknown;
          try {
            body = await getJson(url, c, lastStart);
          } catch {
            break; // degraded: keep other orgs' items
          }
          const models = Array.isArray(body) ? (body as HfModel[]) : [];
          let oldest = Number.POSITIVE_INFINITY;
          for (const item of adapter.map(models, fetchedAt)) {
            const t = Date.parse(item.published_at);
            if (t >= window.from.getTime() && t <= window.to.getTime()) {
              byModelId.set(item.source_ids.hf_model_id!, item);
            }
            if (t < oldest) oldest = t;
          }
          // Sorted newest-first: short page or a page older than the window
          // means this org's window is fully covered.
          if (models.length < limit || oldest < window.from.getTime()) break;
        }
      }
      return [...byModelId.values()];
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      try {
        const res = await c.fetch(`${endpoint}?limit=1`, {
          headers: { "user-agent": c.userAgent },
        });
        return { ok: res.ok, detail: `${endpoint} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      const models = Array.isArray(payload) ? (payload as HfModel[]) : [];
      const items: RawItem[] = [];
      for (const m of models) {
        if (m.private === true) continue;
        if (typeof m.id !== "string" || !m.id || typeof m.createdAt !== "string") continue;
        // `author` is null in list responses — the org is id's first segment.
        const org = m.author ?? (m.id.includes("/") ? m.id.split("/")[0] : undefined);
        items.push({
          headline: m.id,
          canonical_url: `https://huggingface.co/${m.id}`,
          publisher: org ?? "Hugging Face Hub",
          published_at: m.createdAt,
          fetched_at: fetchedAt.toISOString(),
          excerpt: toExcerpt([m.id, m.pipeline_tag].filter(Boolean).join(" — ")),
          source_ids: { hf_model_id: m.id },
        });
      }
      return items;
    },
  };
  return adapter;
}
