/**
 * P7 — `verify` stage (PLAN.md §5.3): deterministic provenance gates on a
 * candidate `Edition` + briefing-sentence entailment through the `llm()` seam.
 *
 * Eighth stage in `PIPELINE_STAGES` (after draft, before emit). §5.3 is the
 * spine of the product and CI-enforced — this file is the check library the
 * CI gate (`scripts/provenance-check.mts`) and the build driver (I1) share:
 * the same `verifyDeterministic` result, the same surgical messages (which
 * item, which field, which rule).
 *
 * ## The checks
 *
 * 1. `sources` — every item on every item-bearing page carries `sources[]`
 *    with non-empty `url`, `publisher`, `published_at`, `fetched_at`,
 *    `adapter`; zero-source items fail. The markets dataset page carries its
 *    sources at page level — same field rule.
 * 2. `evidence` — every numeric claim on the money pages carries
 *    `evidence {source_index, quote}` and `quote` appears verbatim in the
 *    referenced source's stored `excerpt`. Required on: performance items
 *    (`number`), funding items (`amount`/`number`), deals items when
 *    `amount` or `number` is present, and every markets ticker (keyed into
 *    the page-level `sources`). An `evidence` block present anywhere else is
 *    still bounds- and quote-checked — a malformed evidence is a defect even
 *    where it is optional.
 * 3. `companies` — every `companies[]` tag (items and `most_covered`
 *    entries) resolves to a slug in `config/companies.yaml`. The registry is
 *    never extended implicitly; an unknown slug fails the gate (STYLE.md:
 *    such an item belongs on `unsorted`).
 * 4. `discourse` — every discourse item carries ≥ 2 sources from ≥ 2
 *    distinct publishers (the schema enforces the source count; publisher
 *    distinctness is this gate).
 * 5. `briefing` — the mechanical half is checked in code whenever the P6
 *    attribution is supplied: every briefing sentence index appears in
 *    `supports` mapped to ≥ 1 item id that resolves to the supplied item
 *    pool. The entailment judgement itself — does at least one item actually
 *    support each sentence — goes through the `llm()` seam via
 *    `prompts/verify.prompt.md`: session-performed in a build, recorded
 *    (`verify.request.json` / `verify.response.json` next to the edition)
 *    for replay per §8.
 *
 * ## What this stage does NOT check
 *
 * Schema shape (validateEdition/ajv covers it — verify is the §5.3 semantic
 * re-check and deliberately re-runs evidence containment), upstream fields
 * that do not exist yet (a missing field upstream is that stage's defect —
 * open `plan-defect`, never weaken a gate), and `provenance.json` itself
 * (`../provenance.ts` builds and re-checks that record).
 */

import type { Edition, EditionItemDiscourse, EditionSource } from "@weekly/schema";

import type { CompanyEntry } from "../config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The prompt contract version — must equal `prompt_version` in
 * `prompts/verify.prompt.md`'s frontmatter (a test enforces it) and the
 * `prompt_version` on every response the seam returns.
 */
export const VERIFY_PROMPT_VERSION = 1;

/** The check ids, in report order. */
export const VERIFY_CHECKS = [
  "sources",
  "evidence",
  "companies",
  "discourse",
  "briefing",
] as const;

export type VerifyCheckId = (typeof VERIFY_CHECKS)[number];

/** Pages whose items carry `sources[]` at item level. */
const ITEM_PAGES = new Set([
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "discourse",
]);

/**
 * Pages where every item's numeric claim must carry `evidence` (§5.3
 * "Money/Deals/Performance/Markets"). `deals` is handled separately: evidence
 * is required only when `amount` or `number` is present.
 */
const EVIDENCE_ALWAYS_PAGES = new Set(["performance", "funding"]);

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

/** One violated rule instance — the surgical failure the gate prints. */
export interface VerifyIssue {
  /** The check that produced it. */
  check: VerifyCheckId;
  /** JSON-path-ish locator, e.g. `pages.funding.items[2].evidence`. */
  path: string;
  /** What is wrong, in one line. */
  message: string;
}

