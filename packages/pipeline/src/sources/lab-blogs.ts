/**
 * A1 — `lab-blogs` adapter (PLAN §5.1, Models & Releases row).
 *
 * One adapter covers every lab-blog source in `config/sources.yaml`
 * (`adapter: lab-blogs`): the primary sources for the Models page — OpenAI,
 * Anthropic, Google DeepMind, Google AI, Meta AI, Mistral, xAI, Microsoft
 * Research, Amazon Science, Moonshot/Kimi, DeepSeek, Alibaba Qwen and the
 * Hugging Face blog.
 *
 * Labs publish in three shapes, selected per source by the entry's `kind`:
 *
 *  - `rss`/`atom` — real feeds (OpenAI, DeepMind, Google AI, MS Research,
 *    Amazon Science, Hugging Face). Item `description`/`summary` (never
 *    `content:encoded`) becomes the ≤300-char excerpt; when absent the
 *    excerpt falls back to the headline.
 *  - `sitemap` — no feed exists (Anthropic, Mistral, Qwen). `<url>` blocks
 *    give `loc`+`lastmod`; `meta.include_paths` restricts to the blog/news
 *    subtrees; the headline is the humanized final path segment.
 *    A `<sitemapindex>` endpoint is walked one level (same origin only).
 *  - `html-index` — neither feed nor sitemap (Meta AI, xAI, Moonshot/Kimi,
 *    DeepSeek). Cards/sidebar anchors carry title + date; `meta.follow_first`
 *    marks endpoints that are an index-of-pages (DeepSeek: root page links to
 *    the latest `/news/newsNNNNNN` page whose sidebar lists every post).
 *
 * Degradation contract (§5.1): every source is fetched inside its own
 * try/catch — a failure lands in `lastReport()`/`health()`, never throws the
 * run. xAI's live endpoint is Cloudflare-gated (HTTP 403 verified 2026-10);
 * its fixture slice is verbatim x.ai markup fetched via the Wayback Machine,
 * so the parser is proven while live fetch degrades gracefully.
 *
 * ToS posture: we store headline, canonical URL, publisher, published_at,
 * fetched_at, ≤300-char excerpt and source ids only — never article bodies,
 * never `content:encoded`. See `lab-blogs.LICENSE.md`.
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

export const LAB_BLOGS_ADAPTER_ID = "lab-blogs";

export interface LabBlogsAdapterOptions {
  /** Every `adapter: lab-blogs` entry from config/sources.yaml. */
  sources: SourceEntry[];
  /** Courtesy gap between requests to the same host (ms). Default 1100. */
  requestGapMs?: number;
  /** Per-request timeout (ms). Default 15000. */
  requestTimeoutMs?: number;
}

/** One line of the per-source report from the most recent `fetch()`. */
export interface SourceRunReport {
  source: string;
  ok: boolean;
  detail: string;
  items: number;
}

export interface LabBlogsAdapter extends SourceAdapter {
  /** Per-source outcome of the last `fetch()` — drives page degradation. */
  lastReport(): SourceRunReport[];
}

// ---------------------------------------------------------------------------
// Text + date helpers
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  deg: "°",
  times: "×",
  middot: "·",
};

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s: string): string {
  let out = s;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = out.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, ent: string) => {
      if (ent.startsWith("#x") || ent.startsWith("#X")) {
        const cp = Number.parseInt(ent.slice(2), 16);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : all;
      }
      if (ent.startsWith("#")) {
        const cp = Number.parseInt(ent.slice(1), 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : all;
      }
      return ENTITIES[ent] ?? all;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Raw markup → clean single-line text (entities decoded, tags stripped). */
function cleanText(s: string | undefined): string {
  return decodeEntities(stripCdata(s ?? "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MONTH_RE = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

/**
 * Parse the date forms lab sites use — ISO `lastmod`, RFC-822 `pubDate`,
 * `YYYY/MM/DD` (DeepSeek sidebar), `Jul 27, 2026` (Meta/xAI cards),
 * `YYYY-MM-DD` (Kimi cards). Date-only forms are interpreted as UTC so the
 * result never depends on the machine's timezone.
 */
export function parseLabDate(raw: string | undefined): Date | undefined {
  const s = raw?.trim();
  if (!s) return undefined;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));

  m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));

  m = new RegExp(`\\b(${MONTH_RE})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i").exec(s);
  if (m) return new Date(Date.UTC(+m[3]!, MONTHS[m[1]!.slice(0, 3).toLowerCase()]!, +m[2]!));

  m = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})[a-z]*\\.?,?\\s+(\\d{4})\\b`, "i").exec(s);
  if (m) return new Date(Date.UTC(+m[3]!, MONTHS[m[2]!.slice(0, 3).toLowerCase()]!, +m[1]!));

  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t);
}

