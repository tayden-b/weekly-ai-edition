/**
 * A3 — newsroom RSS set adapter (PLAN §5.1: Launches + Deals + Discourse
 * secondary sources).
 *
 * One adapter (`newsroom-rss`) covers the whole §5.1 newsroom row —
 * TechCrunch AI, The Verge AI, Ars Technica AI, MIT Technology Review,
 * Reuters tech, Bloomberg tech — because they share the same shape: a
 * syndication feed (RSS 2.0 / Atom) or a link-only index page.
 *
 * Verified live on 2026-10-28 with the project UA:
 *   - TechCrunch AI      RSS 200   techcrunch.com/category/artificial-intelligence/feed/
 *   - The Verge AI       Atom 200  theverge.com/rss/ai-artificial-intelligence/index.xml
 *   - Ars Technica AI    RSS 200   arstechnica.com/tag/artificial-intelligence/feed/
 *   - MIT Tech Review    RSS 200   technologyreview.com/topic/artificial-intelligence/feed/
 *   - Bloomberg tech     RSS 200   bloomberg.com/feeds/technology/news.rss
 *                        (feeds.bloomberg.com 301s to www.bloomberg.com/feeds)
 *   - Reuters tech       BLOCKED   reuters.com/technology → HTTP 401 (DataDome
 *                        JS challenge); feeds.reuters.com NXDOMAIN, Reuters
 *                        Agency + arc outboundfeeds 404 — no public feed found.
 *
 * Design notes:
 *  - `map(payload)` is feed-agnostic and pure: it sniffs the recorded body
 *    (RSS / Atom / HTML) and normalizes to `RawItem`s, inferring the
 *    publisher from the feed's own title (or `og:site_name`). `fetch` then
 *    overrides `publisher` with the curated `meta.publisher` from
 *    `config/sources.yaml` when set, and tags each item with
 *    `source_ids.newsroom_feed = <sources.yaml entry id>` for provenance.
 *  - Per-feed failure degrades that feed only: a non-2xx response, an
 *    unparseable body, or a network error contributes zero items from that
 *    feed — `fetch` never throws. `health()` re-pings every configured feed
 *    and reports the aggregate.
 *  - Opinion/section tagging: feed `<category>` elements (RSS text values,
 *    Atom `term` attributes) are captured verbatim into `RawItem.categories`.
 *    That IS the mechanism the A3 brief asks for — downstream classification
 *    (P4) reads `categories` to flag opinion-ish items for Discourse
 *    (e.g. categories matching /opinion|commentary|editorial/i) and to route
 *    sections. No judgement is made here; labels pass through unchanged.
 *  - Never bodies: excerpts come from `<description>` / `<summary>` /
 *    `<content>` TEXT ONLY — `content:encoded` and HTML inside are stripped
 *    and truncated to ≤ `EXCERPT_MAX_CHARS`. When a feed gives no usable
 *    text (e.g. some MIT TR items ship an empty description), the headline
 *    is used — still verbatim publisher text, never a fabricated excerpt.
 *  - Items must carry a real publisher timestamp (pubDate / dc:date /
 *    published / updated / datePublished). Items without one are dropped —
 *    fabricating `published_at` would break §5.3 provenance.
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

export const NEWSROOM_ADAPTER_ID = "newsroom-rss";

/** One newsroom endpoint, as configured in `config/sources.yaml`. */
export interface NewsroomFeed {
  /** `sources.yaml` entry id, e.g. "techcrunch-ai" — stamped on source_ids. */
  id: string;
  /** Feed or index URL the adapter GETs. */
  endpoint: string;
  /** Curated publisher display name (entry `meta.publisher`); wins over the feed's own title. */
  publisher?: string;
  /** Entry `kind` hint (rss | atom | html-index) — the body sniff still decides the parser. */
  kind?: string;
}

export interface NewsroomAdapterOptions {
  feeds: NewsroomFeed[];
}

const ACCEPT_HEADER =
  "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8";

// ---------------------------------------------------------------------------
// Small XML/text helpers
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
});

