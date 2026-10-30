/**
 * P6 — `draft` stage (PLAN.md §5.2): `ExtractedCluster[]` → drafted clusters +
 * the edition `briefing`.
 *
 * Seventh stage in `PIPELINE_STAGES` (after extract). The stage produces the
 * prose the reader sees — one `one_liner` per item-bearing item, an optional
 * `take` per page, page headlines where STYLE.md forces a house format
 * (funding's `Company raised $Xm Stage led by Lead`, discourse's question
 * frame), and the 5–7 sentence `briefing` over the week's classified items.
 *
 * Judgement (the one-liners, the briefing prose, question framing) goes
 * through the `llm()` seam via `prompts/draft.prompt.md` — the session is the
 * model, or a recorded response replays in CI (see `../llm.ts`). Everything
 * STYLE.md makes decidable is enforced in code here, the same way P5 gates
 * evidence: a violating candidate is repaired where a repair is mechanical
 * (single-sentence one-liner, ≤140 chars, no links, `!`→`.`, ≤1 take per
 * page, funding headline generated from extraction fields) or dropped with a
 * recorded reason — nothing ships silently.
 *
 * ## STYLE.md is consumed, not duplicated
 *
 * The request carries the file verbatim (`style_md`) so the versioned prompt
 * is the only place STYLE.md's intent lives; this file parses the mechanical
 * halves it must enforce — the §7 banned-word/phrase list and the §2 banned
 * openings — out of the same text at apply time (see `bannedTermsFromStyle`,
 * `bannedOpeningsFromStyle`). A drift in STYLE.md's §7 layout fails the
 * set-integrity tests, not the build silently.
 *
 * ## What emit and P7 consume
 *
 * Every drafted cluster carries `draft`: `one_liner`, optional `take` (bare
 * text — the renderer adds the em-dash and italics), optional `headline`
 * override, `mono` (the extraction-derived fields the renderer sets in mono —
 * the brief's "mono-eligible fields flagged for the renderer"), `drops`, and
 * `flags`. The edition-level `briefing` keeps `supports`: sentence index →
 * cluster ids, exactly the attribution P7's entailment check needs. A
 * `rubric` scorecard (STYLE.md §10, R1–R14) is computed over the enforced
 * output and recorded — the self-check the brief requires.
 *
 * ## Non-goals
 *
 * Cover selection and page caps are emit's (it picks ≤ DESIGN §3 maxItems
 * from ranked items; draft covers every classified item). Entailment
 * verification is P7 — this stage only checks the mechanical half of
 * traceability (numbers and quoted spans must appear verbatim in excerpts).
 */

import type { CompanyEntry } from "../config.js";
import type { ClassifyPage } from "./classify.js";
import { clusterPublishers } from "./classify.js";
import type {
  ExtractedCluster,
  ExtractFieldName,
  ExtractFieldValue,
} from "./extract.js";

// ---------------------------------------------------------------------------
// Constants — the STYLE.md / DESIGN.md rules this stage enforces
// ---------------------------------------------------------------------------

/**
 * The prompt contract version — must equal `prompt_version` in
 * `prompts/draft.prompt.md`'s frontmatter (a test enforces it) and the
 * `prompt_version` on every response the seam returns.
 */
export const DRAFT_PROMPT_VERSION = 1;

/** STYLE.md §2 — the one-liner cap. */
export const ONE_LINER_MAX_CHARS = 140;

/** STYLE.md §3 — the briefing is 5–7 sentences. */
export const BRIEFING_MIN_SENTENCES = 5;
export const BRIEFING_MAX_SENTENCES = 7;

/**
 * The pages draft writes prose for. `markets` is a dataset page (chart +
 * ≤10 tickers — DESIGN §3, no item cards); `unsorted` never reaches an
 * edition page (R14). Derived pages (cover/briefing/most_covered/back_page)
 * are never classified labels.
 */
export const DRAFT_PAGES = [
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "discourse",
] as const;

export type DraftPage = (typeof DRAFT_PAGES)[number];

const DRAFT_PAGE_SET = new Set<string>(DRAFT_PAGES);

export function isDraftPage(page: string): page is DraftPage {
  return DRAFT_PAGE_SET.has(page);
}

/** DESIGN §3 per-page item caps — reported by the rubric (emit enforces). */
export const PAGE_ITEM_CAPS: Record<DraftPage, number> = {
  models: 6,
  performance: 5,
  launches: 6,
  funding: 6,
  deals: 4,
  discourse: 3,
};

// ---------------------------------------------------------------------------
// Request / response shapes (draft.{request,response}.json)
// ---------------------------------------------------------------------------

/** One member excerpt projected for the model — `source_index` keys the item. */
export interface DraftSourceRef {
  source_index: number;
  publisher: string;
  excerpt: string;
}

/** A tagged company projected as slug + display name (headline generation). */
export interface DraftCompanyRef {
  slug: string;
  name: string;
}

/** One request item — a cluster flattened to what the model drafts on. */
export interface DraftRequestItem {
  /** The cluster id (joins the response back — echoed verbatim). */
  id: string;
  /** The classified page — selects house rules. */
  page: DraftPage;
  /** The representative (publisher) headline — one-liners must differ. */
  headline: string;
  publisher: string;
  published_at: string;
  /** Tagged companies as slug + display name (registry-resolved). */
  companies: DraftCompanyRef[];
  /** P5's extracted fields — the only numbers/facts beyond excerpts. */
  extracted: Partial<Record<ExtractFieldName, ExtractFieldValue>>;
  /** Every member excerpt — the only text claims may trace to. */
  sources: DraftSourceRef[];
}

/** `draft.request.json` — the batch handed to the `llm()` seam. */
export interface DraftRequest {
  week: string;
  prompt_version: number;
  /** Git SHA of STYLE.md at request time (audit parity with classify). */
  style_rev: string;
  /** STYLE.md verbatim — consumed, never duplicated into the prompt. */
  style_md: string;
  items: DraftRequestItem[];
}

/** One response entry — the model's prose for one request item. */
export interface DraftResponseItem {
  /** Echo of the request item's `id`. */
  item_id: string;
  /** One sentence, ≤140 chars, what-it-is + why-it-matters. */
  one_liner: string;
  /** Bare take text (no ` — *…*` wrapper); null/absent = no take. */
  take?: string | null;
  /** Optional headline override — required for `discourse` (question). */
  headline?: string | null;
}