/** Scan arbitrary markup/text for the first recognizable date. */
function findDateInText(s: string): Date | undefined {
  let m = /(20\d\d)-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  m = /(20\d\d)\/(\d{1,2})\/(\d{1,2})/.exec(s);
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  m = new RegExp(`\\b(${MONTH_RE})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i").exec(s);
  if (m) return new Date(Date.UTC(+m[3]!, MONTHS[m[1]!.slice(0, 3).toLowerCase()]!, +m[2]!));
  m = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_RE})[a-z]*\\.?,?\\s+(\\d{4})\\b`, "i").exec(s);
  if (m) return new Date(Date.UTC(+m[3]!, MONTHS[m[2]!.slice(0, 3).toLowerCase()]!, +m[1]!));
  return undefined;
}

function lastPathSegment(url: string): string {
  const segs = url.replace(/\/+$/, "").split("/");
  return segs[segs.length - 1] ?? "";
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/\.(xml|json|html?)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .trim();
}

function hostnameOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "");
}

// ---------------------------------------------------------------------------
// Draft items + per-kind parsers
// ---------------------------------------------------------------------------

interface DraftItem {
  headline: string;
  url: string;
  publishedAt?: Date;
  excerpt?: string;
  sourceIds?: Record<string, string>;
}

/** `tag(inner markup)` → array of element bodies. */
function tagBlocks(body: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  return [...body.matchAll(re)].map((m) => m[1]!);
}

function firstTag(block: string, names: string[]): string | undefined {
  for (const name of names) {
    const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(block);
    if (m) return m[1];
  }
  return undefined;
}

/** Atom-style `<link href="…">`: prefer rel="alternate" or no rel. */
function linkHref(block: string): string | undefined {
  const links = [...block.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]);
  const relOf = (l: string) => /\brel="([^"]*)"/.exec(l)?.[1];
  const pick =
    links.find((l) => relOf(l) === "alternate") ??
    links.find((l) => relOf(l) === undefined) ??
    links[0];
  return pick ? /\bhref="([^"]*)"/.exec(pick)?.[1] : undefined;
}

function absolutize(href: string, origin: string): string | undefined {
  try {
    return new URL(href, origin).toString();
  } catch {
    return undefined;
  }
}

// --- rss / atom -------------------------------------------------------------

