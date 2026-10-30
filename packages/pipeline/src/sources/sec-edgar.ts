/**
 * A4 — SEC EDGAR adapter (PLAN.md §5.1): Form D / S-1 / 8-K for the
 * Funding + Deals pages.
 *
 * Two EDGAR endpoints back `adapter: sec-edgar` entries in
 * `config/sources.yaml`:
 *
 *  - `sec-edgar-fts` (kind `json-api`): the full-text-search JSON API at
 *    `efts.sec.gov/LATEST/search-index`. `fetch` queries AI-relevance
 *    terms (`aiTerms`, OR'd quoted phrases) restricted to `forms` and the
 *    window's `startdt`/`enddt`, then paginates `hits.hits[]`. Each hit is
 *    one FILE inside a filing — `map` dedupes by accession (`adsh`) so one
 *    RawItem per filing.
 *  - `sec-edgar-current-feed` (kind `atom`): the `browse-edgar`
 *    getcurrent Atom feed. No server-side query — `fetch` applies the
 *    form, window, `items8k`, and `aiTerms` (filer-name/summary match)
 *    filters client-side.
 *
 * Canonical URL is the filing index page, derived from accession + CIK:
 *   https://www.sec.gov/Archives/edgar/data/<cik>/<adsh-nodashes>/<adsh>-index.htm
 *
 * Fair-access rules (documented in sources.yaml): ≤10 req/s and a DECLARED
 * UA in EDGAR's `Company Name contact@email` format. The generic project
 * UA and GitHub noreply identities are refused (HTTP 403, verified
 * 2026-10), so this adapter always sends `EDGAR_USER_AGENT` — product name
 * + the operator contact — rather than `ctx.userAgent` (adapter.ts's
 * carve-out for sources that mandate a different UA format). `contact` is
 * configurable for when a project mailbox exists.
 *
 * Store rule: accession number, CIK, form, and item numbers go in
 * `source_ids`; the excerpt is the filing's own index/summary metadata,
 * ≤300 chars — never filing bodies (P5 does amount extraction).
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
  UA_PRODUCT,
} from "../adapter.js";

export const SEC_EDGAR_ADAPTER_ID = "sec-edgar";
export const EDGAR_PUBLISHER = "SEC EDGAR";

/**
 * The contact identity EDGAR's declared-UA rule wants (`Name email`).
 * `devin@devin.ai` is the operator's public contact — no project mailbox
 * exists yet; override via `SecEdgarAdapterOptions.contact`.
 */
export const EDGAR_CONTACT = "devin@devin.ai";

/**
 * EDGAR-format UA: `weekly-ai-edition/<ver> <contact>`. Same identity as
 * `userAgent()` — product name + version + project contact — in the
 * `Company Name AdminContact@email` shape efts/www.sec.gov require.
 */
export function edgarUserAgent(version: string, contact: string = EDGAR_CONTACT): string {
  return `${UA_PRODUCT}/${version} ${contact}`;
}

export const EDGAR_USER_AGENT = edgarUserAgent("0");

/**
 * AI-relevance terms OR'd into the FTS `q` and matched against filer
 * names on the feed. The C3 taxonomy supersedes this list when it lands;
 * until then the same list is duplicated in `meta.ai_terms` of both
 * sec-edgar sources.yaml entries (the key A2 shares — hn-algolia).
 */
export const DEFAULT_EDGAR_AI_TERMS = [
  "artificial intelligence",
  "machine learning",
  "large language model",
  "generative ai",
  "foundation model",
  "ai",
];

export const DEFAULT_EDGAR_FORMS = ["D", "S-1", "8-K"];

const FTS_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 5;

