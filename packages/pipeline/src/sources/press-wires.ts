/**
 * A5 — `press-wire-rss`: press-release wires + funding news feeds (PLAN §5.1).
 *
 * Feeds Funding and Deals. The §5.1 set: PR Newswire, Business Wire,
 * GlobeNewswire (firehose wires — keep only AI + funding/M&A releases);
 * TechCrunch funding, Axios Pro Rata, Crunchbase *News* (topic feeds — the
 * AI filter keeps them on-brief); FT/Guardian/NYT (secondary corroboration).
 *
 * Design:
 *  - ONE ADAPTER INSTANCE PER FEED. The ingest layer (P3) builds instances
 *    from `config/sources.yaml` entries whose `adapter:` is `press-wire-rss`
 *    via `pressWireAdapterFromEntry`; each instance owns one endpoint, its
 *    publisher name, and its own filter — so a dead feed degrades only
 *    itself.
 *  - FILTERS LIVE IN CONFIG, NOT CODE. `meta.filter_groups` is a map of
 *    group name → terms (e.g. `{ai: [...], funding_ma: [...]}`); an item
 *    survives iff EVERY group has ≥1 word-boundary, case-insensitive match
 *    over headline + summary ("artificial intelligence" AND "funding"). A
 *    feed with no `filter_groups` is kept whole (topic feeds like Guardian
 *    AI are pre-filtered by the publisher). This is a recall filter —
 *    `classify` (P4) decides page/`unsorted` downstream.
 *  - `mode: link` entries store headline+link only: the excerpt repeats the
 *    headline rather than the publisher summary (ToS-doubtful feeds).
 *  - No bodies, ever: `content:encoded` is ignored; excerpts come from
 *    `description`/`summary`, stripped to plain text, capped at 300 chars.
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

export const PRESS_WIRE_ADAPTER_ID = "press-wire-rss";

// ---------------------------------------------------------------------------
// Feed options + config wiring
// ---------------------------------------------------------------------------

export interface PressWireOptions {
  /** sources.yaml entry id, e.g. "pr-newswire" — provenance on source_ids. */
  id: string;
  /** Publisher display name stamped on RawItem.publisher. */
  publisher: string;
  /** Feed URL this instance GETs. */
  endpoint: string;
  /**
   * AND-of-ORs keyword filter: an item survives iff every group has ≥1
   * word-boundary, case-insensitive match over the item's headline +
   * summary. Undefined/empty = unfiltered. Sourced from `meta.filter_groups`
   * in config/sources.yaml — never a code default.
   */
  filterGroups?: Record<string, readonly string[]>;
  /** mode: link — store headline+link only (excerpt repeats the headline). */
  linkOnly?: boolean;
}

/**
 * Build an adapter instance from a `config/sources.yaml` entry — the
 * config-driven wiring P3 calls per `adapter: press-wire-rss` entry.
 * Returns `null` for entries that are disabled or belong to another adapter.
 *
 * `meta.publisher` supplies the display name; `meta.filter_groups` the terms.
 */
export function pressWireAdapterFromEntry(entry: SourceEntry): SourceAdapter | null {
  if (entry.adapter !== PRESS_WIRE_ADAPTER_ID || !entry.enabled) return null;
  const meta = entry.meta ?? {};
  const publisher = typeof meta.publisher === "string" ? meta.publisher : null;
  if (publisher === null) {
    throw new Error(`sources.yaml entry ${entry.id}: meta.publisher missing`);
  }
  const rawGroups = meta.filter_groups;
  const filterGroups: Record<string, readonly string[]> = {};
  if (typeof rawGroups === "object" && rawGroups !== null && !Array.isArray(rawGroups)) {
    for (const [group, terms] of Object.entries(rawGroups)) {
      if (Array.isArray(terms) && terms.every((t) => typeof t === "string")) {
        filterGroups[group] = terms;
      }
    }
  }
  return createPressWireAdapter({
    id: entry.id,
    publisher,
    endpoint: entry.endpoint,
    filterGroups,
    linkOnly: entry.mode === "link",
  });
}

// ---------------------------------------------------------------------------
// Keyword filter — word-boundary, case-insensitive, AND across groups
// ---------------------------------------------------------------------------

/** Compile one term list into a word-boundary, case-insensitive matcher. */
function compileTermMatcher(terms: readonly string[]): (text: string) => boolean {
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(?:${escaped.join("|")})\\b`, "i");
  return (text) => re.test(text);
}

/** AND-of-ORs: every group must hit somewhere in `text`. */
function compileGroupFilter(
  groups: Record<string, readonly string[]>,
): (text: string) => boolean {
  const matchers = Object.values(groups)
    .filter((terms) => terms.length > 0)
    .map(compileTermMatcher);
  if (matchers.length === 0) return () => true;
  return (text) => matchers.every((m) => m(text));
}

// ---------------------------------------------------------------------------
// Publisher HTML → plain text (tags stripped, entities decoded)
// ---------------------------------------------------------------------------

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#x27": "'",
  "#x2019": "\u2019",
  "#x201c": "\u201c",
  "#x201d": "\u201d",
  "#39": "'",
  nbsp: " ",
};

/** Decode HTML entities (named + numeric), then strip tags → plain text. */
export function htmlToPlainText(raw: string): string {
  const decoded = raw.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (m, e: string) => HTML_ENTITIES[e.toLowerCase()] ?? m,
  );
  return decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// RSS 2.0 / Atom parsing (fast-xml-parser; no network in map)
// ---------------------------------------------------------------------------

interface WireRecord {
  headline: string;
  link: string;
  published: string;
  summary: string;
  guid: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // dc:creator → creator, content:encoded → encoded
  parseTagValue: false, // keep everything as raw strings
  trimValues: true,
});

/** One node that may be an object, an array (repeated tag), or absent. */
function asList(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    return node.filter((n): n is Record<string, unknown> => typeof n === "object" && n !== null);
  }
  if (typeof node === "object" && node !== null) return [node as Record<string, unknown>];
  return [];
}

/** Text content of a tag that may be a string or `{#text, @_…}` object. */
function tagText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && node !== null) {
    const text = (node as Record<string, unknown>)["#text"];
    if (typeof text === "string") return text;
    if (typeof text === "number") return String(text);
  }
  return "";
}

