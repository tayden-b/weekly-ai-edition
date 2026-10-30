/**
 * P5 — `extract` stage (PLAN.md §5.2): `ClassifiedCluster[]` →
 * `ExtractedCluster[]`.
 *
 * Sixth stage in `PIPELINE_STAGES` (after rank). For every cluster whose
 * classification is a numeric-claim page — `funding`, `deals`, `performance`,
 * `markets` — the stage produces the structured fields the edition schema
 * needs (`amount`/`amount_usd`, `stage`, `lead_investor`, `acquirer`,
 * `target`, `metric_name`/`metric_value`, `ticker`, `close`, `change_pct`).
 * Deterministic regexes run first; the `llm()` seam (the session, or a
 * recorded replay — see `../llm.ts`) fills what the regexes could not get,
 * via `prompts/extract.prompt.md`.
 *
 * ## The load-bearing rule (§5.3)
 *
 * Every extracted field carries `evidence {source_index, quote}` where
 * `source_index` indexes the cluster's `items` (the same order
 * `clusterSources()` maps onto `EditionItem.sources[]`) and `quote` is a
 * **verbatim substring of that member's stored `excerpt`**. Containment is
 * enforced in code on every candidate — regex or LLM: a field whose quote is
 * not contained is dropped and the drop is recorded in
 * `ItemExtraction.drops`. Nothing ships silently.
 *
 * Regex quotes are sliced straight from the excerpt, so they can only fail
 * containment through a bug; LLM quotes are model output and fail regularly —
 * the gate treats both identically.
 *
 * ## Merge order
 *
 * For each page-allowed field the first regex candidate wins (member order,
 * then earliest match position in the excerpt). A cluster with unfilled
 * LLM-eligible fields goes into `extraction.request.json` with
 * `missing_fields` naming exactly the gaps; the session answers with
 * `extraction.response.json`. Response fields only fill still-empty slots —
 * deterministic extraction always beats judgement.
 *
 * `amount_usd` is never emitted by regex or the model: it is derived from the
 * admitted `amount` and inherits that field's evidence.
 *
 * A missing field is not a failure — `flags` records `missing:<field>` for
 * every field the page asked for that stays empty, and `missing-required:<f>`
 * when a schema-required field stays empty (emit decides "undisclosed" or
 * drops the item). The batch contract (`assertExtractionResponse`) is
 * strict: a malformed response file throws `ExtractionContractError`; a
 * semantically bad field just drops.
 */

import type { ClassifiedCluster, ClassifyPage } from "./classify.js";
import type { ItemCluster } from "./dedupe.js";

// ---------------------------------------------------------------------------
// Pages + fields
// ---------------------------------------------------------------------------

/** The classified pages that carry numeric claims (PLAN §5.3). */
export const EXTRACT_PAGES = ["funding", "deals", "performance", "markets", "models"] as const;
export type ExtractPage = (typeof EXTRACT_PAGES)[number];

const EXTRACT_PAGE_SET = new Set<string>(EXTRACT_PAGES);

export function isExtractPage(page: string): page is ExtractPage {
  return EXTRACT_PAGE_SET.has(page);
}

/** Every field the stage can emit (the brief's `amount_usd, stage, …`). */
export const EXTRACT_FIELD_NAMES = [
  /** Display amount, e.g. "$15B" — funding rounds and deal prices. */
  "amount",
  /** `amount` parsed to a USD number — derived, never emitted directly. */
  "amount_usd",
  /** Round stage, e.g. "Series A", "Seed", "IPO" — funding. */
  "stage",
  /** Lead investor display name — funding. */
  "lead_investor",
  /** Buyer display name — deals. */
  "acquirer",
  /** Acquired company display name — deals. */
  "target",
  /** What the number measures, e.g. "SWE-bench Verified" — performance/markets. */
  "metric_name",
  /** The number as written, e.g. "92.4%", "1516.2" — performance/markets. */
  "metric_value",
  /** Exchange symbol, e.g. "NVDA" — markets. */
  "ticker",
  /** Week close — markets. */
  "close",
  /** Week-over-week % change — markets. */
  "change_pct",
  /** Model version identifier as written, e.g. "5.1", "4 Carbon" — models. */
  "version",
] as const;

export type ExtractFieldName = (typeof EXTRACT_FIELD_NAMES)[number];

const EXTRACT_FIELD_SET = new Set<string>(EXTRACT_FIELD_NAMES);

/** Per-page field rules: what the page may carry, what it must carry, what
 *  the LLM may fill (`amount_usd` is derived, so never an LLM field). */
export interface PageFieldSpec {
  readonly allowed: readonly ExtractFieldName[];
  readonly required: readonly ExtractFieldName[];
  readonly llm: readonly ExtractFieldName[];
}