/** `draft.response.json` — the judgement the seam returns. */
export interface DraftResponse {
  prompt_version: number;
  /** Exactly one entry per request item, in any order. */
  one_liners: DraftResponseItem[];
  briefing: {
    /** 5–7 sentences of prose, in order. */
    sentences: string[];
    /**
     * Sentence index (string key) → supporting item ids — the attribution
     * P7's entailment check needs. Every sentence must map to ≥ 1 item.
     */
    supports: Record<string, string[]>;
  };
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

/**
 * The mono-eligible fields the renderer sets in mono — flagged here so emit
 * never derives display values from prose. Derived from `extraction`, never
 * written by the model.
 */
export interface DraftMono {
  /** Performance: the benchmark score/rank (`metric_value`). Models: the
   * version identifier (`version`). */
  number?: string | undefined;
  /** Funding/deals: the display amount ("$1.5B"). */
  amount?: string | undefined;
  /** Funding: round stage ("Series A"). */
  stage?: string | undefined;
  /** Funding: lead investor display name. */
  lead?: string | undefined;
  /** Deals: buyer display name. */
  acquirer?: string | undefined;
  /** Deals: acquired company display name. */
  target?: string | undefined;
}

/** A rejected or repaired candidate — the audit trail for what changed. */
export interface DraftDrop {
  /** What was dropped/repaired (`one_liner`, `take`, `headline`, `sentence`). */
  field: string;
  reason: string;
  /** The offending text or detail, when useful. */
  detail?: string | undefined;
}

/** The draft slot attached to every cluster the stage touches. */
export interface ItemDraft {
  /**
   * House-format headline override. Funding: generated deterministically
   * (`Company raised $Xm Stage led by Lead`, or "undisclosed" when the
   * amount is not public). Discourse: the model's question headline
   * (enforced `?`). Other pages: the model's override when provided.
   * Absent → emit renders the representative headline.
   */
  headline?: string | undefined;
  /** The enforced one-liner. Absent only on non-drafted pages. */
  one_liner?: string | undefined;
  /** Bare take text — the renderer adds ` — ` and italics (STYLE §4). */
  take?: string | undefined;
  /** Extraction-derived fields flagged for mono rendering. */
  mono: DraftMono;
  /** Every dropped/repaired candidate, in order. */
  drops: DraftDrop[];
  /** `missing:<field>` and soft-rule flags (`banned-word:…`). */
  flags: string[];
}

/** A cluster with its draft slot — the type emit consumes. */
export type DraftedCluster<T extends ExtractedCluster = ExtractedCluster> = T & {
  draft: ItemDraft;
};

/** The edition-level briefing draft. */
export interface BriefingDraft {
  /** The enforced sentences, in order. */
  sentences: string[];
  /**
   * Sentence index → supporting cluster ids — P7's entailment input.
   * Covers every emitted sentence index.
   */
  supports: Record<number, string[]>;
  /** Dropped sentences and supports rewrites, in order. */
  drops: DraftDrop[];
  flags: string[];
}

// ---------------------------------------------------------------------------
// Rubric (STYLE.md §10) — the self-check recorded with every draft
// ---------------------------------------------------------------------------

export type RubricStatus = "pass" | "fail" | "n/a";

export interface RubricCheckResult {
  /** Rubric id, e.g. "R1". */
  id: string;
  name: string;
  applies_to: string;
  status: RubricStatus;
  /** What failed (or what an n/a check defers to). */
  details: string[];
}

export interface RubricReport {
  /** True iff every applicable check passed (the rubric is a gate). */
  pass: boolean;
  checks: RubricCheckResult[];
}

/** The stage's full output — drafted clusters, briefing, scorecard. */
export interface DraftOutput<T extends ExtractedCluster = ExtractedCluster> {
  clusters: DraftedCluster<T>[];
  briefing: BriefingDraft;
  rubric: RubricReport;
}

// ---------------------------------------------------------------------------
// STYLE.md parsing — the mechanical halves consumed from the file itself
// ---------------------------------------------------------------------------

const ELLIPSIS = /[.]{3}|…/g;

/**
 * Expand a STYLE.md suffix alternation — `turbocharge(d)` →
 * ["turbocharge","turbocharged"], `game-changer(-ing)` →
 * ["game-changer","game-changing"], `soar(s)` → ["soar","soars"].
 */
function expandSuffixAlternation(term: string): string[] {
  const m = term.match(/^([a-z][a-z-]*?)\((-?[a-z]+)\)$/);
  if (m === null) return [term];
  const stem = m[1]!;
  const suffix = m[2]!;
  const variant =
    suffix === "-ing"
      ? `${stem.replace(/(er|e)$/, "")}ing`
      : `${stem}${suffix}`;
  return [stem, variant];
}

/**
 * Parse the banned words/phrases out of STYLE.md §7. Quoted spans in the
 * bait/vague/overclaim/attribution/cliché subsections are phrase bans; the
 * `**Hype words:**` paragraph is a comma-separated word list — suffix
 * alternations like `(d)`/`(-ing)` expand to both forms, parenthetical usage
 * notes like `(as a verb of value)` are stripped, and the Content-exclusions
 * paragraph is skipped (a sourcing ban, not a word ban). Words match
 * whole-word; phrases match their literal span.
 */
export function bannedTermsFromStyle(styleMd: string): {
  words: string[];
  phrases: string[];
} {
  const sec = styleMd.match(/##\s*7\.\s*Banned patterns([\s\S]*?)(?=\n##\s|\s*$)/);
  // The content-exclusions paragraph bans sources, not words — skip it.
  const body = (sec?.[1] ?? "").split(/\*\*Content exclusions/).at(0) ?? "";
  const words: string[] = [];
  const phrases: string[] = [];
  for (const para of body.split(/\*\*[A-Za-z][^*]*:\*\*/)) {
    // Usage-note parens come off first — `(§10, R5)` contains a comma that
    // would otherwise split the list, and `(use "rose"/"fell")` carries
    // quotes that are not phrase bans. Suffix parens `(d)`/`(-ing)` survive.
    const noted = para.replace(/\((?!-?[a-z]+\))[^)]*\)/g, " ");
    // Quoted spans are verbatim phrase bans.
    const unquoted = noted.replace(/[“"]([^”"]+)[”"]/g, (_m, q: string) => {
      const t = q.trim().replace(ELLIPSIS, "").replace(/\s+/g, " ");
      if (t !== "") phrases.push(t);
      return " ";
    });
    // The remaining comma list holds bare banned words ("Hype words").
    for (const term of unquoted.split(",")) {
      const cleaned = term
        .replace(/\((?!-?[a-z]+\))[^)]*\)/g, " ") // any leftover usage notes
        .replace(/["'`]/g, "")
        .replace(ELLIPSIS, " ")
        .replace(/[.\n;]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      for (const w of expandSuffixAlternation(cleaned)) {
        const t = w.replace(/[()]/g, "").trim();
        if (t === "" || /\s{2,}/.test(t)) continue;
        if (/^\S+$/.test(t)) {
          words.push(t);
          continue;
        }
        // Multi-word residue is meta-text (instructions, not phrases) — keep
        // only short spans with no meta words and no slashes.
        const meta =
          /\//.test(t) ||
          t.length > 40 ||
          /\b(or|as|use|unless|name|without|addressed|framing|verb|stated|sourced|asserted|anonymous|reader|speculation|responsibly)\b/i.test(t);
        if (!meta) phrases.push(t);
      }
    }
  }
  return { words: [...new Set(words)], phrases: [...new Set(phrases)] };
}