/**
 * The item URL. `removeNSPrefix` folds `<atom:link rel="standout" href=…/>`
 * (NYT items carry one) into the `link` field alongside the RSS `<link>`,
 * making it a list — keep the first text node (the permalink); an atom
 * relation object has `@_href`, not `#text`, so it is skipped.
 */
function linkUrl(node: unknown): string {
  if (Array.isArray(node)) {
    for (const n of node) {
      const t = tagText(n);
      if (t !== "") return t;
    }
    return "";
  }
  return tagText(node);
}

/** RSS 2.0 `<item>` → WireRecord. Returns null when unparseable. */
function rssItemToRecord(item: Record<string, unknown>): WireRecord | null {
  const headline = tagText(item.title);
  const link = linkUrl(item.link);
  const guid = tagText(item.guid) || link;
  const published = tagText(item.pubDate) || tagText(item.date);
  const summary = tagText(item.description);
  if (headline === "" || link === "") return null;
  return { headline, link, guid, published, summary };
}

/** Atom `<entry>` → WireRecord. Returns null when unparseable. */
function atomEntryToRecord(entry: Record<string, unknown>): WireRecord | null {
  const headline = tagText(entry.title);
  // <link href="…"/> or <link rel="alternate" href="…"/>; may repeat
  let link = "";
  for (const l of asList(entry.link)) {
    const rel = tagText(l["@_rel"]) || "alternate";
    if (rel === "alternate" && link === "") link = tagText(l["@_href"]);
  }
  const guid = tagText(entry.id) || link;
  const published = tagText(entry.published) || tagText(entry.updated);
  const summary = tagText(entry.summary) || tagText(entry.content);
  if (headline === "" || link === "") return null;
  return { headline, link, guid, published, summary };
}

/** Parse one RSS 2.0 or Atom document into normalized records. */
export function parseWireFeed(xml: string): WireRecord[] {
  let doc: unknown;
  try {
    doc = xmlParser.parse(xml);
  } catch {
    return [];
  }
  if (typeof doc !== "object" || doc === null) return [];
  const d = doc as Record<string, unknown>;

  // RSS 2.0: <rss><channel><item>…
  const rss = d.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel !== undefined) {
    return asList(channel.item)
      .map(rssItemToRecord)
      .filter((r): r is WireRecord => r !== null);
  }

  // Atom: <feed><entry>…
  const feed = d.feed as Record<string, unknown> | undefined;
  if (feed !== undefined) {
    return asList(feed.entry)
      .map(atomEntryToRecord)
      .filter((r): r is WireRecord => r !== null);
  }

  return [];
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export function createPressWireAdapter(opts: PressWireOptions): SourceAdapter {
  const keep = compileGroupFilter(opts.filterGroups ?? {});

  function toItem(r: WireRecord, fetchedAt: Date): RawItem | null {
    const published = Date.parse(r.published);
    if (Number.isNaN(published)) return null;
    const summaryText = htmlToPlainText(r.summary);
    const item: RawItem = {
      headline: htmlToPlainText(r.headline),
      canonical_url: r.link,
      publisher: opts.publisher,
      published_at: new Date(published).toISOString(),
      fetched_at: fetchedAt.toISOString(),
      // link-mode stores headline+link only; otherwise the publisher's own
      // summary, stripped and capped — never content:encoded (the body).
      excerpt: opts.linkOnly ? htmlToPlainText(r.headline) : toExcerpt(summaryText || r.headline),
      source_ids: { feed: opts.id, guid: r.guid },
    };
    return item.excerpt === "" ? null : item;
  }

  return {
    id: PRESS_WIRE_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const c = adapterContext(ctx);
      const fetchedAt = c.now();
      let body: string;
      try {
        const res = await c.fetch(opts.endpoint, {
          headers: { "user-agent": c.userAgent },
        });
        if (!res.ok) return []; // feed failure degrades, never throws
        body = await res.text();
      } catch {
        return [];
      }
      const byGuid = new Map<string, RawItem>();
      for (const item of this.map(body, fetchedAt)) {
        const t = Date.parse(item.published_at);
        if (t >= window.from.getTime() && t <= window.to.getTime()) {
          byGuid.set(item.source_ids.guid!, item);
        }
      }
      return [...byGuid.values()];
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const c = adapterContext(ctx);
      const checked_at = c.now().toISOString();
      try {
        const res = await c.fetch(opts.endpoint, {
          headers: { "user-agent": c.userAgent },
        });
        return { ok: res.ok, detail: `${opts.id} → HTTP ${res.status}`, checked_at };
      } catch (err) {
        return { ok: false, detail: `${opts.id} → ${String(err)}`, checked_at };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      if (typeof payload !== "string") return [];
      const items: RawItem[] = [];
      for (const record of parseWireFeed(payload)) {
        const item = toItem(record, fetchedAt);
        if (item === null) continue;
        // the config filter: every group hits headline + summary
        if (!keep(`${item.headline} ${htmlToPlainText(record.summary)}`)) continue;
        items.push(item);
      }
      return items;
    },
  };
}