export const PAGE_FIELD_SPECS: Record<ExtractPage, PageFieldSpec> = {
  funding: {
    allowed: ["amount", "amount_usd", "stage", "lead_investor"],
    // Schema `EditionItemFunding.amount` is required; missing → emit renders
    // "undisclosed", so the flag is informative, not fatal.
    required: ["amount"],
    llm: ["amount", "stage", "lead_investor"],
  },
  deals: {
    allowed: ["acquirer", "target", "amount", "amount_usd"],
    required: ["acquirer", "target"],
    llm: ["acquirer", "target", "amount"],
  },
  performance: {
    allowed: ["metric_name", "metric_value"],
    // Schema `EditionItemNumbered.number` is required.
    required: ["metric_value"],
    llm: ["metric_name", "metric_value"],
  },
  markets: {
    allowed: ["ticker", "close", "change_pct", "metric_name", "metric_value"],
    // Schema `EditionTicker` needs all three for a row.
    required: ["ticker", "close", "change_pct"],
    llm: ["ticker", "close", "change_pct", "metric_name", "metric_value"],
  },
  models: {
    // DESIGN §3 renders model versions in the mono `number` slot. Optional:
    // a release with no version in evidence still emits the item.
    allowed: ["version"],
    required: [],
    llm: ["version"],
  },
};

/** The value type each field stores — checked at admission. */
export const FIELD_VALUE_TYPE: Record<ExtractFieldName, "string" | "number"> = {
  amount: "string",
  amount_usd: "number",
  stage: "string",
  lead_investor: "string",
  acquirer: "string",
  target: "string",
  metric_name: "string",
  metric_value: "string",
  ticker: "string",
  close: "number",
  change_pct: "number",
  version: "string",
};

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/** C2's `EditionItem.evidence` — `source_index` keys `cluster.items`. */
export interface ExtractionEvidence {
  source_index: number;
  /** Verbatim substring of `items[source_index].excerpt`. */
  quote: string;
}

export type ExtractFieldValue = string | number;

/** One admitted field — value plus the evidence span backing it. */
export interface ExtractedField {
  value: ExtractFieldValue;
  evidence: ExtractionEvidence;
  /** Which pass produced the field — deterministic preferred. */
  method: "regex" | "llm";
}

export type ExtractionDropReason =
  /** `quote` is not a verbatim substring of the cited excerpt. */
  | "quote-not-in-excerpt"
  /** `value` is not spelled out inside its own `quote`. */
  | "value-not-in-quote"
  /** `source_index` outside `[0, items.length)`. */
  | "source-index-out-of-range"
  /** Field name not in `EXTRACT_FIELD_NAMES`. */
  | "unknown-field"
  /** Field not permitted for this page (or derived-only). */
  | "field-not-on-page"
  /** Value has the wrong type or can't be normalized. */
  | "invalid-value"
  /** Slot already filled — deterministic regex wins over the model. */
  | "already-extracted";

/** A rejected candidate — the §5.3 audit trail for what did NOT ship. */
export interface ExtractionDrop {
  /** The emitted field name (may itself be the violation). */
  field: string;
  reason: ExtractionDropReason;
  /** Which pass proposed it. */
  method: "regex" | "llm";
  value?: ExtractFieldValue;
  quote?: string;
  source_index?: number;
}

/** The extraction slot attached to every cluster the stage touches. */
export interface ItemExtraction {
  /** The cluster's classified page (mirrors `classification.page`). */
  page: ClassifyPage;
  /** Admitted fields — every one carries contained evidence. */
  fields: Partial<Record<ExtractFieldName, ExtractedField>>;
  /** Every rejected candidate, in rejection order. */
  drops: ExtractionDrop[];
  /** `missing:<field>` for each page field left unfilled, plus
   *  `missing-required:<field>` when a schema-required field stays empty. */
  flags: string[];
}

/** A classified cluster with its extraction slot — the type emit consumes. */
export type ExtractedCluster<T extends ClassifiedCluster = ClassifiedCluster> = T & {
  extraction: ItemExtraction;
};

// ---------------------------------------------------------------------------
// Request / response shapes (extraction.{request,response}.json)
// ---------------------------------------------------------------------------

/** One member excerpt projected for the model — `source_index` keys the item. */
export interface ExtractionSourceRef {
  source_index: number;
  publisher: string;
  excerpt: string;
}

/** One request item — a cluster flattened to what the model judges on. */
export interface ExtractionRequestItem {
  /** The cluster id (joins the response back — echoed verbatim). */
  id: string;
  /** The classified page — selects the field set. */
  page: ExtractPage;
  headline: string;
  publisher: string;
  /** Every member excerpt — the only text the model may quote. */
  sources: ExtractionSourceRef[];
  /** The page's LLM-eligible fields regexes already filled — context only. */
  extracted: Partial<Record<ExtractFieldName, { value: ExtractFieldValue; source_index: number }>>;
  /** The LLM-eligible fields still empty — what the model should find. */
  missing_fields: ExtractFieldName[];
}

/** `extraction.request.json` — the batch handed to the `llm()` seam. */
export interface ExtractionRequest {
  week: string;
  prompt_version: number;
  /** Git SHA of STYLE.md at request time (audit parity with classify). */
  style_rev: string;
  items: ExtractionRequestItem[];
}

/** One response field — the model's candidate for a single item. */
export interface ExtractionResponseField {
  field: string;
  value: ExtractFieldValue;
  /** Index into the item's `sources` array. */
  source_index: number;
  /** Verbatim substring of `sources[source_index].excerpt`. */
  quote: string;
}