/**
 * Parse the §2 banned-openings list. Quoted spans after "Banned openings:"
 * — up to the end of that paragraph — are opening phrases; `…`/`:` tails are
 * trimmed and a leading `X ` is a subject placeholder (`"X just dropped"` →
 * any leading word + "just dropped").
 */
export function bannedOpeningsFromStyle(styleMd: string): string[] {
  const m = styleMd.match(/Banned openings:([\s\S]{0,300})/);
  const slice = (m?.[1] ?? "").split(/\n\n/).at(0) ?? "";
  const out: string[] = [];
  slice.replace(/[“"]([^”"]+)[”"]/g, (_x, q: string) => {
    const t = q
      .trim()
      .replace(ELLIPSIS, "")
      .replace(/[,:;.]+$/, "")
      .trim()
      .toLowerCase();
    if (t !== "") out.push(t);
    return " ";
  });
  return out;
}

/** The parsed mechanical ruleset — built once per draft() call. */
export interface StyleRules {
  bannedWords: string[];
  bannedPhrases: string[];
  bannedOpenings: string[];
}

export function styleRulesFromStyleMd(styleMd: string): StyleRules {
  const { words, phrases } = bannedTermsFromStyle(styleMd);
  return { bannedWords: words, bannedPhrases: phrases, bannedOpenings: bannedOpeningsFromStyle(styleMd) };
}

// ---------------------------------------------------------------------------
// Prose helpers
// ---------------------------------------------------------------------------

const URL_RE = /(?:https?:\/\/|www\.)\S+/gi;
const MD_LINK_RE = /\[([^\]]*)\]\([^)]*\)/g;
const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu;

/**
 * Split text into sentences on terminal `.`, `?`, `!` (rubric R1's rule).
 * Decimals (`36.8`, `$11.5B`), initialisms (`U.S.`, `U.K.`), and common
 * abbreviations do not end a sentence — the dot is masked before splitting.
 */
export function splitSentences(text: string): string[] {
  const DOT = "\uE000";
  const masked = text
    .replace(/(\d)\.(\d)/g, `$1${DOT}$2`) // decimals
    .replace(/\b([A-Z])\.([A-Z])\./g, `$1${DOT}$2${DOT}`) // U.S., U.K.
    .replace(/\b(vs|Mr|Ms|Mrs|Dr|St|Jr|Sr|Inc|Ltd|No|Fig|approx|ca|e\.g|i\.e|etc)\./gi, (m) => m.replace(/\./g, DOT)) // abbreviations
    .replace(/\.{2,}/g, (m) => m.replace(/\./g, DOT)); // ellipses
  const out = masked.match(/[^.!?]+[.!?]+["'”’)]*\s*|[^.!?]+$/g);
  return (out ?? [])
    .map((s) => s.replace(new RegExp(DOT, "g"), ".").trim())
    .filter((s) => s !== "");
}

/** Number-like tokens in produced text — traceability candidates (R6/R12). */
export function numberTokens(text: string): string[] {
  const out = text.match(/(?:\$\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|[KMBT]\b|million|billion|trillion)?/gi);
  return (out ?? []).map((s) => s.trim()).filter((s) => /\d/.test(s));
}

/**
 * Canonical numeric value for traceability: `$100M` and `$100 million` are
 * the same claim, as are `10,322` and `10322`. Returns `value*scale + unit`
 * (`%` kept distinct; `$` ignored — money-vs-not is P7's entailment job).
 */
export function canonNumber(token: string): string | undefined {
  const m = token
    .replace(/,/g, "")
    .match(/^\$?\s*(\d+(?:\.\d+)?)\s*(K|M|B|T|million|billion|trillion|%)?$/i);
  if (m === null) return undefined;
  const scale =
    { k: 1e3, m: 1e6, b: 1e9, t: 1e12, million: 1e6, billion: 1e9, trillion: 1e12 }[
      (m[2] ?? "").toLowerCase()
    ] ?? 1;
  const unit = m[2]?.toLowerCase() === "%" ? "%" : "";
  return `${Number(m[1]) * scale}${unit}`;
}

/**
 * Does the number claim appear, in any spelling, in some source text?
 * `sources` is the cluster's verbatim publisher text — member excerpts and
 * headlines (a model version like "Opus 5.5" lives in the headline, not the
 * excerpt). Traced when the token is a verbatim substring (`1516` inside
 * `1516.166…`) or a canonically equal value (`$100M` ≡ `$100 million`).
 */
export function numberTraced(token: string, sources: readonly string[]): boolean {
  const want = canonNumber(token);
  return sources.some(
    (s) => s.includes(token) || (want !== undefined && numberTokens(s).some((n) => canonNumber(n) === want)),
  );
}

/** The verbatim publisher text a claim may trace to: excerpts + headlines. */
export function clusterSourceText(cluster: { item: { headline: string }; items: readonly { headline: string; excerpt: string }[] }): string[] {
  return [cluster.item.headline, ...cluster.items.flatMap((m) => [m.headline, m.excerpt])];
}

/** Quoted spans in produced text — verbatim-fact candidates (R6). */
export function quotedSpans(text: string): string[] {
  const out: string[] = [];
  text.replace(/[“"]([^”"]{3,120})[”"]/g, (_m, q: string) => {
    out.push(q.trim());
    return " ";
  });
  return out;
}

/**
 * Mechanical prose cleanup shared by one-liners, takes, and briefing
 * sentences: markdown links unwrap to their text, bare URLs are removed,
 * emoji are stripped, `!` becomes `.`. Returns the cleaned text and the
 * flags/drops it produced.
 */
function cleanProse(
  text: string,
  field: string,
  drops: DraftDrop[],
): { text: string; flags: string[] } {
  const flags: string[] = [];
  let t = text;
  const linked = t.replace(MD_LINK_RE, "$1");
  if (linked !== t) {
    t = linked;
    flags.push("link-stripped");
    drops.push({ field, reason: "markdown-link", detail: text });
  }
  const noUrl = t.replace(URL_RE, "");
  if (noUrl !== t) {
    t = noUrl;
    flags.push("link-stripped");
    drops.push({ field, reason: "bare-url", detail: text });
  }
  const noEmoji = t.replace(EMOJI_RE, "");
  if (noEmoji !== t) {
    t = noEmoji;
    flags.push("emoji-stripped");
    drops.push({ field, reason: "emoji", detail: text });
  }
  // Mono markers (`**…**`) belong to the renderer — literal markers in prose
  // would leak to the page (Item.tsx renders one_liner as text).
  const noMarkers = t.replace(/\*\*/g, "");
  if (noMarkers !== t) {
    t = noMarkers;
    flags.push("markers-stripped");
    drops.push({ field, reason: "mono-markers", detail: text });
  }
  const noBang = t.replace(/!/g, ".");
  if (noBang !== t) {
    t = noBang;
    flags.push("exclamation-removed");
    drops.push({ field, reason: "exclamation", detail: text });
  }
  return { text: t.replace(/\s+/g, " ").replace(/\s+([.,;:?])/g, "$1").trim(), flags };
}

/**
 * Whole-word banned-term hits in `text` — STYLE §7 enforcement (R5). Words
 * match on word boundaries; phrases match their literal span, both
 * case-insensitive.
 */
export function bannedHits(text: string, rules: StyleRules): string[] {
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const w of rules.bannedWords) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) hits.push(w);
  }
  for (const p of rules.bannedPhrases) {
    if (p !== "" && lower.includes(p)) hits.push(p);
  }
  return hits;
}