export type VerifyCheckStatus = "pass" | "fail" | "skipped";

export interface VerifyCheckResult {
  id: VerifyCheckId;
  /** Human-readable rule name (§5.3 bullet). */
  name: string;
  status: VerifyCheckStatus;
  /** `path — message` lines, in traversal order. */
  errors: string[];
  /** Why a `skipped` check did not run. */
  note?: string;
}

export interface VerifyReport {
  /** True iff no check failed (a skipped check never fails the report). */
  ok: boolean;
  checks: VerifyCheckResult[];
  /** Every issue, flattened — the gate's failure output. */
  issues: VerifyIssue[];
}

// ---------------------------------------------------------------------------
// Request / response shapes (verify.{request,response}.json)
// ---------------------------------------------------------------------------

/** One source excerpt projected for the entailment judge. */
export interface VerifySourceRef {
  source_index: number;
  publisher: string;
  excerpt: string;
}

/** One edition item projected for the judge — the sentence's support pool. */
export interface VerifyItemRef {
  /** Stable id the response cites back, e.g. `funding-0`. */
  id: string;
  /** The item's page (context for the judge). */
  page: string;
  headline: string;
  one_liner: string;
  sources: VerifySourceRef[];
}

/** `verify.request.json` — the entailment batch handed to the `llm()` seam. */
export interface VerifyRequest {
  week: string;
  prompt_version: number;
  /** The briefing sentences under judgement, in page order. */
  sentences: string[];
  /**
   * Sentence index (string key) → P6's claimed supporting item ids. Every
   * sentence index must be present with ≥ 1 id that resolves to `items`.
   */
  supports: Record<string, string[]>;
  /** Every item on the edition's item-bearing pages — the support pool. */
  items: VerifyItemRef[];
}

/** One verdict — the judge's call on a single briefing sentence. */
export interface VerifyVerdict {
  sentence_index: number;
  /** True iff ≥ 1 item supports the sentence's claims. */
  supported: boolean;
  /** The item ids (from `items`) that support it; empty when unsupported. */
  item_ids: string[];
  /** Optional one-line reason — recorded for audit. */
  reason?: string;
}

/** `verify.response.json` — the recorded judgement. */
export interface VerifyResponse {
  prompt_version: number;
  /** Exactly one verdict per request sentence, any order. */
  verdicts: VerifyVerdict[];
}

// ---------------------------------------------------------------------------
// The P6 attribution input (mechanical half of check 5)
// ---------------------------------------------------------------------------

/**
 * The sentence→item attribution the draft stage recorded. `supports` maps a
 * briefing sentence index to the item ids P6 claims support it; `items` is
 * the pool those ids resolve into (the edition's item projection — use
 * `verifyItemsFromEdition` for committed editions, or the build's cluster
 * projection for a candidate mid-pipeline).
 */
export interface VerifyAttribution {
  supports: Record<number | string, string[]>;
  items: VerifyItemRef[];
}

// ---------------------------------------------------------------------------
// Deterministic checks (1–4) — the pure-code half of §5.3
// ---------------------------------------------------------------------------

const REQUIRED_SOURCE_FIELDS = [
  "url",
  "publisher",
  "published_at",
  "fetched_at",
  "adapter",
] as const;

interface ItemLike {
  headline?: unknown;
  companies?: unknown;
  sources?: unknown;
  evidence?: unknown;
  amount?: unknown;
  number?: unknown;
}