/** One response entry — the model's judgement for one request item. */
export interface ExtractionResponseItem {
  /** Echo of the request item's `id`. */
  id: string;
  /** May be empty — a clean "nothing quotable found". */
  fields: ExtractionResponseField[];
}

/** `extraction.response.json` — the judgement the seam returns. */
export interface ExtractionResponse {
  prompt_version: number;
  items: ExtractionResponseItem[];
}

/** The prompt contract version — must equal `prompt_version` in
 *  `prompts/extract.prompt.md`'s frontmatter (a test enforces it) and the
 *  `prompt_version` on every response the seam returns. */
export const EXTRACT_PROMPT_VERSION = 1;

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

const SUFFIX_USD: Record<string, { suffix: string; mult: number }> = {
  "": { suffix: "", mult: 1 },
  k: { suffix: "K", mult: 1e3 },
  m: { suffix: "M", mult: 1e6 },
  mn: { suffix: "M", mult: 1e6 },
  million: { suffix: "M", mult: 1e6 },
  b: { suffix: "B", mult: 1e9 },
  bn: { suffix: "B", mult: 1e9 },
  billion: { suffix: "B", mult: 1e9 },
  t: { suffix: "T", mult: 1e12 },
  trillion: { suffix: "T", mult: 1e12 },
};

function trimNum(raw: string): string {
  return raw.includes(".") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw;
}

/**
 * Parse a money phrase ("$100 million", "USD 1.5B", "$5bn") into the
 * canonical display ("$100M", "$1.5B", "$5B") and the USD number.
 * Returns `undefined` when the text is not a money amount.
 */
export function parseUsdAmount(
  text: string,
): { display: string; usd: number } | undefined {
  const m = text
    .trim()
    .match(/^(?:USD|US\$|\$)?\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s?(billion|million|trillion|bn|mn|k|m|b|t)?\s?(?:USD|dollars)?$/i);
  if (!m) return undefined;
  const num = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(num)) return undefined;
  let unit = SUFFIX_USD[(m[2] ?? "").toLowerCase()];
  if (unit === undefined) return undefined;
  const usd = num * unit.mult;
  let numText = trimNum(m[1]!.replace(/,/g, ""));
  if (unit.suffix === "" && usd >= 1000) {
    // Bare large number — normalize the display suffix ("$850,000" → "$850K").
    for (const [mult, suffix] of [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]] as const) {
      if (usd >= mult) {
        unit = { suffix, mult };
        numText = trimNum(String(usd / mult));
        break;
      }
    }
  }
  return { display: `$${numText}${unit.suffix}`, usd };
}

/** Canonical stage display: "series b" → "Series B", "ipo" → "IPO". */
export function normalizeStage(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  const series = s.match(/^series\s+([a-z])\+?$/i);
  if (series) return `Series ${series[1]!.toUpperCase()}${s.endsWith("+") ? "+" : ""}`;
  const word = s.toLowerCase().replace(/[- ]/g, "");
  if (word === "seed") return "Seed";
  if (word === "preseed") return "Pre-seed";
  if (word === "ipo" || word === "fpo" || word === "spac") return s.toUpperCase();
  if (word.startsWith("growth")) return "Growth";
  if (word === "bridge" || word === "bridgeround") return "Bridge";
  if (word === "extension") return "Extension";
  return s;
}

/** Trim + collapse whitespace on an emitted name. */
function cleanName(raw: string): string {
  return raw.replace(/^[\s\-,.''""()]+|[\s\-,.''""()]+$/g, "").replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Regex candidates (deterministic first pass)
// ---------------------------------------------------------------------------

/** A regex-produced field candidate — `quote` is sliced from the excerpt. */
interface Candidate {
  field: ExtractFieldName;
  value: ExtractFieldValue;
  source_index: number;
  quote: string;
  /** Match offset in the excerpt — earliest wins per field. */
  position: number;
}

/**
 * Company-name capture charset. The first token allows `.`/`&`/apostrophes
 * inside it ("BigBear.ai", "L'Oréal"); the continuation words do NOT allow
 * `.`/`,`/`;` — sentence punctuation can never be swallowed into a name
 * ("Marlinspike Partners. Participating" stays two sentences).
 */
const NAME = String.raw`[\w.&''-]+(?:\s+[\w&'' -]{0,40}[\w.&''-]+)?`;
/**
 * Capitalized-token name — every word starts uppercase/digit. Used where the
 * sentence subject sits adjacent to the slot ("US agency approves Amazon
 * Leo's …"): a permissive NAME would swallow the whole clause.
 */
const CNAME = String.raw`(?:[A-Z0-9À-Þ][\w.&''-]*\s+){0,3}[A-Z0-9À-Þ][\w.&''-]+`;
const TAIL = String.raw`(?=\s*(?:,|\.|;|\(|\)|\s+for\b|\s+to\b|\s+in\b|\s+from\b|\s+with\b|$))`;

function* eachMatch(re: RegExp, excerpt: string): Generator<RegExpExecArray> {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(excerpt)) !== null) yield m;
}

/** "$100 million" / "$12.85M" / "USD 5bn" / "15 billion dollars". */
const MONEY_RE =
  /(\$\s?\d+(?:,\d{3})*(?:\.\d+)?\s?(?:billion|million|trillion|bn|mn|b|m|t|k)?\b|\bUSD\s?\d+(?:,\d{3})*(?:\.\d+)?\s?(?:billion|million|trillion|bn|b)\b|\b\d+(?:,\d{3})*(?:\.\d+)?\s?(?:billion|million|trillion)\s*(?:USD|U\.S\. dollars|dollars))/gi;