/** Whether `text` opens with a §2 banned opening (whole-phrase, start-anchored). */
export function bannedOpeningHit(text: string, rules: StyleRules): string | undefined {
  const t = text.trim().toLowerCase();
  for (const o of rules.bannedOpenings) {
    if (o.startsWith("x ")) {
      // "X just dropped" — X is a subject placeholder.
      if (new RegExp(`^.{1,30}?\\b${o.slice(2).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t)) {
        return o;
      }
      continue;
    }
    if (t.startsWith(o)) return o;
  }
  return undefined;
}

/** Normalized comparison key for the one-liner ≠ headline rule (R4). */
export function proseKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

/**
 * Build `draft.request.json`: one item per draft-page cluster (markets is a
 * dataset page; unsorted never reaches prose). Pure — `week`/`styleRev`/
 * `styleMd` arrive via options.
 */
export function buildDraftRequest<T extends ExtractedCluster>(
  clusters: readonly T[],
  companies: readonly CompanyEntry[],
  opts: { week?: string; styleRev?: string; styleMd?: string; promptVersion?: number } = {},
): DraftRequest {
  const nameOf = new Map(companies.map((c) => [c.slug, c.name]));
  const items: DraftRequestItem[] = [];
  for (const cluster of clusters) {
    const page = cluster.classification.page;
    if (!isDraftPage(page)) continue;
    const extracted: DraftRequestItem["extracted"] = {};
    for (const [name, f] of Object.entries(cluster.extraction?.fields ?? {})) {
      extracted[name as ExtractFieldName] = f!.value;
    }
    items.push({
      id: cluster.id,
      page,
      headline: cluster.item.headline,
      publisher: cluster.item.publisher,
      published_at: cluster.item.published_at,
      companies: cluster.classification.company_slugs
        .map((slug) => ({ slug, name: nameOf.get(slug) ?? slug }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
      extracted,
      sources: cluster.items.map((m, i) => ({
        source_index: i,
        publisher: m.publisher,
        excerpt: m.excerpt,
      })),
    });
  }
  return {
    week: opts.week ?? "",
    prompt_version: opts.promptVersion ?? DRAFT_PROMPT_VERSION,
    style_rev: opts.styleRev ?? "unknown",
    style_md: opts.styleMd ?? "",
    items,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/**
 * Substitute the `{{…}}` placeholders in the versioned prompt template —
 * `{{ITEMS_JSON}}` becomes the pretty-printed request items, `{{STYLE_MD}}`
 * the verbatim style contract. Unknown placeholders are left untouched.
 */
export function renderDraftPrompt(template: string, request: DraftRequest): string {
  const vars: Record<string, string> = {
    WEEK_ID: request.week,
    STYLE_MD_GIT_SHA: request.style_rev,
    PROMPT_VERSION: String(request.prompt_version),
    ITEMS_JSON: JSON.stringify(request.items, null, 2),
    STYLE_MD: request.style_md,
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

/**
 * A malformed `draft.response.json` — structural violations that make the
 * batch untrustworthy (wrong version, missing/extra/dupe ids, malformed
 * entries, supports out of range). Semantic violations never throw — they
 * degrade to recorded drops and flags.
 */
export class DraftContractError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid draft response: ${issues.join("; ")}`);
    this.name = "DraftContractError";
  }
}

/**
 * Enforce the response contract against the request: `prompt_version`
 * matches, every requested item id appears exactly once in `one_liners`,
 * `briefing.sentences` is a non-empty-string array, and `supports` keys are
 * in-range indices with string-array values. Throws `DraftContractError`.
 */
export function assertDraftResponse(
  request: DraftRequest,
  response: unknown,
): asserts response is DraftResponse {
  const issues: string[] = [];
  const r = response as Record<string, unknown> | null;
  if (typeof r !== "object" || r === null) {
    throw new DraftContractError(["response must be an object"]);
  }
  if (r.prompt_version !== request.prompt_version) {
    issues.push(
      `prompt_version ${JSON.stringify(r.prompt_version)} does not match ` +
        `request ${request.prompt_version}`,
    );
  }
  if (!Array.isArray(r.one_liners)) {
    throw new DraftContractError(['"one_liners" must be an array']);
  }

  const want = new Set(request.items.map((i) => i.id));
  const seen = new Map<string, number>();
  for (const [i, entry] of (r.one_liners as unknown[]).entries()) {
    const at = `one_liners[${i}]`;
    const it = entry as Record<string, unknown> | null;
    if (typeof it !== "object" || it === null) {
      issues.push(`${at} must be an object`);
      continue;
    }
    if (typeof it.item_id !== "string" || it.item_id === "") {
      issues.push(`${at}.item_id must be a non-empty string`);
      continue;
    }
    seen.set(it.item_id, (seen.get(it.item_id) ?? 0) + 1);
    if (typeof it.one_liner !== "string" || it.one_liner.trim() === "") {
      issues.push(`${at} (${it.item_id}).one_liner must be a non-empty string`);
    }
    if (it.take !== undefined && it.take !== null && typeof it.take !== "string") {
      issues.push(`${at} (${it.item_id}).take must be a string or null`);
    }
    if (it.headline !== undefined && it.headline !== null && typeof it.headline !== "string") {
      issues.push(`${at} (${it.item_id}).headline must be a string or null`);
    }
  }
  for (const [id, count] of seen) {
    if (!want.has(id)) issues.push(`response has unknown id "${id}"`);
    else if (count > 1) issues.push(`response repeats id "${id}" ${count}×`);
  }
  for (const id of want) {
    if (!seen.has(id)) issues.push(`response is missing id "${id}"`);
  }

  const b = r.briefing as Record<string, unknown> | null;
  if (typeof b !== "object" || b === null) {
    throw new DraftContractError(['"briefing" must be an object']);
  }
  if (!Array.isArray(b.sentences) || b.sentences.some((s) => typeof s !== "string" || s.trim() === "")) {
    issues.push('"briefing.sentences" must be an array of non-empty strings');
  }
  const n = Array.isArray(b.sentences) ? b.sentences.length : 0;
  if (typeof b.supports !== "object" || b.supports === null || Array.isArray(b.supports)) {
    issues.push('"briefing.supports" must be an object');
  } else {
    for (const [k, v] of Object.entries(b.supports as Record<string, unknown>)) {
      if (!/^\d+$/.test(k) || Number(k) >= n) {
        issues.push(`briefing.supports key "${k}" is not a valid sentence index`);
      }
      if (!Array.isArray(v) || v.some((s) => typeof s !== "string" || s === "")) {
        issues.push(`briefing.supports["${k}"] must be an array of non-empty strings`);
      }
    }
  }

  if (issues.length > 0) throw new DraftContractError(issues);
}

// ---------------------------------------------------------------------------
// Headline rules — house formats enforced in code
// ---------------------------------------------------------------------------

const HEADLINE_LINK_RE = /https?:\/\/|\]\(/;

/**
 * STYLE §6 funding headline: `{Company} raised {amount} {stage} led by
 * {lead}` — with "an undisclosed amount" when no amount is public. Generated
 * deterministically from extraction + the company's registry name; the
 * model's own funding headline is never trusted to the page.
 */
export function fundingHeadline(
  company: string | undefined,
  f: { amount?: string | undefined; stage?: string | undefined; lead?: string | undefined },
): string | undefined {
  if (company === undefined || company.trim() === "") return undefined;
  // A filing is not a raise: S-1/IPO events get a filing headline, not the
  // raise template (an item with no amount/stage is still a raise report).
  if (
    f.amount === undefined &&
    f.stage !== undefined &&
    /^(?:S-1|IPO(?:\s+filing)?|filing)$/i.test(f.stage.trim())
  ) {
    // Uniform "files for IPO" so a filing and its coverage dedup to one item.
    return `${company} files for IPO`;
  }
  const amount = f.amount !== undefined ? f.amount : "an undisclosed amount";
  const stage = f.stage !== undefined ? ` ${f.stage}` : "";
  const lead = f.lead !== undefined ? ` led by ${f.lead}` : "";
  return `${company} raised ${amount}${stage}${lead}`;
}

/** R9's check — the generated format: a raise ("raised $X Stage led by Y"),
 *  an explicit "undisclosed" raise, or a filing ("files its S-1"/"files for IPO"). */
export const FUNDING_HEADLINE_RE =
  /^\S.* (?:raised (?:\$\d+(?:\.\d+)?[KMBT]?|an undisclosed amount|undisclosed)|files (?:its S-1|for IPO))(?:\s+\S[^?]*?)?$/;

/**
 * Pick the funding item's company display name: the single tagged company,
 * else the one named in the representative headline, else the first sorted
 * slug (flagged `funding-company-inferred`). `undefined` when untagged.
 */
export function fundingCompany(
  cluster: ExtractedCluster,
  companies: readonly CompanyEntry[],
): { name?: string | undefined; inferred: boolean } {
  const nameOf = new Map(companies.map((c) => [c.slug, c.name]));
  const slugs = cluster.classification.company_slugs;
  if (slugs.length === 1) return { name: nameOf.get(slugs[0]!), inferred: false };
  if (slugs.length > 1) {
    const h = cluster.item.headline.toLowerCase();
    const inHeadline = slugs.find((s) => {
      const name = nameOf.get(s) ?? s;
      return h.includes(name.toLowerCase()) || h.includes(s.toLowerCase());
    });
    if (inHeadline !== undefined) return { name: nameOf.get(inHeadline), inferred: true };
    return { name: nameOf.get([...slugs].sort()[0]!), inferred: true };
  }
  return { inferred: false };
}

// ---------------------------------------------------------------------------
// Post-processing — the enforced apply step
// ---------------------------------------------------------------------------

/** Normalize a take to bare text (accepts ` — *…*`, `*…*`, or bare input). */
export function normalizeTake(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^[—–-]\s*/, "");
  if (t.startsWith("*") && t.endsWith("*") && t.length > 1) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\*+$/, "").trim();
}