interface PageLike {
  type?: unknown;
  items?: unknown;
  sources?: unknown;
  tickers?: unknown;
  entries?: unknown;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function itemLabel(path: string, item: ItemLike): string {
  return typeof item.headline === "string" && item.headline !== ""
    ? `${path} "${item.headline}"`
    : path;
}

/**
 * Check 1 — every item has `sources[]` carrying the five required fields.
 * Item-bearing pages are checked per item; the markets page's dataset-level
 * `sources` is checked the same way.
 */
function checkSources(pages: PageLike[], issues: VerifyIssue[]): void {
  const scanSources = (sources: unknown, path: string, label: string): void => {
    if (!Array.isArray(sources)) {
      issues.push({ check: "sources", path, message: `${label} has no sources[]` });
      return;
    }
    if (sources.length === 0) {
      issues.push({ check: "sources", path, message: `${label} has zero sources` });
      return;
    }
    for (const [s, src] of sources.entries()) {
      const at = `${path}.sources[${s}]`;
      if (!isObject(src)) {
        issues.push({ check: "sources", path: at, message: `${label} source is not an object` });
        continue;
      }
      for (const field of REQUIRED_SOURCE_FIELDS) {
        const v = src[field];
        if (typeof v !== "string" || v === "") {
          issues.push({
            check: "sources",
            path: `${at}.${field}`,
            message: `${label} source[${s}] missing ${field}`,
          });
        }
      }
    }
  };

  for (const [p, page] of pages.entries()) {
    const at = `pages.${page.type ?? p}`;
    if (typeof page.type === "string" && ITEM_PAGES.has(page.type)) {
      const items = Array.isArray(page.items) ? page.items : [];
      for (const [i, raw] of items.entries()) {
        const item = raw as ItemLike;
        scanSources(item.sources, `${at}.items[${i}]`, itemLabel(`${page.type}[${i}]`, item));
      }
    }
    if (page.type === "markets") {
      scanSources(page.sources, at, "markets page");
    }
  }
}

interface EvidenceLike {
  source_index?: unknown;
  quote?: unknown;
}

/**
 * The quote-containment half of check 2, applied wherever an `evidence`
 * block exists: `source_index` is an integer inside `sources`, `quote` is a
 * non-empty verbatim substring of that source's `excerpt`.
 */
function checkEvidenceBlock(
  evidence: EvidenceLike | undefined,
  sources: readonly EditionSource[],
  path: string,
  label: string,
  issues: VerifyIssue[],
): void {
  if (evidence === undefined) return;
  const at = `${path}.evidence`;
  const idx = evidence.source_index;
  if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= sources.length) {
    issues.push({
      check: "evidence",
      path: `${at}.source_index`,
      message: `${label} evidence.source_index ${String(idx)} out of range (${sources.length} sources)`,
    });
    return;
  }
  const quote = evidence.quote;
  const excerpt = sources[idx]?.excerpt;
  if (typeof quote !== "string" || quote === "") {
    issues.push({
      check: "evidence",
      path: `${at}.quote`,
      message: `${label} evidence.quote is empty`,
    });
    return;
  }
  if (typeof excerpt !== "string" || !excerpt.includes(quote)) {
    issues.push({
      check: "evidence",
      path: `${at}.quote`,
      message: `${label} evidence.quote is not a verbatim substring of sources[${idx}].excerpt`,
    });
  }
}

/**
 * Check 2 — every number on Money/Deals/Performance/Markets carries
 * `evidence` whose `quote` is a verbatim substring of the referenced
 * source's stored `excerpt`.
 */
function checkEvidence(pages: PageLike[], issues: VerifyIssue[]): void {
  for (const [p, page] of pages.entries()) {
    const at = `pages.${page.type ?? p}`;
    const items = Array.isArray(page.items) ? page.items : [];
    for (const [i, raw] of items.entries()) {
      const item = raw as ItemLike;
      const path = `${at}.items[${i}]`;
      const label = itemLabel(`${page.type}[${i}]`, item);
      const sources = Array.isArray(item.sources)
        ? (item.sources as EditionSource[])
        : [];
      const evidence = item.evidence as EvidenceLike | undefined;
      const required =
        (typeof page.type === "string" && EVIDENCE_ALWAYS_PAGES.has(page.type)) ||
        (page.type === "deals" && (item.amount !== undefined || item.number !== undefined));
      if (required && evidence === undefined) {
        issues.push({
          check: "evidence",
          path: `${path}.evidence`,
          message: `${label} carries a numeric claim but no evidence {source_index, quote}`,
        });
        continue;
      }
      checkEvidenceBlock(evidence, sources, path, label, issues);
    }
    if (page.type === "markets") {
      const pageSources = Array.isArray(page.sources)
        ? (page.sources as EditionSource[])
        : [];
      const tickers = Array.isArray(page.tickers) ? page.tickers : [];
      for (const [t, raw] of tickers.entries()) {
        const ticker = raw as { ticker?: unknown; evidence?: unknown };
        const name = typeof ticker.ticker === "string" ? ticker.ticker : `#${t}`;
        const path = `${at}.tickers[${t}]`;
        const evidence = ticker.evidence as EvidenceLike | undefined;
        if (evidence === undefined) {
          issues.push({
            check: "evidence",
            path: `${path}.evidence`,
            message: `markets ticker ${name} has close/change_pct but no evidence {source_index, quote}`,
          });
          continue;
        }
        checkEvidenceBlock(evidence, pageSources, path, `markets ticker ${name}`, issues);
      }
    }
  }
}