export interface SecEdgarAdapterOptions {
  /** Endpoint URL from `config/sources.yaml` (FTS API or browse-edgar Atom). */
  endpoint: string;
  /** `json-api` (FTS) or `atom` (current-filings feed); inferred from the endpoint when omitted. */
  kind?: "json-api" | "atom";
  /** Form types to keep (default D, S-1, 8-K). `/A` amendments count as their base form. */
  forms?: string[];
  /**
   * AI-relevance terms (default `DEFAULT_EDGAR_AI_TERMS`). FTS: OR'd into
   * `q` server-side. Atom feed: filer-title/summary word match.
   */
  aiTerms?: string[];
  /**
   * 8-K item numbers marking a filing deal-relevant (Deals row cites Item
   * 1.01/2.01). An 8-K reporting none of them is dropped. Empty = keep all.
   */
  items8k?: string[];
  /** Declared contact identity for the EDGAR UA. Default `EDGAR_CONTACT`. */
  contact?: string;
  /** FTS pagination cap (pages of 100). Default 5 — well under the ≤10 req/s rule. */
  maxPages?: number;
}

// ---------------------------------------------------------------------------
// EDGAR payload shapes (typed to what we use — the APIs return more)
// ---------------------------------------------------------------------------

interface EdgarFtsSource {
  adsh?: string;
  ciks?: string[];
  display_names?: string[];
  form?: string;
  file_date?: string;
  file_description?: string | null;
  file_type?: string;
  items?: string[];
}

interface EdgarFtsHit {
  _id?: string;
  _source?: EdgarFtsSource;
}

interface EdgarFtsPayload {
  hits?: {
    hits?: EdgarFtsHit[];
    total?: number | { value?: number };
  };
}

/** Elements with attributes parse as `{ "#text": "..." }`, not bare strings. */
type AtomText = string | { "#text"?: string };