function parseFeedXml(body: string, origin: string): DraftItem[] {
  const drafts: DraftItem[] = [];

  for (const block of tagBlocks(body, "item")) {
    const headline = cleanText(firstTag(block, ["title"]));
    const href = linkHref(block) ?? cleanText(firstTag(block, ["link"]));
    const url = href ? absolutize(href, origin) : undefined;
    const publishedAt = parseLabDate(
      cleanText(firstTag(block, ["pubDate", "published", "updated", "dc:date", "date"])),
    );
    const excerpt = cleanText(firstTag(block, ["description", "summary"])) || headline;
    const guid = cleanText(firstTag(block, ["guid"]));
    if (!headline || !url) continue;
    drafts.push({
      headline,
      url,
      excerpt,
      sourceIds: guid ? { guid } : { slug: lastPathSegment(url) },
      ...(publishedAt ? { publishedAt } : {}),
    });
  }

  for (const block of tagBlocks(body, "entry")) {
    const headline = cleanText(firstTag(block, ["title"]));
    const href = linkHref(block) ?? cleanText(firstTag(block, ["link"]));
    const url = href ? absolutize(href, origin) : undefined;
    const publishedAt = parseLabDate(
      cleanText(firstTag(block, ["published", "updated", "pubDate", "dc:date"])),
    );
    const excerpt = cleanText(firstTag(block, ["summary", "content"])) || headline;
    const id = cleanText(firstTag(block, ["id"]));
    if (!headline || !url) continue;
    drafts.push({
      headline,
      url,
      excerpt,
      sourceIds: id ? { guid: id } : { slug: lastPathSegment(url) },
      ...(publishedAt ? { publishedAt } : {}),
    });
  }

  return drafts;
}

// --- sitemap ----------------------------------------------------------------

function isSitemapIndex(body: string): boolean {
  return /<sitemapindex\b/i.test(body);
}

/** `<loc>` of each child `<sitemap>` in a sitemapindex, same-origin only. */
function sitemapIndexChildren(body: string, origin: string): string[] {
  const out: string[] = [];
  for (const block of tagBlocks(body, "sitemap")) {
    const loc = cleanText(firstTag(block, ["loc"]));
    if (!loc) continue;
    try {
      if (new URL(loc).origin === new URL(origin).origin) out.push(loc);
    } catch {
      // skip malformed loc
    }
  }
  return out;
}

function parseSitemapUrlset(body: string, includePaths?: string[]): DraftItem[] {
  const drafts: DraftItem[] = [];
  for (const block of tagBlocks(body, "url")) {
    const loc = cleanText(firstTag(block, ["loc"]));
    if (!loc) continue;
    let pathname: string;
    try {
      pathname = new URL(loc).pathname;
    } catch {
      continue;
    }
    if (includePaths && !includePaths.some((p) => pathname.includes(p))) continue;
    const publishedAt = parseLabDate(cleanText(firstTag(block, ["lastmod"])));
    const slug = lastPathSegment(pathname);
    const headline = humanizeSlug(slug);
    if (!headline) continue;
    drafts.push({
      headline,
      url: loc,
      excerpt: headline,
      sourceIds: { slug },
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return drafts;
}

// --- html-index -------------------------------------------------------------

interface Anchor {
  href: string;
  ariaLabel?: string;
  inner: string;
  /** Index just past `</a>` — dates on card layouts follow the anchor. */
  end: number;
}

function anchorsOf(body: string): Anchor[] {
  const out: Anchor[] = [];
  for (const m of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const attrs = m[1]!;
    const href = /\bhref="([^"]*)"/.exec(attrs)?.[1];
    if (!href) continue;
    const ariaLabel = /\baria-label="([^"]*)"/.exec(attrs)?.[1];
    out.push({
      href,
      inner: m[2]!,
      end: m.index! + m[0].length,
      ...(ariaLabel !== undefined ? { ariaLabel } : {}),
    });
  }
  return out;
}

function dateAfter(body: string, end: number, span = 2500): Date | undefined {
  return findDateInText(body.slice(end, end + span));
}