/**
 * Check 3 — every company tag resolves to a slug in `config/companies.yaml`.
 */
function checkCompanies(
  pages: PageLike[],
  companies: readonly CompanyEntry[],
  issues: VerifyIssue[],
): void {
  const registry = new Set(companies.map((c) => c.slug));
  const scan = (tags: unknown, path: string, label: string): void => {
    if (!Array.isArray(tags)) return;
    for (const [c, tag] of tags.entries()) {
      if (typeof tag !== "string" || !registry.has(tag)) {
        issues.push({
          check: "companies",
          path: `${path}.companies[${c}]`,
          message: `${label} company tag ${JSON.stringify(tag)} is not a slug in config/companies.yaml`,
        });
      }
    }
  };

  for (const [p, page] of pages.entries()) {
    const at = `pages.${page.type ?? p}`;
    const items = Array.isArray(page.items) ? page.items : [];
    for (const [i, raw] of items.entries()) {
      const item = raw as ItemLike;
      scan(item.companies, `${at}.items[${i}]`, itemLabel(`${page.type}[${i}]`, item));
    }
    if (page.type === "most_covered") {
      const entries = Array.isArray(page.entries) ? page.entries : [];
      for (const [i, raw] of entries.entries()) {
        const entry = raw as { company?: unknown };
        if (typeof entry.company !== "string" || !registry.has(entry.company)) {
          issues.push({
            check: "companies",
            path: `${at}.entries[${i}].company`,
            message: `most_covered company ${JSON.stringify(entry.company)} is not a slug in config/companies.yaml`,
          });
        }
      }
    }
  }
}

/**
 * Check 4 — every discourse item has ≥ 2 sources from ≥ 2 distinct
 * publishers.
 */
function checkDiscourse(pages: PageLike[], issues: VerifyIssue[]): void {
  for (const page of pages) {
    if (page.type !== "discourse") continue;
    const items = Array.isArray(page.items) ? page.items : [];
    for (const [i, raw] of items.entries()) {
      const item = raw as ItemLike & EditionItemDiscourse;
      const label = itemLabel(`discourse[${i}]`, item);
      const sources = Array.isArray(item.sources)
        ? (item.sources as EditionSource[])
        : [];
      const publishers = new Set(sources.map((s) => s.publisher));
      if (sources.length < 2) {
        issues.push({
          check: "discourse",
          path: `pages.discourse.items[${i}].sources`,
          message: `${label} has ${sources.length} source(s); discourse requires ≥ 2`,
        });
      }
      if (publishers.size < 2) {
        issues.push({
          check: "discourse",
          path: `pages.discourse.items[${i}].sources`,
          message: `${label} spans ${publishers.size} publisher(s); discourse requires ≥ 2 distinct`,
        });
      }
    }
  }
}

export const CHECK_NAMES: Record<VerifyCheckId, string> = {
  sources: "every item carries sources[] {url, publisher, published_at, fetched_at, adapter}",
  evidence: "every number on money/deals/performance/markets carries evidence {source_index, quote} verbatim in the stored excerpt",
  companies: "every company tag resolves to a config/companies.yaml slug",
  discourse: "every discourse item spans ≥ 2 sources from ≥ 2 distinct publishers",
  briefing: "every briefing sentence is attributed and supported by ≥ 1 item (entailment via the llm() seam)",
};