interface EdgarAtomEntry {
  title?: AtomText;
  link?: { "@_href"?: string } | Array<{ "@_href"?: string }>;
  summary?: AtomText;
  updated?: AtomText;
  category?: { "@_term"?: string } | Array<{ "@_term"?: string }>;
  id?: AtomText;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** `0001062993-26-005447` + `0001498148` → the filing's index page. */
export function edgarIndexUrl(cik: string, accession: string): string {
  const cikNum = String(Number.parseInt(cik, 10));
  const adshDir = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${adshDir}/${accession}-index.htm`;
}

/** "X/A" amendments collapse to the base form ("D/A" → "D"). */
function baseForm(form: string): string {
  return form.replace(/\/A$/i, "");
}

function cleanDisplayName(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/\s*\(CIK\s*\d+\)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: AtomText | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : (v["#text"] ?? "");
}

/** Whole-word (case-insensitive) match of any term against text. */
function matchesAnyTerm(terms: string[], text: string): boolean {
  return terms.some((t) => {
    const needle = t.trim();
    if (needle === "") return false;
    const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return re.test(text);
  });
}

/** Strip the decoded inner-HTML of an Atom `<summary>` to plain text. */
function stripMarkup(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Item numbers cited in an Atom summary's `Item X:` lines ("3C", "1.01"). */
function summaryItems(summaryText: string): string[] {
  const out: string[] = [];
  for (const m of summaryText.matchAll(/Item\s+([0-9A-Za-z.]+)\s*:/g)) {
    if (m[1] !== undefined) out.push(m[1]);
  }
  return out;
}

function isoOrNull(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// ---------------------------------------------------------------------------
// the adapter
// ---------------------------------------------------------------------------

export function createSecEdgarAdapter(opts: SecEdgarAdapterOptions): SourceAdapter {
  const kind =
    opts.kind ??
    (/efts\.sec\.gov|search-index/i.test(opts.endpoint)
      ? "json-api"
      : /browse-edgar|output=atom/i.test(opts.endpoint)
        ? "atom"
        : "json-api");
  const forms = opts.forms ?? DEFAULT_EDGAR_FORMS;
  const aiTerms = opts.aiTerms ?? DEFAULT_EDGAR_AI_TERMS;
  const items8k = opts.items8k ?? [];
  const userAgent = edgarUserAgent("0", opts.contact ?? EDGAR_CONTACT);
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
  });

  // -- FTS hit -> RawItem ----------------------------------------------------

  function mapFtsHit(hit: EdgarFtsHit, fetchedAt: Date): RawItem | null {
    const src = hit._source;
    const adsh = src?.adsh;
    const cik = src?.ciks?.[0];
    if (!adsh || !cik) return null;
    const published_at = isoOrNull(src?.file_date);
    if (!published_at) return null;

    const form = src?.form ?? "";
    const name = cleanDisplayName(src?.display_names?.[0]);
    const items = src?.items ?? [];
    const excerptParts = [
      src?.file_description ?? `FORM ${form}`,
      items.length > 0 ? `items ${items.join(", ")}` : null,
      `filed by ${name || `CIK ${cik}`}`,
    ].filter((p): p is string => p !== null);

    return {
      headline: `${form} — ${name || adsh}`,
      canonical_url: edgarIndexUrl(cik, adsh),
      publisher: EDGAR_PUBLISHER,
      published_at,
      fetched_at: fetchedAt.toISOString(),
      excerpt: toExcerpt(excerptParts.join("; ")),
      source_ids: {
        edgar_accession: adsh,
        edgar_cik: cik,
        edgar_form: form,
        ...(items.length > 0 ? { edgar_items: items.join(",") } : {}),
      },
    };
  }

  // -- Atom entry -> RawItem -------------------------------------------------

  function mapAtomEntry(entry: EdgarAtomEntry, fetchedAt: Date): RawItem | null {
    const rawTitle = textOf(entry.title);
    const link = asArray(entry.link)[0]?.["@_href"];
    const form = asArray(entry.category)[0]?.["@_term"] ?? rawTitle.split(" ")[0] ?? "";
    const published_at = isoOrNull(textOf(entry.updated));
    if (!link || !published_at) return null;

    const accession =
      /accession-number=([^\s<]+)/.exec(textOf(entry.id))?.[1] ??
      /(\d{10}-\d{2}-\d{6})/.exec(link)?.[1] ??
      /AccNo:<\/b>\s*([^\s<]+)/.exec(textOf(entry.summary))?.[1];
    const cik =
      /\((\d{6,})\)/.exec(rawTitle)?.[1] ??
      /\/data\/(\d+)\//.exec(link)?.[1];
    if (!accession || !cik) return null;

    const summaryText = stripMarkup(textOf(entry.summary));
    const items = summaryItems(summaryText);
    const headline = `${form} — ${cleanDisplayName(
      rawTitle
        .replace(/\s*\(\d{6,}\)\s*\((Filer|Issuer|Owner)\)\s*$/i, "")
        .replace(/^[A-Za-z0-9/]+\s*-\s*/i, ""),
    )}`;

    return {
      headline,
      canonical_url: link,
      publisher: EDGAR_PUBLISHER,
      published_at,
      fetched_at: fetchedAt.toISOString(),
      excerpt: toExcerpt(summaryText || `${form} filing by CIK ${cik}`),
      source_ids: {
        edgar_accession: accession,
        edgar_cik: cik,
        edgar_form: form,
        ...(items.length > 0 ? { edgar_items: items.join(",") } : {}),
      },
    };
  }

  // -- shared post-map filters (fetch path) -----------------------------------

  function keepItem(item: RawItem, window: FetchWindow): boolean {
    const t = Date.parse(item.published_at);
    if (t < window.from.getTime() || t > window.to.getTime()) return false;
    const form = baseForm(item.source_ids.edgar_form ?? "");
    if (!forms.includes(form)) return false;
    if (form === "8-K" && items8k.length > 0) {
      const reported = (item.source_ids.edgar_items ?? "").split(",");
      if (!items8k.some((i) => reported.includes(i))) return false;
    }
    // aiTerms filter: FTS already applied it server-side over full text —
    // re-checking our metadata fields would drop true full-text matches.
    if (kind === "atom" && aiTerms.length > 0) {
      return matchesAnyTerm(aiTerms, `${item.headline} ${item.excerpt}`);
    }
    return true;
  }

  function dedupeByAccession(items: RawItem[]): RawItem[] {
    const seen = new Set<string>();
    return items.filter((i) => {
      const key = i.source_ids.edgar_accession ?? "";
      if (key === "" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function ftsUrl(window: FetchWindow, from: number): string {
    const u = new URL(opts.endpoint);
    const q = aiTerms
      .map((t) => `"${t.replace(/"/g, "")}"`)
      .join(" OR ");
    if (q !== "") u.searchParams.set("q", q);
    if (forms.length > 0) u.searchParams.set("forms", forms.join(","));
    u.searchParams.set("dateRange", "custom");
    u.searchParams.set("startdt", window.from.toISOString().slice(0, 10));
    u.searchParams.set("enddt", window.to.toISOString().slice(0, 10));
    u.searchParams.set("from", String(from));
    u.searchParams.set("size", String(FTS_PAGE_SIZE));
    return u.toString();
  }

  function ftsTotal(payload: EdgarFtsPayload): number {
    const total = payload.hits?.total;
    if (typeof total === "number") return total;
    return total?.value ?? 0;
  }

  const adapter: SourceAdapter = {
    id: SEC_EDGAR_ADAPTER_ID,

    async fetch(window: FetchWindow, ctx?: Partial<AdapterContext>): Promise<RawItem[]> {
      const { fetch: fetcher, now } = adapterContext(ctx);
      const headers = { "user-agent": userAgent };

      if (kind === "atom") {
        try {
          const res = await fetcher(opts.endpoint, { headers });
          if (!res.ok) return [];
          return dedupeByAccession(adapter.map(await res.text(), now())).filter((i) =>
            keepItem(i, window),
          );
        } catch {
          return []; // one source's failure degrades its page, never the run
        }
      }

      // json-api — paginate efts until the page is short or maxPages hit
      const out: RawItem[] = [];
      for (let page = 0; page < maxPages; page++) {
        try {
          const res = await fetcher(ftsUrl(window, page * FTS_PAGE_SIZE), { headers });
          if (!res.ok) break;
          const body = (await res.json()) as EdgarFtsPayload;
          const batch = adapter.map(body, now());
          out.push(...batch);
          const pageHits = body.hits?.hits?.length ?? 0;
          if (pageHits < FTS_PAGE_SIZE || (page + 1) * FTS_PAGE_SIZE >= ftsTotal(body)) break;
        } catch {
          break; // keep pages already collected
        }
      }
      return dedupeByAccession(out).filter((i) => keepItem(i, window));
    },

    async health(ctx?: Partial<AdapterContext>): Promise<AdapterHealth> {
      const { fetch: fetcher, now } = adapterContext(ctx);
      try {
        const url =
          kind === "atom"
            ? opts.endpoint
            : (() => {
                const u = new URL(opts.endpoint);
                u.searchParams.set("q", '"health"');
                u.searchParams.set("from", "0");
                u.searchParams.set("size", "1");
                return u.toString();
              })();
        const res = await fetcher(url, { headers: { "user-agent": userAgent } });
        return {
          ok: res.ok,
          detail: `${opts.endpoint} → HTTP ${res.status}`,
          checked_at: now().toISOString(),
        };
      } catch (err) {
        return { ok: false, detail: String(err), checked_at: now().toISOString() };
      }
    },

    map(payload: unknown, fetchedAt: Date = new Date()): RawItem[] {
      // String payload = Atom XML; object payload = FTS JSON.
      if (typeof payload === "string") {
        const doc = xmlParser.parse(payload) as { feed?: { entry?: EdgarAtomEntry | EdgarAtomEntry[] } };
        return dedupeByAccession(
          asArray(doc.feed?.entry)
            .map((e) => mapAtomEntry(e, fetchedAt))
            .filter((i): i is RawItem => i !== null),
        );
      }
      const hits = (payload as EdgarFtsPayload).hits?.hits ?? [];
      return dedupeByAccession(
        hits.map((h) => mapFtsHit(h, fetchedAt)).filter((i): i is RawItem => i !== null),
      );
    },
  };

  return adapter;
}