function moneyCandidates(excerpt: string, i: number): Candidate[] {
  const out: Candidate[] = [];
  for (const m of eachMatch(MONEY_RE, excerpt)) {
    const parsed = parseUsdAmount(m[1]!);
    if (parsed === undefined) continue;
    // "$400mn valuation" names a valuation, not a round size or deal price —
    // skip it so the item emits "undisclosed" instead of a fake amount.
    if (/^\s+valuations?\b/i.test(excerpt.slice(m.index + m[0].length))) continue;
    out.push({
      field: "amount",
      value: parsed.display,
      source_index: i,
      quote: m[1]!,
      position: m.index,
    });
  }
  return out;
}

/** "Series A", "seed", "IPO", "pre-seed", "growth round", "SPAC". */
const STAGE_RE =
  /\b(pre[-\s]?seed|series\s+[a-z]\+?|seed|growth\s+(?:round|equity|stage|capital|financing)|bridge|ipo|fpo|spac|extension)\b/gi;

function stageCandidates(excerpt: string, i: number): Candidate[] {
  const out: Candidate[] = [];
  for (const m of eachMatch(STAGE_RE, excerpt)) {
    out.push({
      field: "stage",
      value: normalizeStage(m[1]!),
      source_index: i,
      quote: m[0],
      position: m.index,
    });
  }
  return out;
}

/** "led by <Name>", "tapped <Name> to lead", "<Name> led the round". */
const LEAD_RES = [
  new RegExp(String.raw`\bled\s+by\s+(${NAME})` + TAIL, "gi"),
  new RegExp(String.raw`\btapped\s+(${NAME})\s+to\s+lead\b`, "gi"),
  new RegExp(String.raw`(${NAME})\s+led\s+the\s+(?:round|investment|funding)\b`, "gi"),
];

function leadCandidates(excerpt: string, i: number): Candidate[] {
  const out: Candidate[] = [];
  for (const re of LEAD_RES) {
    for (const m of eachMatch(re, excerpt)) {
      const name = cleanName(m[1]!);
      if (name === "" || !isProperName(name)) continue;
      out.push({
        field: "lead_investor",
        value: name,
        source_index: i,
        quote: m[1]!,
        position: m.index,
      });
    }
  }
  return out;
}

/**
 * Deal patterns — each yields {acquirerGroup, targetGroup} indices so the
 * two fields take their own verbatim spans:
 *   "X acquires Y" / "X to acquire Y" / "X buys Y"
 *   "X's $11.5B acquisition of Y"
 *   "acquisition of Y by X"
 *   "X completes/announces (the|its) acquisition of Y"
 */
const DEAL_RES: { re: RegExp; acquirer?: number; target: number }[] = [
  {
    re: new RegExp(
      // Case-sensitive on purpose: CNAME relies on real capitals to bound the
      // acquirer, so this pattern can't carry the `i` flag — the keywords get
      // explicit first-letter alternation for Title-Case excerpts instead.
      String.raw`(${CNAME})['’][sS]\s+(?:\$\S+\s+|[Uu]ndisclosed\s+)?[Aa]cquisition\s+[Oo]f\s+(${NAME})` + TAIL,
      "g",
    ),
    acquirer: 1,
    target: 2,
  },
  {
    // "announced (the|its|the completion of the) acquisition of Y" — the
    // acquirer is the reporting company outside the captured span; left to
    // the LLM pass.
    re: new RegExp(
      String.raw`\bannounced\s+(?:the\s+|its\s+)?(?:completion\s+of\s+(?:the\s+|its\s+)?)?acquisition\s+of\s+(${NAME})` + TAIL,
      "gi",
    ),
    target: 1,
  },
  {
    re: new RegExp(
      String.raw`(${NAME})\s+(?:to\s+|agreed\s+to\s+|plans?\s+to\s+)?(?:acquire[sd]?|buys?|purchases?|snaps?\s+up)\s+(${NAME})` +
        TAIL,
      "gi",
    ),
    acquirer: 1,
    target: 2,
  },
  {
    re: new RegExp(
      String.raw`\bacquisition\s+of\s+(${NAME})\s+by\s+(${NAME})` + TAIL,
      "gi",
    ),
    acquirer: 2,
    target: 1,
  },
  {
    re: new RegExp(
      String.raw`(${NAME})\s+(?:completes?|announces?|closes?)\s+(?:the\s+|its\s+)?(?:completion\s+of\s+(?:the\s+|its\s+)?)?acquisition\s+of\s+(${NAME})` +
        TAIL,
      "gi",
    ),
    acquirer: 1,
    target: 2,
  },
];

/**
 * Entity fields (`acquirer`, `target`, `lead_investor`) must look like a
 * proper name — they start uppercase or with a digit. Without this gate a
 * pattern like "X to acquire Y" happily names "into a definitive agreement"
 * the acquirer; lowercase candidates are dropped here, not shipped.
 */