function makeReport(
  results: Array<{ id: VerifyCheckId; issues: VerifyIssue[]; note?: string }>,
): VerifyReport {
  const checks: VerifyCheckResult[] = VERIFY_CHECKS.map((id) => {
    const r = results.find((x) => x.id === id);
    const issues = r?.issues ?? [];
    return {
      id,
      name: CHECK_NAMES[id],
      status: r === undefined ? "skipped" : issues.length > 0 ? "fail" : "pass",
      errors: issues.map((i) => `${i.path} — ${i.message}`),
      ...(r?.note !== undefined ? { note: r.note } : {}),
    };
  });
  const issues = results.flatMap((r) => r.issues);
  return { ok: issues.length === 0, checks, issues };
}

/**
 * Checks 1–4, pure code — the half the CI gate re-runs on every committed
 * edition (`scripts/provenance-check.mts`). Accepts the parsed edition JSON
 * (typed `Edition` or a raw object the gate is auditing).
 */
export function verifyDeterministic(
  edition: Edition | Record<string, unknown>,
  companies: readonly CompanyEntry[],
): VerifyReport {
  const pages = (Array.isArray(edition.pages) ? edition.pages : []) as PageLike[];
  const sources: VerifyIssue[] = [];
  const evidence: VerifyIssue[] = [];
  const companiesIssues: VerifyIssue[] = [];
  const discourse: VerifyIssue[] = [];
  checkSources(pages, sources);
  checkEvidence(pages, evidence);
  checkCompanies(pages, companies, companiesIssues);
  checkDiscourse(pages, discourse);
  return makeReport([
    { id: "sources", issues: sources },
    { id: "evidence", issues: evidence },
    { id: "companies", issues: companiesIssues },
    { id: "discourse", issues: discourse },
  ]);
}

// ---------------------------------------------------------------------------
// Check 5 — briefing attribution + entailment through the llm() seam
// ---------------------------------------------------------------------------

/** Every item on an edition's item-bearing pages as a `VerifyItemRef` pool. */
export function verifyItemsFromEdition(
  edition: Edition | Record<string, unknown>,
): VerifyItemRef[] {
  const out: VerifyItemRef[] = [];
  const pages = (Array.isArray(edition.pages) ? edition.pages : []) as PageLike[];
  const projectSources = (
    sources: unknown,
  ): VerifySourceRef[] =>
    Array.isArray(sources)
      ? (sources as Array<Record<string, unknown>>).map(
          (s, source_index): VerifySourceRef => ({
            source_index,
            publisher: typeof s.publisher === "string" ? s.publisher : "",
            excerpt: typeof s.excerpt === "string" ? s.excerpt : "",
          }),
        )
      : [];

  for (const page of pages) {
    if (page.type === "markets") {
      // The dataset page has no items[] — its tickers are the supportable
      // units, keyed into the page-level sources (a briefing sentence about a
      // market move traces here, not to a card item).
      const pageSources = projectSources(page.sources);
      const tickers = Array.isArray(page.tickers) ? page.tickers : [];
      for (const [t, raw] of tickers.entries()) {
        const ticker = raw as { ticker?: unknown; name?: unknown; close?: unknown; change_pct?: unknown };
        const name = typeof ticker.name === "string" ? ticker.name : "";
        out.push({
          id: `markets-${t}`,
          page: "markets",
          headline:
            typeof ticker.ticker === "string"
              ? `${ticker.ticker}${name !== "" ? ` (${name})` : ""} ${String(ticker.close)} ${String(ticker.change_pct)}%`
              : `markets ticker ${t}`,
          one_liner: "",
          sources: pageSources,
        });
      }
      continue;
    }
    if (typeof page.type !== "string" || !ITEM_PAGES.has(page.type)) continue;
    const items = Array.isArray(page.items) ? page.items : [];
    for (const [i, raw] of items.entries()) {
      const item = raw as { headline?: unknown; one_liner?: unknown; sources?: unknown };
      out.push({
        id: `${page.type}-${i}`,
        page: page.type,
        headline: typeof item.headline === "string" ? item.headline : "",
        one_liner: typeof item.one_liner === "string" ? item.one_liner : "",
        sources: projectSources(item.sources),
      });
    }
  }
  return out;
}

