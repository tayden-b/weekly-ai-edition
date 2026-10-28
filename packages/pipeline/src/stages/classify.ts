/**
 * P4 — `classify` stage (PLAN.md §5.2): `ItemCluster[]` → `ClassifiedCluster[]`.
 *
 * Fourth stage in `PIPELINE_STAGES` (after dedupe). The stage itself is a
 * deterministic shell: it builds a `ClassificationRequest` from the clusters,
 * hands it to the `llm()` seam (see `../llm.ts` — the running Devin session
 * performs the judgement, or a recorded response replays it), then
 * post-processes the response through the §5.3 / STYLE §8 rules in code:
 *
 *   - `confidence < 0.7` → `unsorted` (`CLASSIFY_CONFIDENCE_THRESHOLD`)
 *   - a label outside the taxonomy → `unsorted`
 *   - any company tag that does not resolve to a `config/companies.yaml`
 *     slug → `unsorted` (unknown companies are never minted)
 *
 * The input type is `ItemCluster`, so both pipeline orders typecheck:
 * `dedupe → classify → rank` (PLAN §5.2's written order) and
 * `dedupe → rank → classify` (the P4 brief's "ranked clusters"). The stage
 * makes no assumption about cluster ordering and preserves input order.
 *
 * ## What the model sees / returns
 *
 * The contract is `prompts/classify.prompt.md` (versioned — the response's
 * `prompt_version` must match `CLASSIFY_PROMPT_VERSION`). Each request item
 * carries the representative headline/publisher/url/date/excerpt plus
 * `source_count` + `publishers` (distinct-publisher rollup — the discourse
 * rule needs the cluster's corroboration, not one record's).
 *
 * ## Output
 *
 * Every cluster gets an `ItemClassification`: the effective `page`
 * (post-rules), the model's raw `confidence`, validated `company_slugs`
 * (registry slugs, sorted, deduped; aliases resolved to canonical slugs),
 * the model's `rationale` for audit, and `flags` recording every rule the
 * shell applied (`low-confidence`, `invalid-page:<raw>`,
 * `unknown-company:<raw>`, `company-alias:<raw>`). `unsorted` items never
 * reach an edition page — that is emit's filter; this stage just guarantees
 * the label is honest.
 */

import type { CompanyEntry } from "../config.js";
import { publisherKey } from "./normalize.js";
import type { ItemCluster } from "./dedupe.js";

// ---------------------------------------------------------------------------
// Taxonomy (STYLE.md §8 — the page types are the taxonomy)
// ---------------------------------------------------------------------------

/** The seven item-bearing pages — the only labels besides `unsorted`. */
export const CLASSIFY_PAGE_IDS = [
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "markets",
  "discourse",
] as const;

/** An item-bearing page. Derived pages (cover, briefing, …) are never labels. */
export type ItemPage = (typeof CLASSIFY_PAGE_IDS)[number];

/** The catch-all label — STYLE §8: everything else + anything < 0.7. */
export const UNSORTED = "unsorted";

export type ClassifyPage = ItemPage | typeof UNSORTED;

const CLASSIFY_PAGE_SET = new Set<string>(CLASSIFY_PAGE_IDS);

/** Confidence below this forces `unsorted` (STYLE §8, enforced here in code). */
export const CLASSIFY_CONFIDENCE_THRESHOLD = 0.7;

/**
 * The prompt contract version — must equal `prompt_version` in
 * `prompts/classify.prompt.md`'s frontmatter (a test enforces it) and the
 * `prompt_version` on every response the seam returns.
 */
export const CLASSIFY_PROMPT_VERSION = 1;

// ---------------------------------------------------------------------------
// Request / response shapes (the classification.{request,response}.json
// hand-off documented in prompts/classify.prompt.md)
// ---------------------------------------------------------------------------

/** One request item — a cluster flattened to what the model judges on. */
export interface ClassificationRequestItem {
  /** The cluster id (joins the response back — echoed verbatim). */
  id: string;
  headline: string;
  publisher: string;
  canonical_url: string;
  published_at: string;
  excerpt: string;
  /** Distinct publishers in the cluster (discourse corroboration signal). */
  source_count: number;
  /** Display names, one per distinct publisher, sorted. */
  publishers: string[];
}