function asList<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Pull the text out of a parsed node: "x", 5, or { "#text": "x", "@_a": "b" }. */
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

/** HTML named entities seen in real feed markup; numeric refs always decode. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  deg: "°",
  copy: "©",
  reg: "®",
  trade: "™",
};

/**
 * Decode entities inside CDATA/HTML fragments (fxp leaves CDATA text raw).
 * Exported for the other feed adapters (reddit-json's `.rss` fallback) —
 * same convention as hn-algolia's `compileAiTermMatcher`.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body.startsWith("#")) {
      const hex = body.startsWith("#x") || body.startsWith("#X");
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : m;
    }
    return NAMED_ENTITIES[body] ?? m;
  });
}

/** Reduce an HTML fragment to plain text: strip tags, decode entities. */
export function htmlToText(fragment: string): string {
  return decodeEntities(
    fragment
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

/** Publisher's own text → stored excerpt; never returns more than the cap. */
function excerptOf(rawText: string, headline: string): string {
  const text = toExcerpt(htmlToText(rawText));
  return text === "" ? toExcerpt(htmlToText(headline)) : text;
}

/** Parse any timestamp a feed might give; returns "" when unparseable. */
function toIsoTimestamp(raw: string): string {
  const t = Date.parse(raw);
  return Number.isNaN(t) ? "" : new Date(t).toISOString();
}

function tryParseXml(body: string): Record<string, unknown> | undefined {
  try {
    return parser.parse(body) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function looksLikeHtml(body: string): boolean {
  return /^\s*<!doctype html|^\s*<html[\s>]/i.test(body);
}

// ---------------------------------------------------------------------------
// RSS 2.0 (covers rdf:RDF too — same item shape under a different root)
// ---------------------------------------------------------------------------

type XmlNode = Record<string, unknown>;

function mapRssItems(channel: XmlNode | undefined, fetchedAt: Date): RawItem[] {
  const items = asList(channel?.item as XmlNode | XmlNode[] | undefined);
  const feedTitle = textOf(channel?.title);
  const out: RawItem[] = [];

  for (const it of items) {
    const headline = decodeEntities(textOf(it.title)).trim();
    const guid = textOf(it.guid);
    const isPerma = (it.guid as XmlNode | undefined)?.["@_isPermaLink"] !== "false";
    const link = textOf(it.link).trim() || (isPerma ? guid : "");
    const publishedRaw = textOf(it.pubDate) || textOf(it["dc:date"]) || textOf(it["dc_date"]);
    const published_at = toIsoTimestamp(publishedRaw);
    if (headline === "" || link === "" || published_at === "") continue;

    const categories = asList(it.category)
      .map((c) => decodeEntities(textOf(c)).trim())
      .filter((c) => c !== "");

    const item: RawItem = {
      headline,
      canonical_url: link,
      publisher: feedTitle || "unknown",
      published_at,
      fetched_at: fetchedAt.toISOString(),
      excerpt: excerptOf(textOf(it.description), headline),
      source_ids: {},
    };
    if (guid !== "") item.source_ids.rss_guid = guid;
    if (categories.length > 0) item.categories = categories;
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Atom
// ---------------------------------------------------------------------------

function atomLink(entry: XmlNode): string {
  const links = asList(entry.link as XmlNode | XmlNode[] | undefined);
  const href = (l: XmlNode) => (typeof l["@_href"] === "string" ? (l["@_href"] as string) : "");
  const alternate =
    links.find((l) => l["@_rel"] === "alternate" || l["@_rel"] === undefined) ?? links[0];
  return alternate ? href(alternate).trim() : "";
}

function mapAtomEntries(feed: XmlNode | undefined, fetchedAt: Date): RawItem[] {
  const entries = asList(feed?.entry as XmlNode | XmlNode[] | undefined);
  const feedTitle = textOf(feed?.title);
  const out: RawItem[] = [];

  for (const e of entries) {
    const headline = decodeEntities(textOf(e.title)).trim();
    const link = atomLink(e);
    const published_at =
      toIsoTimestamp(textOf(e.published)) || toIsoTimestamp(textOf(e.updated));
    if (headline === "" || link === "" || published_at === "") continue;

    const categories = asList(e.category)
      .map((c) => decodeEntities(textOf((c as XmlNode)["@_term"]) || textOf(c)).trim())
      .filter((c) => c !== "");

    const atomId = textOf(e.id).trim();
    const item: RawItem = {
      headline,
      canonical_url: link,
      publisher: feedTitle || "unknown",
      published_at,
      fetched_at: fetchedAt.toISOString(),
      // `<content>` is a body — only used when no summary exists, and only as
      // a ≤300-char verbatim excerpt.
      excerpt: excerptOf(textOf(e.summary) || textOf(e.content), headline),
      source_ids: {},
    };
    if (atomId !== "") item.source_ids.atom_id = atomId;
    if (categories.length > 0) item.categories = categories;
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// html-index — link-only sources (e.g. reuters-tech while blocked)
// ---------------------------------------------------------------------------

/**
 * Index pages are structured for humans, not ingestion. The only honest data
 * we can lift without a DOM is embedded JSON-LD: `ItemList`/`NewsArticle`
 * nodes carrying `headline`, `url`, and `datePublished`. Anchors alone carry
 * no publish timestamp, and fabricating `published_at` breaks provenance —
 * so unstructured HTML emits nothing. A blocked page (Reuters's 401
 * DataDome wall today) yields zero items and the feed degrades silently.
 */
function mapHtmlIndex(body: string, fetchedAt: Date): RawItem[] {
  const siteName =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(body)?.[1] ??
    /<title[^>]*>([^<]+)<\/title>/i.exec(body)?.[1] ??
    "unknown";

  const nodes: XmlNode[] = [];
  for (const m of body.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let doc: unknown;
    try {
      doc = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    collectArticleNodes(doc, nodes);
  }

  const out: RawItem[] = [];
  for (const n of nodes) {
    const headline = decodeEntities(
      textOf(n.headline) || textOf(n.name),
    ).trim();
    const url =
      textOf(n.url) ||
      textOf((n.mainEntityOfPage as XmlNode | undefined)?.["@id"]) ||
      textOf(n["@id"]);
    const published_at =
      toIsoTimestamp(textOf(n.datePublished)) || toIsoTimestamp(textOf(n.dateModified));
    if (headline === "" || url === "" || published_at === "") continue;

    const item: RawItem = {
      headline,
      canonical_url: url,
      publisher: decodeEntities(siteName).trim(),
      published_at,
      fetched_at: fetchedAt.toISOString(),
      excerpt: excerptOf(textOf(n.description), headline),
      source_ids: {},
    };
    out.push(item);
  }
  return out;
}

/** Walk a JSON-LD document collecting NewsArticle-ish nodes (incl. ItemList members). */
function collectArticleNodes(node: unknown, out: XmlNode[], depth = 0): void {
  if (depth > 6 || node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const v of node) collectArticleNodes(v, out, depth + 1);
    return;
  }
  const n = node as XmlNode;
  const types = asList(n["@type"]).map((t) => String(t).toLowerCase());
  if (types.some((t) => t.includes("article") || t.includes("report"))) {
    out.push(n);
    return;
  }
  for (const key of ["itemListElement", "item", "mainEntity", "@graph"]) {
    if (key in n) collectArticleNodes(n[key], out, depth + 1);
  }
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

/** Infer a publisher display name from a body when config supplies none. */
function inferPublisher(doc: Record<string, unknown> | undefined, body: string): string {
  const rss = doc?.rss as XmlNode | undefined;
  const rdf = doc?.["rdf:RDF"] as XmlNode | undefined;
  const atom = doc?.feed as XmlNode | undefined;
  const channelTitle = textOf(
    (rss?.channel as XmlNode | undefined)?.title ??
      (rdf?.channel as XmlNode | undefined)?.title ??
      atom?.title,
  );
  if (channelTitle !== "") return channelTitle;
  const og = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(body);
  if (og?.[1]) return decodeEntities(og[1]).trim();
  return "unknown";
}

/**
 * The pure payload → RawItem[] transform, shared by `map` (harness path) and
 * `fetch` (live path). Sniffs the body: XML → RSS/Atom, HTML → JSON-LD.
 */
function mapNewsroomPayload(payload: unknown, fetchedAt: Date): RawItem[] {
  if (typeof payload !== "string" || payload.trim() === "") return [];
  const doc = looksLikeHtml(payload) ? undefined : tryParseXml(payload);
  const rss = doc?.rss as XmlNode | undefined;
  const rdf = doc?.["rdf:RDF"] as XmlNode | undefined;
  const atom = doc?.feed as XmlNode | undefined;

  if (rss?.channel !== undefined || rdf?.channel !== undefined) {
    return mapRssItems((rss?.channel ?? rdf?.channel) as XmlNode, fetchedAt);
  }
  if (atom?.entry !== undefined) {
    return mapAtomEntries(atom, fetchedAt);
  }
  if (looksLikeHtml(payload)) {
    return mapHtmlIndex(payload, fetchedAt);
  }
  return [];
}

export function createNewsroomAdapter(opts: NewsroomAdapterOptions): SourceAdapter {
  const feeds = opts.feeds;

  return {
    id: NEWSROOM_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      const from = window.from.getTime();
      const to = window.to.getTime();
      const items: RawItem[] = [];

      // Sequential: one request per feed per run — the configured ≤1 req/s
      // courtesy limit is met structurally, no sleeps needed.
      for (const feed of feeds) {
        try {
          const res = await fetcher(feed.endpoint, {
            headers: { "user-agent": userAgent, accept: ACCEPT_HEADER },
          });
          if (!res.ok) continue; // blocked/retired feed → degrade, never throw
          const body = await res.text();
          const doc = looksLikeHtml(body) ? undefined : tryParseXml(body);
          const publisher = feed.publisher ?? inferPublisher(doc, body);
          for (const item of mapNewsroomPayload(body, now())) {
            if (publisher !== "unknown") item.publisher = publisher;
            item.source_ids.newsroom_feed = feed.id;
            const t = Date.parse(item.published_at);
            if (t >= from && t <= to) items.push(item);
          }
        } catch {
          continue; // network/parse failure degrades this feed only
        }
      }
      return items;
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const { fetch: fetcher, now, userAgent } = adapterContext(ctx);
      if (feeds.length === 0) {
        return { ok: false, detail: "no newsroom feeds configured", checked_at: now().toISOString() };
      }
      const failures: string[] = [];
      for (const feed of feeds) {
        try {
          const res = await fetcher(feed.endpoint, {
            headers: { "user-agent": userAgent, accept: ACCEPT_HEADER },
          });
          if (!res.ok) failures.push(`${feed.id}: HTTP ${res.status}`);
        } catch (err) {
          failures.push(`${feed.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      const okCount = feeds.length - failures.length;
      return {
        ok: failures.length === 0,
        detail:
          failures.length === 0
            ? `${okCount}/${feeds.length} feeds reachable`
            : `${okCount}/${feeds.length} feeds reachable — ${failures.join("; ")}`,
        checked_at: now().toISOString(),
      };
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      return mapNewsroomPayload(payload, fetchedAt);
    },
  };
}

/**
 * Build this adapter's feed list from `config/sources.yaml` entries — every
 * enabled `newsroom-rss` entry becomes one feed, taking its curated display
 * name from `meta.publisher`. Adding a newsroom is then data, not code.
 */
export function newsroomFeedsFromSources(entries: SourceEntry[]): NewsroomFeed[] {
  return entries
    .filter((e) => e.adapter === NEWSROOM_ADAPTER_ID && e.enabled)
    .map((e) => ({
      id: e.id,
      endpoint: e.endpoint,
      kind: e.kind,
      ...(typeof e.meta?.publisher === "string" ? { publisher: e.meta.publisher } : {}),
    }));
}