/** The briefing page's sentences (empty when the page is absent). */
export function briefingSentences(
  edition: Edition | Record<string, unknown>,
): string[] {
  const pages = (Array.isArray(edition.pages) ? edition.pages : []) as PageLike[];
  const briefing = pages.find((p) => p.type === "briefing") as
    | { sentences?: unknown }
    | undefined;
  return Array.isArray(briefing?.sentences)
    ? (briefing!.sentences as string[])
    : [];
}

/**
 * Build the `verify.request.json` the seam consumes: briefing sentences +
 * P6's attribution + the item pool. `edition.id` is the request's `week`.
 */
export function buildVerifyRequest(
  edition: Edition | Record<string, unknown>,
  attribution: VerifyAttribution,
  opts?: { promptVersion?: number },
): VerifyRequest {
  const supports: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(attribution.supports)) {
    supports[String(k)] = [...v];
  }
  return {
    week: typeof edition.id === "string" ? edition.id : "",
    prompt_version: opts?.promptVersion ?? VERIFY_PROMPT_VERSION,
    sentences: briefingSentences(edition),
    supports,
    items: attribution.items,
  };
}

/**
 * The mechanical half of check 5: every briefing sentence index appears in
 * `supports` with ≥ 1 id that resolves to the item pool. No model call.
 */
export function checkBriefingAttribution(
  request: VerifyRequest,
  issues: VerifyIssue[],
): void {
  const itemIds = new Set(request.items.map((i) => i.id));
  for (const [s] of request.sentences.entries()) {
    const path = `briefing.sentences[${s}]`;
    const ids = request.supports[String(s)] ?? request.supports[s];
    if (!Array.isArray(ids) || ids.length === 0) {
      issues.push({
        check: "briefing",
        path,
        message: `sentence ${s} carries no supports attribution`,
      });
      continue;
    }
    for (const id of ids) {
      if (!itemIds.has(id)) {
        issues.push({
          check: "briefing",
          path,
          message: `sentence ${s} attributes item "${id}" which is not an edition item`,
        });
      }
    }
  }
}

/** Error type for response-contract violations — like DraftContractError. */
export class VerifyContractError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`verify.response.json violates the contract:\n  - ${issues.join("\n  - ")}`);
    this.name = "VerifyContractError";
    this.issues = issues;
  }
}

/**
 * Contract-check a `verify.response.json` against its request: exactly one
 * verdict per sentence index, every cited item id resolvable, `supported`
 * verdicts carry ≥ 1 item. Throws `VerifyContractError`.
 */
export function assertVerifyResponse(
  request: VerifyRequest,
  response: unknown,
): asserts response is VerifyResponse {
  const issues: string[] = [];
  if (!isObject(response)) throw new VerifyContractError(["response must be an object"]);
  if (response.prompt_version !== request.prompt_version) {
    issues.push(
      `prompt_version ${JSON.stringify(response.prompt_version)} does not match request ${request.prompt_version}`,
    );
  }
  if (!Array.isArray(response.verdicts)) {
    throw new VerifyContractError(['"verdicts" must be an array']);
  }
  const itemIds = new Set(request.items.map((i) => i.id));
  const seen = new Set<number>();
  for (const [v, raw] of response.verdicts.entries()) {
    const at = `verdicts[${v}]`;
    if (!isObject(raw)) {
      issues.push(`${at} must be an object`);
      continue;
    }
    const idx = raw.sentence_index;
    if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0 || idx >= request.sentences.length) {
      issues.push(`${at}.sentence_index ${JSON.stringify(idx)} out of range (${request.sentences.length} sentences)`);
      continue;
    }
    if (seen.has(idx)) issues.push(`${at}.sentence_index ${idx} is duplicated`);
    seen.add(idx);
    if (typeof raw.supported !== "boolean") issues.push(`${at}.supported must be a boolean`);
    const cited = raw.item_ids;
    if (!Array.isArray(cited)) {
      issues.push(`${at}.item_ids must be an array`);
      continue;
    }
    for (const id of cited) {
      if (typeof id !== "string" || !itemIds.has(id)) {
        issues.push(`${at}.item_ids cites "${String(id)}" which is not a request item`);
      }
    }
    if (raw.supported === true && cited.length === 0) {
      issues.push(`${at} is supported but cites no items`);
    }
  }
  for (const [s] of request.sentences.entries()) {
    if (!seen.has(s)) issues.push(`sentence ${s} has no verdict`);
  }
  if (issues.length > 0) throw new VerifyContractError(issues);
}