/** A registry entry projected to what tagging needs. */
export interface ClassificationCompanyRef {
  slug: string;
  name: string;
  aliases: string[];
}

/** `classification.request.json` — the batch handed to the `llm()` seam. */
export interface ClassificationRequest {
  week: string;
  prompt_version: number;
  /** Git SHA of STYLE.md at request time (taxonomy audit). */
  style_rev: string;
  companies: ClassificationCompanyRef[];
  items: ClassificationRequestItem[];
}

/** One response entry — the model's judgement for one request item. */
export interface ClassifiedItem {
  /** Echo of the request item's `id`. */
  id: string;
  /** The emitted label — validated against the taxonomy by the shell. */
  page: string;
  /** Emitted confidence in [0, 1]; < 0.7 → `unsorted` (enforced here). */
  confidence: number;
  /** Company references — resolved against the registry, never minted. */
  company_slugs: string[];
  /** One clause, for audit only. */
  rationale?: string;
}

/** `classification.response.json` — the judgement the seam returns. */
export interface ClassificationResponse {
  prompt_version: number;
  items: ClassifiedItem[];
}

/** The audited result attached to every cluster. */
export interface ItemClassification {
  /** Effective page after the shell's rules — a valid label, always. */
  page: ClassifyPage;
  /** The model's emitted confidence (unchanged, even when < 0.7). */
  confidence: number;
  /** Validated registry slugs, sorted + deduped. */
  company_slugs: string[];
  /** The model's one-clause justification — audit only, never rendered. */
  rationale?: string;
  /** Every rule the shell applied to this item — the audit trail. */
  flags: string[];
}

/** A cluster with its classification slot — the type `emit` consumes. */
export type ClassifiedCluster<T extends ItemCluster = ItemCluster> = T & {
  classification: ItemClassification;
};

// ---------------------------------------------------------------------------
// Company resolution (slug, name, and alias → canonical slug)
// ---------------------------------------------------------------------------

/**
 * Comparison key for company references: lowercase, non-alphanumeric runs
 * collapse to `-`, edge dashes trimmed — `"Google"` → `google`,
 * `"Alibaba Qwen"` → `alibaba-qwen`, `"Thinking Machines Lab"` →
 * `thinking-machines-lab`.
 */
export function companyKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Key → canonical slug map over every entry's `slug`, `name`, and `aliases`.
 * First writer wins on collisions (registry order is stable, so resolution
 * is deterministic); the map is built once per `classify` call.
 */
export function buildCompanyResolver(
  companies: readonly CompanyEntry[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of companies) {
    for (const candidate of [c.slug, c.name, ...c.aliases]) {
      const key = companyKey(candidate);
      if (key !== "" && !map.has(key)) map.set(key, c.slug);
    }
  }
  return map;
}

/**
 * Resolve one emitted company reference to a registry slug — exact slug,
 * display name, or alias. `undefined` when nothing matches (the caller
 * treats that as an unknown company → `unsorted`, never minted).
 */
export function resolveCompanySlug(
  raw: string,
  resolver: ReadonlyMap<string, string>,
): string | undefined {
  return resolver.get(companyKey(raw));
}

// ---------------------------------------------------------------------------
// Request building
// ---------------------------------------------------------------------------

/**
 * Distinct publishers in a cluster, `publisherKey`-deduped — the same
 * corroboration signal `rank` uses. Returns the display names (sorted) and
 * the count the request calls `source_count`.
 */
export function clusterPublishers(cluster: ItemCluster): {
  names: string[];
  count: number;
} {
  const distinct = new Map<string, string>();
  for (const m of cluster.items) {
    const key = publisherKey(m.publisher);
    if (!distinct.has(key)) distinct.set(key, m.publisher);
  }
  const names = [...distinct.values()].sort();
  return { names, count: names.length };
}

/**
 * Flatten clusters into the `classification.request.json` shape the prompt
 * documents. Pure — `companies`, `week`, `style_rev` arrive via options.
 */