interface ApplyOpts {
  companies: readonly CompanyEntry[];
  rules: StyleRules;
}

/** Derive the renderer's mono fields from the extraction slot. */
function deriveMono(cluster: ExtractedCluster, flags: string[]): DraftMono {
  const f = cluster.extraction?.fields ?? {};
  const s = (k: ExtractFieldName): string | undefined =>
    typeof f[k]?.value === "string" ? (f[k]!.value as string) : undefined;
  const page = cluster.classification.page;
  switch (page) {
    case "performance": {
      const number = s("metric_value");
      if (number === undefined) flags.push("missing:number");
      return { number };
    }
    case "funding": {
      const amount = s("amount");
      if (amount === undefined) flags.push("missing:amount");
      return { amount, stage: s("stage"), lead: s("lead_investor") };
    }
    case "deals": {
      const acquirer = s("acquirer");
      const target = s("target");
      if (acquirer === undefined) flags.push("missing:acquirer");
      if (target === undefined) flags.push("missing:target");
      return { acquirer, target, amount: s("amount") };
    }
    case "models": {
      // Optional — a versionless release still renders, just without mono.
      return { number: s("version") };
    }
    default:
      return {};
  }
}

/** Enforce one response item's prose onto a cluster's draft slot. */
function enforceItem(
  cluster: ExtractedCluster,
  entry: DraftResponseItem,
  excerpts: string[],
  opts: ApplyOpts,
): ItemDraft {
  const page = cluster.classification.page as DraftPage;
  const drops: DraftDrop[] = [];
  const flags: string[] = [];
  const { rules } = opts;

  // --- headline -------------------------------------------------------------
  let headline: string | undefined;
  if (page === "funding") {
    const { name, inferred } = fundingCompany(cluster, opts.companies);
    if (inferred) flags.push("funding-company-inferred");
    const fields = cluster.extraction?.fields ?? {};
    headline = fundingHeadline(name, {
      amount: typeof fields.amount?.value === "string" ? fields.amount.value : undefined,
      stage: typeof fields.stage?.value === "string" ? fields.stage.value : undefined,
      lead: typeof fields.lead_investor?.value === "string" ? fields.lead_investor.value : undefined,
    });
    if (headline === undefined) {
      const proposed = entry.headline?.trim();
      if (proposed !== undefined && proposed !== "" && FUNDING_HEADLINE_RE.test(proposed) && !HEADLINE_LINK_RE.test(proposed)) {
        headline = proposed;
        flags.push("funding-headline-from-model");
      } else {
        flags.push("funding-headline-unresolved");
      }
    }
    if (entry.headline !== undefined && entry.headline !== null && entry.headline.trim() !== headline) {
      drops.push({ field: "headline", reason: "funding-headline-generated", detail: entry.headline });
    }
  } else {
    const proposed = entry.headline?.trim();
    if (proposed !== undefined && proposed !== "" && !HEADLINE_LINK_RE.test(proposed)) {
      if (page === "discourse") {
        if (proposed.endsWith("?")) {
          headline = proposed;
        } else {
          drops.push({ field: "headline", reason: "discourse-headline-not-question", detail: proposed });
          flags.push("discourse-headline-unresolved");
        }
      } else if (proseKey(proposed) !== proseKey(cluster.item.headline)) {
        headline = proposed;
        flags.push("headline-override");
      }
    } else if (proposed !== undefined && proposed !== "" && HEADLINE_LINK_RE.test(proposed)) {
      drops.push({ field: "headline", reason: "headline-link", detail: proposed });
    }
    if (page === "discourse" && headline === undefined) {
      flags.push("missing-discourse-headline");
    }
  }

  // --- one_liner ------------------------------------------------------------
  let one_liner: string | undefined;
  {
    const cleaned = cleanProse(entry.one_liner, "one_liner", drops);
    flags.push(...cleaned.flags);
    let t = cleaned.text;
    const sentences = splitSentences(t);
    if (sentences.length > 1) {
      t = sentences[0]!;
      flags.push("one-liner-multi-sentence");
      drops.push({ field: "one_liner", reason: "multi-sentence", detail: entry.one_liner });
    }
    if (t.length > ONE_LINER_MAX_CHARS) {
      const cut = t.slice(0, ONE_LINER_MAX_CHARS - 1);
      const lastSpace = cut.lastIndexOf(" ");
      t = (lastSpace > ONE_LINER_MAX_CHARS / 2 ? cut.slice(0, lastSpace) : cut)
        .replace(/[,;:—–-]+$/, "")
        .trim();
      if (!t.endsWith(".")) t = `${t}.`;
      flags.push("one-liner-truncated");
      drops.push({ field: "one_liner", reason: "over-140-chars", detail: entry.one_liner });
    }
    if (t !== "" && !t.endsWith(".")) {
      t = `${t}.`;
      flags.push("period-appended");
    }
    one_liner = t === "" ? undefined : t;
    if (one_liner === undefined) {
      drops.push({ field: "one_liner", reason: "empty-after-cleanup", detail: entry.one_liner });
      flags.push("missing:one_liner");
    } else {
      const opening = bannedOpeningHit(one_liner, rules);
      if (opening !== undefined) flags.push(`banned-opening:${opening}`);
      for (const w of bannedHits(one_liner, rules)) flags.push(`banned-word:${w}`);
      for (const n of numberTokens(one_liner)) {
        if (!numberTraced(n, excerpts)) flags.push(`untraced-number:${n}`);
      }
      const effective = headline ?? cluster.item.headline;
      if (proseKey(one_liner) === proseKey(effective)) flags.push("one-liner-equals-headline");
    }
  }

  // --- take -----------------------------------------------------------------
  let take: string | undefined;
  {
    const raw = entry.take;
    if (raw !== undefined && raw !== null && raw.trim() !== "") {
      if (page === "discourse") {
        drops.push({ field: "take", reason: "take-on-discourse", detail: raw });
      } else {
        const cleaned = cleanProse(normalizeTake(raw), "take", drops);
        flags.push(...cleaned.flags);
        take = cleaned.text === "" ? undefined : cleaned.text;
        if (take === undefined) {
          drops.push({ field: "take", reason: "empty-after-cleanup", detail: raw });
        } else {
          for (const w of bannedHits(take, rules)) flags.push(`banned-word:${w}`);
        }
      }
    }
  }

  const mono = deriveMono(cluster, flags);
  return { headline, one_liner, take, mono, drops, flags };
}