function isProperName(value: string): boolean {
  return /^[A-Z0-9À-Þ]/.test(value);
}

function dealCandidates(excerpt: string, i: number): Candidate[] {
  const out: Candidate[] = [];
  for (const { re, acquirer, target } of DEAL_RES) {
    for (const m of eachMatch(re, excerpt)) {
      // A permissive NAME can swallow the connector before the verb
      // ("Amazon to buy Y" → acquirer "Amazon to") — strip it here.
      const a =
        acquirer === undefined ? "" : cleanName(m[acquirer] ?? "").replace(/\s+(?:to|of|and|the|for)$/i, "");
      const t = cleanName(m[target] ?? "");
      if (a !== "" && isProperName(a)) {
        out.push({
          field: "acquirer",
          value: a,
          source_index: i,
          quote: m[acquirer!]!,
          position: m.index,
        });
      }
      if (t !== "" && isProperName(t)) {
        out.push({
          field: "target",
          value: t,
          source_index: i,
          quote: m[target]!,
          position: m.index,
        });
      }
    }
  }
  return out;
}

const METRIC_NAME = String.raw`[A-Z][\w.+-]*(?:\s+[A-Z][\w.+-]+){0,3}`;

/**
 * Performance-metric patterns — [valueGroup, nameGroup]; a missing name group
 * yields only a `metric_value` candidate:
 *   "SWE-bench Verified: 92.4%" / "92.4% on SWE-bench Verified"
 *   "36.8 PopQA points" / "rating: 1516.16" / "rank: 2"
 *   "cut call waits by 75%" (name left to the model)
 */
const METRIC_RES: { re: RegExp; value: number; name?: number }[] = [
  {
    re: new RegExp(String.raw`(${METRIC_NAME})\s*[:=·]\s*(\d+(?:\.\d+)?)\s?%`, "g"),
    value: 2,
    name: 1,
  },
  {
    re: new RegExp(String.raw`(\d+(?:\.\d+)?)\s?%\s+(?:on|in|at)\s+(${METRIC_NAME})`, "g"),
    value: 1,
    name: 2,
  },
  {
    re: new RegExp(
      String.raw`(?:scored?|achieved?|reached?|hit)\s+(?:a\s+)?(?:new\s+)?(\d+(?:\.\d+)?)\s?%\s+(?:on|in|at)\s+(${METRIC_NAME})`,
      "gi",
    ),
    value: 1,
    name: 2,
  },
  {
    re: /(\d+(?:\.\d+)?)\s+([A-Z][\w+-]+)\s+points?\b/g,
    value: 1,
    name: 2,
  },
  {
    re: /\b(rank|rating|score|accuracy|elo)\s*[:=]\s*(\d+(?:\.\d+)?)\s?%?/gi,
    value: 2,
    name: 1,
  },
  {
    re: /\b(?:cut|reduced?|improved?|rose|grew|increased?|up|down|fell)\s+(?:by\s+)?(?:a\s+)?(\d+(?:\.\d+)?)\s?%/gi,
    value: 1,
  },
];

function metricCandidates(excerpt: string, i: number): Candidate[] {
  const out: Candidate[] = [];
  for (const { re, value, name } of METRIC_RES) {
    for (const m of eachMatch(re, excerpt)) {
      const num = m[value]!;
      const pct = m[0].includes("%");
      // The quote prefers the "%"-suffixed span when the excerpt literally
      // carries it ("92.4%"); otherwise the bare captured number is used —
      // both are verbatim substrings by construction.
      const quote = pct && excerpt.includes(`${num}%`) ? `${num}%` : num;
      out.push({
        field: "metric_value",
        value: pct ? `${num}%` : num,
        source_index: i,
        quote,
        position: m.index,
      });
      if (name !== undefined && m[name] !== undefined) {
        out.push({
          field: "metric_name",
          value: cleanName(m[name]!),
          source_index: i,
          quote: m[name]!,
          position: m.index,
        });
      }
    }
  }
  return out;
}

/** "(NVDA)" or a bare-caps token before "close/shares/stock". */
const TICKER_RES = [
  /\(([A-Z]{1,6})\)/g,
  /\b([A-Z]{1,5})\s+(?=weekly\s+close|close\b|shares\b|stock\b)/g,
];

const CLOSE_RE = /\bclose\s+(\d+(?:\.\d+)?)/gi;
const CHANGE_RES = [
  /([+-]\d+(?:\.\d+)?)\s?%/g,
  /\b(?:rose|gained|jumped|surged|climbed|up|rallied)\s+(\d+(?:\.\d+)?)\s?%/gi,
  /\b(?:fell|dropped|declined|slid|slumped|plunged|down|lost|tumbled)\s+(\d+(?:\.\d+)?)\s?%/gi,
];