export function buildClassificationRequest(
  clusters: readonly ItemCluster[],
  opts: {
    companies: readonly CompanyEntry[];
    week?: string;
    styleRev?: string;
    promptVersion?: number;
  },
): ClassificationRequest {
  return {
    week: opts.week ?? "",
    prompt_version: opts.promptVersion ?? CLASSIFY_PROMPT_VERSION,
    style_rev: opts.styleRev ?? "unknown",
    companies: opts.companies.map((c) => ({
      slug: c.slug,
      name: c.name,
      aliases: [...c.aliases],
    })),
    items: clusters.map((cluster) => {
      const { names, count } = clusterPublishers(cluster);
      return {
        id: cluster.id,
        headline: cluster.item.headline,
        publisher: cluster.item.publisher,
        canonical_url: cluster.item.canonical_url,
        published_at: cluster.item.published_at,
        excerpt: cluster.item.excerpt,
        source_count: count,
        publishers: names,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering (the {{…}} placeholders in prompts/classify.prompt.md)
// ---------------------------------------------------------------------------

/**
 * Substitute the `{{…}}` placeholders in the versioned prompt template.
 * `{{COMPANIES_YAML}}` becomes a readable registry list (`- slug: Name
 * (aliases: a, b)`); `{{ITEMS_JSON}}` the pretty-printed request items.
 * Unknown placeholders are left untouched so template edits can't silently
 * drop context.
 */
export function renderClassifyPrompt(
  template: string,
  request: ClassificationRequest,
): string {
  const companiesList = request.companies
    .map(
      (c) =>
        `- ${c.slug}: ${c.name}` +
        (c.aliases.length > 0 ? ` (aliases: ${c.aliases.join(", ")})` : ""),
    )
    .join("\n");
  const vars: Record<string, string> = {
    WEEK_ID: request.week,
    STYLE_MD_GIT_SHA: request.style_rev,
    PROMPT_VERSION: String(request.prompt_version),
    COMPANIES_YAML: companiesList,
    ITEMS_JSON: JSON.stringify(request.items, null, 2),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

/**
 * A malformed `classification.response.json` — structural violations that
 * mean the whole batch is untrustworthy (wrong version, missing/extra/dupe
 * ids, malformed fields). Per-item semantic issues (unknown label, low
 * confidence, unknown company) do NOT throw — they degrade to `unsorted`.
 */
export class ClassificationContractError extends Error {
  constructor(readonly issues: string[]) {
    super(`invalid classification response: ${issues.join("; ")}`);
    this.name = "ClassificationContractError";
  }
}

/**
 * Enforce the response contract against the request: `prompt_version`
 * matches, every item is well-formed, and every request `id` appears exactly
 * once (no drops, no extras, no dupes). Throws `ClassificationContractError`.
 */
export function assertClassificationResponse(
  request: ClassificationRequest,
  response: unknown,
): asserts response is ClassificationResponse {
  const issues: string[] = [];
  const r = response as Record<string, unknown> | null;
  if (typeof r !== "object" || r === null) {
    throw new ClassificationContractError(["response must be an object"]);
  }
  if (r.prompt_version !== request.prompt_version) {
    issues.push(
      `prompt_version ${JSON.stringify(r.prompt_version)} does not match ` +
        `request ${request.prompt_version}`,
    );
  }
  if (!Array.isArray(r.items)) {
    throw new ClassificationContractError(['"items" must be an array']);
  }

  const want = new Map<string, number>();
  for (const item of request.items) want.set(item.id, (want.get(item.id) ?? 0) + 1);

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
    if (typeof it.page !== "string" || it.page.trim() === "") {
      issues.push(`${at} (${it.id}).page must be a non-empty string`);
    }
    if (typeof it.confidence !== "number" || !Number.isFinite(it.confidence)) {
      issues.push(`${at} (${it.id}).confidence must be a finite number`);
    }
    if (
      !Array.isArray(it.company_slugs) ||
      it.company_slugs.some((s) => typeof s !== "string" || s.trim() === "")
    ) {
      issues.push(`${at} (${it.id}).company_slugs must be an array of non-empty strings`);
    }
    if (it.rationale !== undefined && typeof it.rationale !== "string") {
      issues.push(`${at} (${it.id}).rationale must be a string when present`);
    }
  }

  for (const [id, count] of seen) {
    if (!want.has(id)) issues.push(`response has unknown id "${id}"`);
    else if (count > 1) issues.push(`response repeats id "${id}" ${count}×`);
  }
  for (const id of want.keys()) {
    if (!seen.has(id)) issues.push(`response is missing id "${id}"`);
  }

  if (issues.length > 0) throw new ClassificationContractError(issues);
}

// ---------------------------------------------------------------------------
// Post-processing — the shell's rules over the model's judgement
// ---------------------------------------------------------------------------

/**
 * Apply a validated response to the clusters it was built from. Pure —
 * takes `request`/`response` explicitly so the two-phase session hand-off
 * (emit request, fill response later) shares this code path with `classify`.
 * Output order = input order; every returned cluster carries `classification`.
 */
export function applyClassification<T extends ItemCluster>(
  clusters: readonly T[],
  request: ClassificationRequest,
  response: unknown,
  opts: { companies: readonly CompanyEntry[]; confidenceThreshold?: number },
): ClassifiedCluster<T>[] {
  assertClassificationResponse(request, response);
  const requestIds = new Set(request.items.map((i) => i.id));
  const missing = clusters.filter((c) => !requestIds.has(c.id));
  if (missing.length > 0) {
    throw new ClassificationContractError(
      missing.map((c) => `cluster "${c.id}" is not in the request`),
    );
  }

  const resolver = buildCompanyResolver(opts.companies);
  const threshold = opts.confidenceThreshold ?? CLASSIFY_CONFIDENCE_THRESHOLD;
  const byId = new Map(response.items.map((i) => [i.id, i]));

  return clusters.map((cluster) => {
    const item = byId.get(cluster.id)!;
    const flags: string[] = [];

    // Label must be in the taxonomy — a hallucinated label degrades this
    // item to unsorted, never the batch.
    const rawPage = item.page.trim().toLowerCase();
    let page: ClassifyPage;
    if (rawPage === UNSORTED || CLASSIFY_PAGE_SET.has(rawPage)) {
      page = rawPage as ClassifyPage;
    } else {
      page = UNSORTED;
      flags.push(`invalid-page:${item.page}`);
    }

    // STYLE §8: confidence < 0.7 → unsorted, always (even on a valid label).
    // Out-of-range confidence is treated as no-confidence.
    let confidence = item.confidence;
    if (confidence < 0 || confidence > 1) {
      flags.push(`invalid-confidence:${item.confidence}`);
      confidence = 0;
    }
    if (confidence < threshold) {
      page = UNSORTED;
      flags.push("low-confidence");
    }

    // §5.3: tags resolve to registry slugs (aliases map to canonical slugs);
    // any unresolvable tag sends the item to unsorted — never mint a slug.
    const slugs = new Set<string>();
    for (const raw of item.company_slugs) {
      const slug = resolveCompanySlug(raw, resolver);
      if (slug === undefined) {
        page = UNSORTED;
        flags.push(`unknown-company:${raw}`);
      } else {
        if (slug !== companyKey(raw)) flags.push(`company-alias:${raw}`);
        slugs.add(slug);
      }
    }

    return {
      ...cluster,
      classification: {
        page,
        confidence,
        company_slugs: [...slugs].sort(),
        ...(item.rationale !== undefined ? { rationale: item.rationale } : {}),
        flags,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// The stage
// ---------------------------------------------------------------------------

export interface ClassifyOptions {
  /** The `llm()` seam implementation — `session` in a build, `replay` in CI. */
  llm: { classify(request: ClassificationRequest): Promise<ClassificationResponse> };
  /** `config/companies.yaml` entries — the tag registry (never extended here). */
  companies: readonly CompanyEntry[];
  /** Edition week id stamped on the request (audit + prompt `{{WEEK_ID}}`). */
  week?: string;
  /** STYLE.md git SHA stamped on the request. `"unknown"` when omitted. */
  styleRev?: string;
  /** Prompt contract version. `CLASSIFY_PROMPT_VERSION` when omitted. */
  promptVersion?: number;
  /** `CLASSIFY_CONFIDENCE_THRESHOLD` when omitted. */
  confidenceThreshold?: number;
}

/**
 * The `classify` stage: clusters → the `llm()` seam → rule-checked
 * `ClassifiedCluster[]`, in input order. An empty batch short-circuits —
 * no judgement needed, no seam call, no request file.
 */
export async function classify<T extends ItemCluster>(
  clusters: readonly T[],
  opts: ClassifyOptions,
): Promise<ClassifiedCluster<T>[]> {
  if (clusters.length === 0) return [];
  const request = buildClassificationRequest(clusters, opts);
  const response = await opts.llm.classify(request);
  return applyClassification(clusters, request, response, opts);
}