/**
 * Substitute the `{{…}}` placeholders in the versioned prompt template —
 * same convention as `renderDraftPrompt`.
 */
export function renderVerifyPrompt(template: string, request: VerifyRequest): string {
  const vars: Record<string, string> = {
    WEEK_ID: request.week,
    PROMPT_VERSION: String(request.prompt_version),
    SENTENCES_JSON: JSON.stringify(request.sentences, null, 2),
    SUPPORTS_JSON: JSON.stringify(request.supports, null, 2),
    ITEMS_JSON: JSON.stringify(request.items, null, 2),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

export interface VerifyOptions {
  /** `config/companies.yaml` entries — check 3's registry. */
  companies: readonly CompanyEntry[];
  /**
   * P6's sentence→item attribution. When omitted, the briefing check is
   * reported `skipped` (the CI gate replays the recorded judgement instead —
   * see `scripts/provenance-check.mts`).
   */
  attribution?: VerifyAttribution;
  /**
   * The `llm()` seam implementation — `createSessionVerifier` in a build,
   * `createReplayVerifier` in tests/replay. Only consulted when
   * `attribution` is also given; a response that fails the contract throws.
   */
  llm?: { verify(request: VerifyRequest): Promise<VerifyResponse> };
  /** Prompt contract version. `VERIFY_PROMPT_VERSION` when omitted. */
  promptVersion?: number;
}

/**
 * The `verify` stage: deterministic §5.3 checks 1–4 on the candidate edition
 * plus, when P6's attribution is supplied, the briefing check — attribution
 * integrity in code, entailment through the `llm()` seam. Returns the report
 * (never throws for rule violations — `report.ok` is the gate); a malformed
 * seam response throws `VerifyContractError`.
 */
export async function verifyEdition(
  edition: Edition | Record<string, unknown>,
  opts: VerifyOptions,
): Promise<VerifyReport> {
  const report = verifyDeterministic(edition, opts.companies);
  const briefing: VerifyIssue[] = [];
  let note: string | undefined;

  if (opts.attribution === undefined) {
    note =
      "no attribution supplied — replay the recorded verify.response.json to enforce entailment";
  } else {
    const request = buildVerifyRequest(edition, opts.attribution, {
      ...(opts.promptVersion !== undefined
        ? { promptVersion: opts.promptVersion }
        : {}),
    });
    checkBriefingAttribution(request, briefing);
    if (opts.llm === undefined) {
      note = "attribution checked; entailment skipped (no llm supplied)";
    } else {
      const response = await opts.llm.verify(request);
      assertVerifyResponse(request, response);
      for (const verdict of response.verdicts) {
        if (!verdict.supported) {
          briefing.push({
            check: "briefing",
            path: `briefing.sentences[${verdict.sentence_index}]`,
            message:
              `sentence ${verdict.sentence_index} is supported by no item` +
              (verdict.reason !== undefined ? ` — ${verdict.reason}` : ""),
          });
        }
      }
    }
  }

  const issues = [...report.issues, ...briefing];
  const checks = report.checks.map((c) =>
    c.id === "briefing"
      ? {
          ...c,
          status: (briefing.length > 0
            ? "fail"
            : note !== undefined
              ? "skipped"
              : "pass") as VerifyCheckStatus,
          errors: briefing.map((i) => `${i.path} — ${i.message}`),
          ...(note !== undefined ? { note } : {}),
        }
      : c,
  );
  return { ok: issues.length === 0, checks, issues };
}