function marketsCandidates(excerpt: string, i: number): Candidate[] {
  const out: Candidate[] = [];
  for (const re of TICKER_RES) {
    for (const m of eachMatch(re, excerpt)) {
      out.push({
        field: "ticker",
        value: m[1]!.toUpperCase(),
        source_index: i,
        quote: m[1]!,
        position: m.index,
      });
    }
  }
  for (const m of eachMatch(CLOSE_RE, excerpt)) {
    out.push({
      field: "close",
      value: Number(m[1]!),
      source_index: i,
      quote: m[1]!,
      position: m.index,
    });
  }
  for (const [idx, re] of CHANGE_RES.entries()) {
    for (const m of eachMatch(re, excerpt)) {
      const n = Number(m[1]!);
      if (!Number.isFinite(n)) continue;
      const sign = idx === 0 ? n : idx === 1 ? n : -n; // pattern 0 carries its own sign
      out.push({
        field: "change_pct",
        value: idx === 2 ? -Math.abs(n) : sign,
        source_index: i,
        quote: m[0],
        position: m.index,
      });
    }
  }
  return out;
}

/** All regex candidates for one cluster's page, in admission order. */
export function regexExtractCandidates(cluster: ItemCluster, page: ExtractPage): Candidate[] {
  const out: Candidate[] = [];
  cluster.items.forEach((item, i) => {
    const e = item.excerpt;
    switch (page) {
      case "funding":
        out.push(...moneyCandidates(e, i), ...stageCandidates(e, i), ...leadCandidates(e, i));
        break;
      case "deals":
        out.push(...dealCandidates(e, i), ...moneyCandidates(e, i));
        break;
      case "performance":
        out.push(...metricCandidates(e, i));
        break;
      case "markets":
        out.push(...marketsCandidates(e, i), ...metricCandidates(e, i));
        break;
      case "models":
        // No deterministic candidate: a version is only a version in the
        // context of its model's name — the model fills `version`.
        break;
    }
  });
  // Admission order: member index, then earliest match in that excerpt, then
  // field order — fully deterministic.
  const fieldOrder = new Map(EXTRACT_FIELD_NAMES.map((f, n) => [f, n]));
  out.sort(
    (a, b) =>
      a.source_index - b.source_index ||
      a.position - b.position ||
      fieldOrder.get(a.field)! - fieldOrder.get(b.field)!,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Admission — the §5.3 gate every candidate passes through
// ---------------------------------------------------------------------------

interface FieldSlot {
  fields: Partial<Record<ExtractFieldName, ExtractedField>>;
  drops: ExtractionDrop[];
}

function drop(
  slot: FieldSlot,
  method: "regex" | "llm",
  field: string,
  reason: ExtractionDropReason,
  extra?: { value?: ExtractFieldValue; quote?: string; source_index?: number },
): void {
  slot.drops.push({ field, reason, method, ...extra });
}

/**
 * Admit one candidate into `slot.fields` — the hard containment check.
 * `permitted` is the field list the method may fill (`spec.allowed` for
 * regex, `spec.llm` for the model). Returns true when the field landed.
 */
function admit(
  slot: FieldSlot,
  cluster: ItemCluster,
  spec: PageFieldSpec,
  method: "regex" | "llm",
  candidate: { field: string; value: ExtractFieldValue; source_index: number; quote: string },
): boolean {
  const { field, value, source_index, quote } = candidate;
  const permitted = method === "llm" ? spec.llm : spec.allowed;

  if (!EXTRACT_FIELD_SET.has(field)) {
    drop(slot, method, field, "unknown-field", { value, quote, source_index });
    return false;
  }
  if (!permitted.includes(field as ExtractFieldName)) {
    drop(slot, method, field, "field-not-on-page", { value, quote, source_index });
    return false;
  }
  const name = field as ExtractFieldName;
  if (slot.fields[name] !== undefined) {
    drop(slot, method, field, "already-extracted", { value, quote, source_index });
    return false;
  }
  if (!Number.isInteger(source_index) || source_index < 0 || source_index >= cluster.items.length) {
    drop(slot, method, field, "source-index-out-of-range", { value, quote, source_index });
    return false;
  }
  if (typeof quote !== "string" || quote === "" || !cluster.items[source_index]!.excerpt.includes(quote)) {
    drop(slot, method, field, "quote-not-in-excerpt", { value, quote, source_index });
    return false;
  }

  // Value↔quote coherence: the shipped value must be spelled out inside its
  // own quote (case-folded — "seed" evidences "Seed"). `amount` compares the
  // parsed USD instead, since display ("$100M") and raw ("$100 million")
  // carry the same figure spelled differently.
  if (field === "amount") {
    const pv = typeof value === "string" ? parseUsdAmount(cleanName(value)) : undefined;
    const pq = parseUsdAmount(quote);
    if (pv === undefined || pq === undefined || pv.usd !== pq.usd) {
      drop(slot, method, field, "value-not-in-quote", { value, quote, source_index });
      return false;
    }
  } else if (!quote.toLowerCase().includes(String(value).toLowerCase())) {
    drop(slot, method, field, "value-not-in-quote", { value, quote, source_index });
    return false;
  }

  // Value normalization per declared type — after containment so the quote
  // always refers to the raw source span.
  let normalized: ExtractFieldValue;
  const want = FIELD_VALUE_TYPE[name];
  if (want === "number") {
    const n = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(n)) {
      drop(slot, method, field, "invalid-value", { value, quote, source_index });
      return false;
    }
    normalized = n;
  } else {
    if (typeof value !== "string") {
      drop(slot, method, field, "invalid-value", { value, quote, source_index });
      return false;
    }
    const text = cleanName(value);
    if (text === "") {
      drop(slot, method, field, "invalid-value", { value, quote, source_index });
      return false;
    }
    normalized = text;
    if (name === "amount") {
      const parsed = parseUsdAmount(text);
      if (parsed === undefined) {
        drop(slot, method, field, "invalid-value", { value, quote, source_index });
        return false;
      }
      normalized = parsed.display;
    } else if (name === "stage") {
      normalized = normalizeStage(text);
    } else if (name === "ticker") {
      normalized = text.toUpperCase();
    }
  }

  slot.fields[name] = {
    value: normalized,
    evidence: { source_index, quote },
    method,
  };
  return true;
}

/** `amount_usd` is derived from the admitted `amount` — same evidence span. */
function deriveAmountUsd(slot: FieldSlot): void {
  const amount = slot.fields.amount;
  if (amount === undefined || slot.fields.amount_usd !== undefined) return;
  const parsed = parseUsdAmount(String(amount.value));
  if (parsed === undefined) return;
  slot.fields.amount_usd = {
    value: parsed.usd,
    evidence: amount.evidence,
    method: amount.method,
  };
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

interface RegexResult {
  fields: Partial<Record<ExtractFieldName, ExtractedField>>;
  drops: ExtractionDrop[];
}

/** The deterministic pass for one cluster — shared by request build + apply. */
export function regexExtract(cluster: ItemCluster, page: ExtractPage): RegexResult {
  const slot: RegexResult = { fields: {}, drops: [] };
  const spec = PAGE_FIELD_SPECS[page];
  for (const c of regexExtractCandidates(cluster, page)) {
    admit(slot, cluster, spec, "regex", c);
  }
  deriveAmountUsd(slot);
  return slot;
}

/**
 * Build `extraction.request.json`: one item per extract-page cluster that
 * still has LLM-eligible fields unfilled after the regex pass. Pure —
 * `week`/`styleRev`/`promptVersion` arrive via options.
 */
export function buildExtractionRequest<T extends ClassifiedCluster>(
  clusters: readonly T[],
  opts: { week?: string; styleRev?: string; promptVersion?: number } = {},
): ExtractionRequest {
  const items: ExtractionRequestItem[] = [];
  for (const cluster of clusters) {
    const page = cluster.classification.page;
    if (!isExtractPage(page)) continue;
    const spec = PAGE_FIELD_SPECS[page];
    const { fields } = regexExtract(cluster, page);
    const missing = spec.llm.filter((f) => fields[f] === undefined);
    if (missing.length === 0) continue;
    const extracted: ExtractionRequestItem["extracted"] = {};
    for (const [name, f] of Object.entries(fields)) {
      if (spec.llm.includes(name as ExtractFieldName)) {
        extracted[name as ExtractFieldName] = {
          value: f!.value,
          source_index: f!.evidence.source_index,
        };
      }
    }
    items.push({
      id: cluster.id,
      page,
      headline: cluster.item.headline,
      publisher: cluster.item.publisher,
      sources: cluster.items.map((m, i) => ({
        source_index: i,
        publisher: m.publisher,
        excerpt: m.excerpt,
      })),
      extracted,
      missing_fields: missing,
    });
  }
  return {
    week: opts.week ?? "",
    prompt_version: opts.promptVersion ?? EXTRACT_PROMPT_VERSION,
    style_rev: opts.styleRev ?? "unknown",
    items,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/**
 * Substitute the `{{…}}` placeholders in the versioned prompt template —
 * `{{ITEMS_JSON}}` becomes the pretty-printed request items. Unknown
 * placeholders are left untouched.
 */
export function renderExtractPrompt(template: string, request: ExtractionRequest): string {
  const vars: Record<string, string> = {
    WEEK_ID: request.week,
    STYLE_MD_GIT_SHA: request.style_rev,
    PROMPT_VERSION: String(request.prompt_version),
    ITEMS_JSON: JSON.stringify(request.items, null, 2),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

/**
 * A malformed `extraction.response.json` — structural violations that mean
 * the batch file is untrustworthy (wrong version, missing/extra/dupe ids,
 * malformed field entries). Per-field semantic issues never throw — they
 * degrade to recorded drops.
 */
export class ExtractionContractError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid extraction response: ${issues.join("; ")}`);
    this.name = "ExtractionContractError";
  }
}

/**
 * Enforce the response contract against the request: `prompt_version`
 * matches, every requested `id` appears exactly once, and every field entry
 * is JSON-shaped (`field`/`quote` strings, integer `source_index`,
 * string|finite-number `value`). Throws `ExtractionContractError`.
 */
export function assertExtractionResponse(
  request: ExtractionRequest,
  response: unknown,
): asserts response is ExtractionResponse {
  const issues: string[] = [];
  const r = response as Record<string, unknown> | null;
  if (typeof r !== "object" || r === null) {
    throw new ExtractionContractError(["response must be an object"]);
  }
  if (r.prompt_version !== request.prompt_version) {
    issues.push(
      `prompt_version ${JSON.stringify(r.prompt_version)} does not match ` +
        `request ${request.prompt_version}`,
    );
  }
  if (!Array.isArray(r.items)) {
    throw new ExtractionContractError(['"items" must be an array']);
  }

  const want = new Set(request.items.map((i) => i.id));
  const seen = new Map<string, number>();
  for (const [i, item] of (r.items as unknown[]).entries()) {
    const at = `items[${i}]`;
    const it = item as Record<string, unknown> | null;
    if (typeof it !== "object" || it === null) {
      issues.push(`${at} must be an object`);
      continue;
    }
    if (typeof it.id !== "string" || it.id === "") {
      issues.push(`${at}.id must be a non-empty string`);
      continue;
    }
    seen.set(it.id, (seen.get(it.id) ?? 0) + 1);
    if (!Array.isArray(it.fields)) {
      issues.push(`${at} (${it.id}).fields must be an array`);
      continue;
    }
    for (const [j, f] of it.fields.entries()) {
      const ft = `${at} (${it.id}).fields[${j}]`;
      const fe = f as Record<string, unknown> | null;
      if (typeof fe !== "object" || fe === null) {
        issues.push(`${ft} must be an object`);
        continue;
      }
      if (typeof fe.field !== "string" || fe.field === "") {
        issues.push(`${ft}.field must be a non-empty string`);
      }
      if (typeof fe.quote !== "string" || fe.quote === "") {
        issues.push(`${ft}.quote must be a non-empty string`);
      }
      if (!Number.isInteger(fe.source_index)) {
        issues.push(`${ft}.source_index must be an integer`);
      }
      const v = fe.value;
      if (
        (typeof v !== "string" && typeof v !== "number") ||
        (typeof v === "number" && !Number.isFinite(v))
      ) {
        issues.push(`${ft}.value must be a string or a finite number`);
      }
    }
  }

  for (const [id, count] of seen) {
    if (!want.has(id)) issues.push(`response has unknown id "${id}"`);
    else if (count > 1) issues.push(`response repeats id "${id}" ${count}×`);
  }
  for (const id of want) {
    if (!seen.has(id)) issues.push(`response is missing id "${id}"`);
  }

  if (issues.length > 0) throw new ExtractionContractError(issues);
}

// ---------------------------------------------------------------------------
// Post-processing — regex merge + LLM fill + the §5.3 gate
// ---------------------------------------------------------------------------

/**
 * Apply a validated response over the regex pass. Pure — takes `request`/
 * `response` explicitly so the two-phase session hand-off (emit request,
 * fill response later) shares this code path with `extract`. Output order =
 * input order; every returned cluster carries `extraction` (non-extract
 * pages get the empty slot).
 */
export function applyExtraction<T extends ClassifiedCluster>(
  clusters: readonly T[],
  request: ExtractionRequest,
  response: unknown,
): ExtractedCluster<T>[] {
  assertExtractionResponse(request, response);
  const orphan = request.items.filter((i) => !clusters.some((c) => c.id === i.id));
  if (orphan.length > 0) {
    throw new ExtractionContractError(
      orphan.map((i) => `request item "${i.id}" is not in the cluster batch`),
    );
  }

  const byId = new Map(response.items.map((i) => [i.id, i]));

  return clusters.map((cluster) => {
    const page = cluster.classification.page;
    if (!isExtractPage(page)) {
      return {
        ...cluster,
        extraction: { page, fields: {}, drops: [], flags: [] } satisfies ItemExtraction,
      };
    }
    const spec = PAGE_FIELD_SPECS[page];
    const slot = regexExtract(cluster, page);

    const respItem = byId.get(cluster.id);
    for (const f of respItem?.fields ?? []) {
      admit(slot, cluster, spec, "llm", {
        field: f.field,
        value: f.value,
        source_index: f.source_index,
        quote: f.quote,
      });
    }
    deriveAmountUsd(slot);

    const flags = [
      ...spec.llm
        .filter((f) => slot.fields[f] === undefined)
        .map((f) => `missing:${f}`),
      ...spec.required
        .filter((f) => slot.fields[f] === undefined)
        .map((f) => `missing-required:${f}`),
    ];

    return {
      ...cluster,
      extraction: { page, fields: slot.fields, drops: slot.drops, flags },
    };
  });
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

export interface ExtractOptions {
  /** The `llm()` seam implementation — `session` in a build, `replay` in CI. */
  llm: { extract(request: ExtractionRequest): Promise<ExtractionResponse> };
  /** Edition week id stamped on the request (audit + prompt `{{WEEK_ID}}`). */
  week?: string;
  /** STYLE.md git SHA stamped on the request. `"unknown"` when omitted. */
  styleRev?: string;
  /** Prompt contract version. `EXTRACT_PROMPT_VERSION` when omitted. */
  promptVersion?: number;
}

/**
 * The `extract` stage: classified clusters → regex candidates → the `llm()`
 * seam for the gaps → `ExtractedCluster[]`, in input order. When no cluster
 * needs the model (no extract pages, or regexes covered everything) the seam
 * is never called — no request file, no judgement needed.
 */
export async function extract<T extends ClassifiedCluster>(
  clusters: readonly T[],
  opts: ExtractOptions,
): Promise<ExtractedCluster<T>[]> {
  const request = buildExtractionRequest(clusters, opts);
  const response =
    request.items.length === 0
      ? { prompt_version: request.prompt_version, items: [] }
      : await opts.llm.extract(request);
  return applyExtraction(clusters, request, response);
}