/** Enforce the briefing: links dropped, count bounded, supports re-indexed. */
function enforceBriefing(
  response: DraftResponse["briefing"],
  request: DraftRequest,
  sourceText: string[],
  rules: StyleRules,
): BriefingDraft {
  const drops: DraftDrop[] = [];
  const flags: string[] = [];
  const known = new Set(request.items.map((i) => i.id));

  const sentences: string[] = [];
  const supports: Record<number, string[]> = {};

  for (const [i, raw] of response.sentences.entries()) {
    const cleaned = cleanProse(raw, "sentence", drops);
    flags.push(...cleaned.flags.map((f) => `${f}:sentence-${i}`));
    const t = cleaned.text;
    if (t === "" || /https?:\/\/|\[.*\]\(.*\)/.test(raw)) {
      drops.push({ field: "sentence", reason: "briefing-link-or-empty", detail: raw });
      continue;
    }
    const sup = (response.supports[String(i)] ?? []).filter((id) => {
      const ok = known.has(id);
      if (!ok) drops.push({ field: "supports", reason: "support-unknown-id", detail: `${i}:${id}` });
      return ok;
    });
    if (sup.length === 0) {
      drops.push({ field: "sentence", reason: "unmapped-sentence", detail: raw });
      continue;
    }
    for (const w of bannedHits(t, rules)) flags.push(`banned-word:${w}:sentence-${i}`);
    for (const n of numberTokens(t)) {
      if (!numberTraced(n, sourceText)) flags.push(`untraced-number:${n}:sentence-${i}`);
    }
    sentences.push(t);
    supports[sentences.length - 1] = [...new Set(sup)];
  }

  while (sentences.length > BRIEFING_MAX_SENTENCES) {
    const last = sentences.length - 1;
    drops.push({ field: "sentence", reason: "briefing-over-7", detail: sentences[last] });
    sentences.pop();
    delete supports[last];
  }
  if (sentences.length < BRIEFING_MIN_SENTENCES) {
    flags.push(`briefing-short:${sentences.length}`);
  }

  return { sentences, supports, drops, flags };
}

// ---------------------------------------------------------------------------
// The rubric self-check (STYLE.md §10) — over the enforced output
// ---------------------------------------------------------------------------