/** ai.meta.com/blog/ — card anchors `aria-label="Read TITLE"`, date right after. */
function extractMetaBlog(body: string): DraftItem[] {
  const bySlug = new Map<string, DraftItem>();
  for (const a of anchorsOf(body)) {
    const m = /^https:\/\/ai\.meta\.com\/blog\/([a-z0-9-]+)\/?$/i.exec(a.href);
    if (!m) continue;
    const slug = m[1]!;
    const headline = cleanText(a.ariaLabel?.replace(/^read\s+/i, "") ?? a.inner);
    if (!headline) continue;
    const publishedAt = dateAfter(body, a.end);
    const prev = bySlug.get(slug);
    if (prev?.publishedAt && !publishedAt) continue;
    bySlug.set(slug, {
      headline,
      url: `https://ai.meta.com/blog/${slug}/`,
      excerpt: headline,
      sourceIds: { slug },
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return [...bySlug.values()];
}

/** x.ai/news — whole card inside one anchor: h3 title, p blurb, date div. */
function extractXaiNews(body: string): DraftItem[] {
  const bySlug = new Map<string, DraftItem>();
  for (const a of anchorsOf(body)) {
    const m = /^(?:https:\/\/x\.ai)?\/news\/([a-z0-9-]+)\/?$/i.exec(a.href);
    if (!m) continue;
    const slug = m[1]!;
    const headline =
      cleanText(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(a.inner)?.[1]) || humanizeSlug(slug);
    const blurb = cleanText(/<p[^>]*>([\s\S]*?)<\/p>/.exec(a.inner)?.[1]);
    const publishedAt = findDateInText(a.inner);
    const prev = bySlug.get(slug);
    if (prev?.publishedAt && !publishedAt) continue;
    bySlug.set(slug, {
      headline,
      url: `https://x.ai/news/${slug}`,
      excerpt: blurb || headline,
      sourceIds: { slug },
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return [...bySlug.values()];
}

/** kimi.com/en/blog/ — overlay anchor `aria-label="TITLE"`, `YYYY-MM-DD` after. */
function extractKimiBlog(body: string): DraftItem[] {
  const bySlug = new Map<string, DraftItem>();
  for (const a of anchorsOf(body)) {
    const m = /^(?:https:\/\/(?:www\.)?kimi\.(?:com|ai))?\/en\/blog\/([a-z0-9-]+)\/?$/i.exec(a.href);
    if (!m) continue;
    const slug = m[1]!;
    const headline = cleanText(a.ariaLabel ?? a.inner);
    if (!headline) continue;
    const publishedAt = dateAfter(body, a.end);
    const prev = bySlug.get(slug);
    if (prev?.publishedAt && !publishedAt) continue;
    bySlug.set(slug, {
      headline,
      url: `https://www.kimi.com/en/blog/${slug}`,
      excerpt: headline,
      sourceIds: { slug },
      ...(publishedAt ? { publishedAt } : {}),
    });
  }
  return [...bySlug.values()];
}

/** api-docs.deepseek.com/news/* — sidebar anchors `Title YYYY/MM/DD`. */
function extractDeepseekSidebar(body: string): DraftItem[] {
  const bySlug = new Map<string, DraftItem>();
  for (const a of anchorsOf(body)) {
    const m = /^\/news\/(news\d+)\/?$/i.exec(a.href);
    if (!m) continue;
    const slug = m[1]!;
    const text = cleanText(a.inner).replace(/^(next|previous)\s*[|·-]\s*/i, "").trim();
    const dm = /(20\d\d)\/(\d{1,2})\/(\d{1,2})\s*$/.exec(text);
    if (!dm) continue; // nav/menu links without a date are not posts
    const headline = text.slice(0, dm.index).trim();
    if (!headline) continue;
    const publishedAt = new Date(Date.UTC(+dm[1]!, +dm[2]! - 1, +dm[3]!));
    bySlug.set(slug, {
      headline,
      url: `https://api-docs.deepseek.com/news/${slug}`,
      excerpt: headline,
      sourceIds: { slug },
      publishedAt,
    });
  }
  return [...bySlug.values()];
}

const HTML_EXTRACTORS: Record<string, (body: string) => DraftItem[]> = {
  "meta-ai-blog": extractMetaBlog,
  "xai-news": extractXaiNews,
  "moonshot-news": extractKimiBlog,
  "deepseek-news": extractDeepseekSidebar,
};

/**
 * Fallback for html-index sources without a dedicated extractor: same-origin
 * anchors under the endpoint's path prefix that carry a nearby date.
 */
function extractGenericIndex(body: string, entry: SourceEntry): DraftItem[] {
  const origin = new URL(entry.endpoint).origin;
  const prefix = entry.endpoint.replace(/[^/]+$/, ""); // endpoint directory
  const drafts: DraftItem[] = [];
  for (const a of anchorsOf(body)) {
    const url = absolutize(a.href, origin);
    if (!url || !url.startsWith(prefix) || url === entry.endpoint) continue;
    const publishedAt = findDateInText(a.inner) ?? dateAfter(body, a.end, 1500);
    const headline = cleanText(a.ariaLabel ?? a.inner);
    if (!publishedAt || headline.length < 8) continue;
    drafts.push({
      headline,
      url,
      excerpt: headline,
      sourceIds: { slug: lastPathSegment(url) },
      publishedAt,
    });
  }
  return drafts;
}

// ---------------------------------------------------------------------------
// Config/meta plumbing + payload attribution
// ---------------------------------------------------------------------------

interface LabMeta {
  publisher?: string;
  include_paths?: string[];
  follow_first?: string;
}

function labMeta(entry: SourceEntry): LabMeta {
  const meta = (entry.meta ?? {}) as Record<string, unknown>;
  const out: LabMeta = {};
  if (typeof meta.publisher === "string") out.publisher = meta.publisher;
  if (Array.isArray(meta.include_paths)) {
    out.include_paths = meta.include_paths.filter((p): p is string => typeof p === "string");
  }
  if (typeof meta.follow_first === "string") out.follow_first = meta.follow_first;
  return out;
}

/** The `map()` payload may carry its source explicitly. */
interface WrappedPayload {
  source: string;
  body: string;
}

function isWrapped(p: unknown): p is WrappedPayload {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as WrappedPayload).source === "string" &&
    typeof (p as WrappedPayload).body === "string"
  );
}

/**
 * Attribute a bare fixture body to its source: the endpoint hostname appears
 * all over a real response body (canonical links, locs, hrefs), so the source
 * whose hostname occurs most wins. Returns undefined on a clean miss.
 */
function detectSourceId(body: string, entries: SourceEntry[]): string | undefined {
  let bestId: string | undefined;
  let bestScore = 0;
  for (const e of entries) {
    const host = hostnameOf(e.endpoint);
    const score = body.split(host).length - 1;
    if (score > bestScore) {
      bestScore = score;
      bestId = e.id;
    }
  }
  return bestId;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export function createLabBlogsAdapter(opts: LabBlogsAdapterOptions): LabBlogsAdapter {
  const entries = opts.sources.filter((s) => s.adapter === LAB_BLOGS_ADAPTER_ID);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const requestGapMs = opts.requestGapMs ?? 1100;
  const requestTimeoutMs = opts.requestTimeoutMs ?? 15_000;
  let report: SourceRunReport[] = [];

  function publisherOf(entry: SourceEntry): string {
    return labMeta(entry).publisher ?? humanizeSlug(entry.id.replace(/-(blog|news)$/, ""));
  }

  function parseByKind(entry: SourceEntry, body: string): DraftItem[] {
    try {
      switch (entry.kind) {
        case "rss":
        case "atom":
          return parseFeedXml(body, new URL(entry.endpoint).origin);
        case "sitemap":
          return isSitemapIndex(body)
            ? [] // children are fetched in fetch(), not map()
            : parseSitemapUrlset(body, labMeta(entry).include_paths);
        case "html-index":
        case "json-api": {
          // json-api is config-debt for DeepSeek's HTML docs pages — treat as HTML.
          const extractor = HTML_EXTRACTORS[entry.id] ?? ((b: string) => extractGenericIndex(b, entry));
          return extractor(body);
        }
        default:
          return [];
      }
    } catch {
      return []; // a malformed body degrades to no items, never a throw
    }
  }

  function toItems(drafts: DraftItem[], entry: SourceEntry, fetchedAt: Date): RawItem[] {
    const publisher = publisherOf(entry);
    const items: RawItem[] = [];
    for (const d of drafts) {
      if (!d.headline || !d.url || !d.publishedAt) continue; // never fabricate dates
      items.push({
        headline: d.headline,
        canonical_url: d.url,
        publisher,
        published_at: d.publishedAt.toISOString(),
        fetched_at: fetchedAt.toISOString(),
        excerpt: toExcerpt(d.excerpt || d.headline),
        source_ids: d.sourceIds ?? {},
      });
    }
    return items;
  }

  const lastRequestAt = new Map<string, number>();

  async function getText(url: string, ctx: AdapterContext): Promise<string> {
    const host = new URL(url).hostname;
    const wait = requestGapMs - (Date.now() - (lastRequestAt.get(host) ?? 0));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt.set(host, Date.now());
    const res = await ctx.fetch(url, {
      headers: {
        "user-agent": ctx.userAgent,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  function inWindow(item: RawItem, window: FetchWindow): boolean {
    const t = Date.parse(item.published_at);
    return t >= window.from.getTime() && t <= window.to.getTime();
  }

  async function fetchOne(
    entry: SourceEntry,
    window: FetchWindow,
    ctx: AdapterContext,
  ): Promise<RawItem[]> {
    const fetchedAt = ctx.now();
    const origin = new URL(entry.endpoint).origin;
    let body = await getText(entry.endpoint, ctx);

    if (entry.kind === "sitemap" && isSitemapIndex(body)) {
      const drafts: DraftItem[] = [];
      for (const child of sitemapIndexChildren(body, entry.endpoint).slice(0, 8)) {
        const childBody = await getText(child, ctx);
        drafts.push(...parseSitemapUrlset(childBody, labMeta(entry).include_paths));
      }
      return toItems(drafts, entry, fetchedAt).filter((i) => inWindow(i, window));
    }

    const follow = labMeta(entry).follow_first;
    if (follow) {
      const href = anchorsOf(body)
        .map((a) => a.href)
        .find((h) => new RegExp(follow).test(h));
      if (href) {
        const next = absolutize(href, origin);
        if (next) body = await getText(next, ctx);
      }
    }

    return toItems(parseByKind(entry, body), entry, fetchedAt).filter((i) =>
      inWindow(i, window),
    );
  }

  return {
    id: LAB_BLOGS_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const out: RawItem[] = [];
      const seen = new Set<string>();
      report = [];
      for (const entry of entries.filter((e) => e.enabled)) {
        try {
          const items = await fetchOne(entry, window, c);
          for (const item of items) {
            if (seen.has(item.canonical_url)) continue;
            seen.add(item.canonical_url);
            out.push(item);
          }
          report.push({ source: entry.id, ok: true, detail: `${items.length} item(s)`, items: items.length });
        } catch (err) {
          report.push({ source: entry.id, ok: false, detail: String(err), items: 0 });
        }
      }
      return out;
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const lines: string[] = [];
      let allOk = true;
      for (const entry of entries) {
        if (!entry.enabled) {
          lines.push(`${entry.id}: disabled`);
          continue;
        }
        try {
          await getText(entry.endpoint, c);
          lines.push(`${entry.id}: ok`);
        } catch (err) {
          allOk = false;
          lines.push(`${entry.id}: ${String(err)}`);
        }
      }
      return { ok: allOk, detail: lines.join("; "), checked_at: c.now().toISOString() };
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      let sourceId: string | undefined;
      let body: string;
      if (isWrapped(payload)) {
        sourceId = payload.source;
        body = payload.body;
      } else if (typeof payload === "string") {
        body = payload;
        sourceId = detectSourceId(body, entries);
      } else {
        return [];
      }
      const entry = sourceId ? byId.get(sourceId) : undefined;
      if (!entry || body.trim() === "") return [];
      return toItems(parseByKind(entry, body), entry, fetchedAt);
    },

    lastReport(): SourceRunReport[] {
      return report;
    },
  };
}