function check(
  id: string,
  name: string,
  applies_to: string,
  failures: string[],
): RubricCheckResult {
  return { id, name, applies_to, status: failures.length === 0 ? "pass" : "fail", details: failures };
}

/**
 * Evaluate the STYLE.md §10 rubric over the enforced draft output. `rules`
 * comes from the same STYLE.md parse used during apply; R6's entailment is
 * approximated by its mechanical core (numbers + quoted spans must appear
 * verbatim in excerpts — full entailment is P7).
 */
export function rubricCheck<T extends ExtractedCluster>(
  out: { clusters: DraftedCluster<T>[]; briefing: BriefingDraft },
  rules: StyleRules,
): RubricReport {
  const checks: RubricCheckResult[] = [];
  const drafted = out.clusters.filter((c) => isDraftPage(c.classification.page));

  const produced: { field: string; text: string }[] = [];
  for (const c of drafted) {
    if (c.draft.headline !== undefined) produced.push({ field: `${c.id}.headline`, text: c.draft.headline });
    if (c.draft.one_liner !== undefined) produced.push({ field: `${c.id}.one_liner`, text: c.draft.one_liner });
    if (c.draft.take !== undefined) produced.push({ field: `${c.id}.take`, text: c.draft.take });
  }
  out.briefing.sentences.forEach((s, i) => produced.push({ field: `briefing[${i}]`, text: s }));

  // R1 — Briefing length 5–7.
  checks.push(
    check("R1", "Briefing length", "Briefing",
      out.briefing.sentences.length >= BRIEFING_MIN_SENTENCES &&
        out.briefing.sentences.length <= BRIEFING_MAX_SENTENCES
        ? []
        : [`${out.briefing.sentences.length} sentences, need ${BRIEFING_MIN_SENTENCES}–${BRIEFING_MAX_SENTENCES}`]),
  );

  // R2 — Briefing purity: no links.
  const linkHits = out.briefing.sentences
    .map((s, i) => (/https?:\/\/|\[[^\]]*\]\(/.test(s) ? `sentence ${i} contains a link` : ""))
    .filter((s) => s !== "");
  checks.push(check("R2", "Briefing purity", "Briefing", linkHits));

  // R3 — One-liner length.
  checks.push(
    check("R3", "One-liner length", "every item",
      drafted
        .filter((c) => (c.draft.one_liner?.length ?? 0) > ONE_LINER_MAX_CHARS)
        .map((c) => `${c.id}: ${c.draft.one_liner!.length} chars`)),
  );

  // R4 — One-liner ≠ headline.
  checks.push(
    check("R4", "One-liner ≠ headline", "every item",
      drafted
        .filter(
          (c) =>
            c.draft.one_liner !== undefined &&
            proseKey(c.draft.one_liner) === proseKey(c.draft.headline ?? c.item.headline),
        )
        .map((c) => c.id)),
  );

  // R5 — Banned words (STYLE §7, parsed from the file).
  checks.push(
    check("R5", "Banned words", "all prose",
      produced.flatMap(({ field, text }) => bannedHits(text, rules).map((w) => `${field}: ${w}`))),
  );

  // R6 — Traceability (mechanical core): every number and quoted span in
  // produced text appears verbatim in some source excerpt; every briefing
  // sentence maps to ≥1 item. Full entailment is P7.
  {
    const allSourceText = out.clusters.flatMap(clusterSourceText);
    const failures: string[] = [];
    for (const { field, text } of produced) {
      for (const n of numberTokens(text)) {
        if (!numberTraced(n, allSourceText)) failures.push(`${field}: number "${n}" not in any source`);
      }
      for (const q of quotedSpans(text)) {
        if (!allSourceText.some((e) => e.includes(q))) failures.push(`${field}: quote "${q}" not in any source`);
      }
    }
    for (const [i] of out.briefing.sentences.entries()) {
      if ((out.briefing.supports[i] ?? []).length === 0) {
        failures.push(`briefing[${i}]: no supporting item`);
      }
    }
    checks.push(check("R6", "Traceability", "Briefing, one-liners, takes", failures));
  }

  // R7 — Discourse framing: every drafted discourse headline ends `?`.
  checks.push(
    check("R7", "Discourse framing", "Discourse",
      out.clusters
        .filter((c) => c.classification.page === "discourse")
        .filter((c) => !(c.draft.headline ?? c.item.headline).trimEnd().endsWith("?"))
        .map((c) => c.id)),
  );

  // R8 — Discourse sources: ≥2 distinct publishers.
  checks.push(
    check("R8", "Discourse sources", "Discourse",
      out.clusters
        .filter((c) => c.classification.page === "discourse")
        .filter((c) => clusterPublishers(c).count < 2)
        .map((c) => `${c.id}: ${clusterPublishers(c).count} publisher(s)`)),
  );

  // R9 — Funding format.
  checks.push(
    check("R9", "Funding format", "Funding",
      out.clusters
        .filter((c) => c.classification.page === "funding")
        .filter((c) => {
          const h = c.draft.headline ?? c.item.headline;
          return !FUNDING_HEADLINE_RE.test(h);
        })
        .map((c) => `${c.id}: ${c.draft.headline ?? c.item.headline}`)),
  );

  // R10 — Take quota: ≤1 per page, none on discourse, non-empty.
  {
    const failures: string[] = [];
    const perPage = new Map<DraftPage, string[]>();
    for (const c of drafted) {
      const page = c.classification.page as DraftPage;
      if (c.draft.take !== undefined) {
        if (c.draft.take.trim() === "") failures.push(`${c.id}: empty take`);
        if (page === "discourse") failures.push(`${c.id}: take on discourse`);
        perPage.set(page, [...(perPage.get(page) ?? []), c.id]);
      }
    }
    for (const [page, ids] of perPage) {
      if (ids.length > 1) failures.push(`${page}: ${ids.length} takes (${ids.join(", ")})`);
    }
    checks.push(check("R10", "Take quota", "every page", failures));
  }

  // R11 — No emoji / exclamation in produced text.
  {
    const failures = produced.flatMap(({ field, text }) => {
      const f: string[] = [];
      if (EMOJI_RE.test(text)) f.push(`${field}: emoji`);
      EMOJI_RE.lastIndex = 0;
      if (text.includes("!")) f.push(`${field}: "!`);
      return f;
    });
    checks.push(check("R11", "No emoji / exclamation", "all prose", failures));
  }

  // R12 — Number sanity: every number in produced text matches a source
  // number exactly (same check family as R6's mechanical core), and
  // mono-eligible fields are flagged: performance carries mono.number,
  // funding carries mono.amount or an explicit undisclosed.
  {
    const allSourceText = out.clusters.flatMap(clusterSourceText);
    const failures: string[] = [];
    for (const { field, text } of produced) {
      for (const n of numberTokens(text)) {
        if (!numberTraced(n, allSourceText)) failures.push(`${field}: number "${n}" untraced`);
      }
    }
    for (const c of drafted) {
      const page = c.classification.page;
      // Mono fields must be flagged for the renderer: either carried or
      // recorded as missing — a silently absent mono field fails.
      if (
        page === "performance" &&
        c.draft.mono.number === undefined &&
        !c.draft.flags.includes("missing:number")
      ) {
        failures.push(`${c.id}: performance item has unflagged missing mono number`);
      }
      if (
        page === "funding" &&
        c.draft.mono.amount === undefined &&
        !c.draft.flags.includes("missing:amount") &&
        !/undisclosed/i.test(c.draft.headline ?? c.item.headline)
      ) {
        failures.push(`${c.id}: funding item has unflagged missing mono amount`);
      }
    }
    checks.push(check("R12", "Number sanity", "all prose", failures));
  }

  // R13 — Item cap (DESIGN §3): emit selects ≤cap from ranked items; draft
  // covers every classified item, so the cap is not enforceable here.
  {
    const details = (Object.keys(PAGE_ITEM_CAPS) as DraftPage[])
      .map((p) => `${p}: ${drafted.filter((c) => c.classification.page === p).length}/${PAGE_ITEM_CAPS[p]} drafted`)
      .filter((s) => {
        const m = s.match(/(\d+)\/(\d+)/);
        return m !== null && Number(m[1]) > Number(m[2]);
      });
    checks.push({
      id: "R13",
      name: "Item cap",
      applies_to: "every page",
      status: "n/a",
      details: [
        "emit picks ≤cap items per page; draft covers all classified items",
        ...details.map((d) => `${d} (over cap — emit trims)`),
      ],
    });
  }

  // R14 — Unsorted hygiene: no unsorted item carries draft prose.
  {
    const failures = out.clusters
      .filter((c) => c.classification.page === "unsorted")
      .filter((c) => c.draft.one_liner !== undefined || c.draft.headline !== undefined || c.draft.take !== undefined)
      .map((c) => c.id);
    checks.push(check("R14", "Unsorted hygiene", "edition", failures));
  }

  return {
    pass: checks.every((c) => c.status !== "fail"),
    checks,
  };
}

// ---------------------------------------------------------------------------
// Apply — response → enforced draft slots + briefing + scorecard
// ---------------------------------------------------------------------------

const EMPTY_DRAFT = (page: ClassifyPage): ItemDraft => ({
  mono: {},
  drops: [],
  flags: [`not-drafted:${page}`],
});

/**
 * Apply a validated response over the cluster batch. Pure — takes
 * `request`/`response` explicitly so the two-phase session hand-off shares
 * this code path with `draft`. Output order = input order; every cluster
 * carries `draft` (non-drafted pages get the empty slot).
 */
export function applyDraft<T extends ExtractedCluster>(
  clusters: readonly T[],
  request: DraftRequest,
  response: unknown,
  opts: ApplyOpts,
): DraftOutput<T> {
  assertDraftResponse(request, response);
  const byCluster = new Map(clusters.map((c) => [c.id, c]));
  const orphan = request.items.filter((i) => !byCluster.has(i.id));
  if (orphan.length > 0) {
    throw new DraftContractError(
      orphan.map((i) => `request item "${i.id}" is not in the cluster batch`),
    );
  }

  const byId = new Map(response.one_liners.map((e) => [e.item_id, e]));
  const allSourceText = clusters.flatMap(clusterSourceText);

  const draftedClusters = clusters.map((cluster): DraftedCluster<T> => {
    if (!isDraftPage(cluster.classification.page)) {
      return { ...cluster, draft: EMPTY_DRAFT(cluster.classification.page) };
    }
    const entry = byId.get(cluster.id)!;
    return { ...cluster, draft: enforceItem(cluster, entry, clusterSourceText(cluster), opts) };
  });

  // Take quota (R10): ≤1 take per page — the first in pipeline (rank) order
  // wins; later takes on the same page drop with a recorded reason.
  const takeSeen = new Set<string>();
  for (const c of draftedClusters) {
    const page = c.classification.page;
    if (c.draft.take === undefined) continue;
    if (takeSeen.has(page)) {
      c.draft.drops.push({ field: "take", reason: "take-over-quota", detail: c.draft.take });
      c.draft.flags.push("take-dropped-quota");
      c.draft.take = undefined;
    } else {
      takeSeen.add(page);
    }
  }

  const briefing = enforceBriefing(response.briefing, request, allSourceText, opts.rules);
  const out = { clusters: draftedClusters, briefing };
  return { ...out, rubric: rubricCheck(out, opts.rules) };
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

export interface DraftOptions {
  /** The `llm()` seam implementation — `session` in a build, `replay` in CI. */
  llm: { draft(request: DraftRequest): Promise<DraftResponse> };
  /** `config/companies.yaml` entries — funding headline names come from here. */
  companies: readonly CompanyEntry[];
  /** Edition week id stamped on the request (audit + prompt `{{WEEK_ID}}`). */
  week?: string;
  /** STYLE.md git SHA stamped on the request. `"unknown"` when omitted. */
  styleRev?: string;
  /**
   * STYLE.md content — the request carries it verbatim and the mechanical
   * rules are parsed from it. Required: STYLE.md is consumed, not duplicated.
   */
  styleMd: string;
  /** Prompt contract version. `DRAFT_PROMPT_VERSION` when omitted. */
  promptVersion?: number;
}

/**
 * The `draft` stage: extracted clusters → the `llm()` seam → enforced
 * `DraftedCluster[]` + `briefing` + `rubric`, in input order. When no
 * draft-page cluster exists the seam is never called — an empty briefing is
 * produced (R1 reports it short).
 */
export async function draft<T extends ExtractedCluster>(
  clusters: readonly T[],
  opts: DraftOptions,
): Promise<DraftOutput<T>> {
  const rules = styleRulesFromStyleMd(opts.styleMd);
  const request = buildDraftRequest(clusters, opts.companies, opts);
  if (request.items.length === 0) {
    const out = {
      clusters: clusters.map(
        (c): DraftedCluster<T> => ({ ...c, draft: EMPTY_DRAFT(c.classification.page) }),
      ),
      briefing: { sentences: [], supports: {}, drops: [], flags: ["no-items"] },
    };
    return { ...out, rubric: rubricCheck(out, rules) };
  }
  const response = await opts.llm.draft(request);
  return applyDraft(clusters, request, response, { companies: opts.companies, rules });
}
