/**
 * C5 — typed loaders for `config/` (sources.yaml, companies.yaml,
 * markets.json). These files make sources *data, not code* (PLAN §5.1):
 * `A`-items add entries, never reshape the schema.
 *
 * Schema documentation lives at the top of each config file; the parsers
 * here enforce it so a malformed entry fails loudly at load, not mid-run.
 */

import { readFileSync } from "node:fs";

import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// config/sources.yaml
// ---------------------------------------------------------------------------

/** Template page ids a source may feed (PLAN §3). */
export const PAGE_IDS = [
  "cover",
  "briefing",
  "models",
  "performance",
  "launches",
  "funding",
  "deals",
  "markets",
  "discourse",
  "most_covered",
  "back_page",
] as const;

export type PageId = (typeof PAGE_IDS)[number];

/** `primary` = required by the page; `secondary` = corroboration only. */
export type SourceTier = "primary" | "secondary";

/** `data` = store extracted values; `link` = headline+link only (ToS-doubtful). */
export type SourceMode = "data" | "link";

/** One entry in `config/sources.yaml`. See the file header for field docs. */
export interface SourceEntry {
  /** Unique slug, e.g. "openai-news". */
  id: string;
  /** Template pages this source feeds. */
  pages: PageId[];
  tier: SourceTier;
  /** Adapter implementation id (`src/sources/<adapter>.ts`). */
  adapter: string;
  /** Endpoint/feed URL the adapter hits. */
  endpoint: string;
  /** Transport hint: rss | atom | json-api | graphql | csv | sitemap | html-index. */
  kind: string;
  /** Licence/ToS note: terms posture, what we store, access constraints. */
  license: string;
  /** Rate-limit note, e.g. "≤10 req/s" or "1 req/5s courtesy". */
  rate_limit: string;
  /** Whether the ingest run may use this source. */
  enabled: boolean;
  /** data | link — whether extracted values or only the link are stored. */
  mode?: SourceMode;
  /**
   * Adapter-specific config (repo lists, orgs, subreddits, filter terms).
   * Conventions: `meta.publisher` = curated display name stamped on
   * `RawItem.publisher`; `meta.weight` = non-negative rank-stage publisher
   * weight (P2, default 1.0).
   */
  meta?: Record<string, unknown>;
}

export class ConfigValidationError extends Error {
  constructor(file: string, issues: string[]) {
    super(`${file}: ${issues.join("; ")}`);
    this.name = "ConfigValidationError";
  }
}

const PAGE_ID_SET = new Set<string>(PAGE_IDS);

/** Parse + validate `config/sources.yaml` content. */
export function parseSourcesConfig(text: string): SourceEntry[] {
  const doc = parseYaml(text) as { sources?: unknown };
  const issues: string[] = [];
  if (!Array.isArray(doc?.sources)) {
    throw new ConfigValidationError("sources.yaml", ['"sources" must be a list']);
  }

  const seen = new Set<string>();
  for (const [i, s] of doc.sources.entries()) {
    const at = `sources[${i}]`;
    const e = s as Record<string, unknown> | null;
    if (typeof e !== "object" || e === null) {
      issues.push(`${at} must be a mapping`);
      continue;
    }
    if (typeof e.id !== "string" || e.id === "") issues.push(`${at}.id missing`);
    else if (seen.has(e.id)) issues.push(`${at}.id "${e.id}" is duplicated`);
    else seen.add(e.id);
    if (!Array.isArray(e.pages) || e.pages.length === 0) {
      issues.push(`${at}.pages must be a non-empty list`);
    } else {
      for (const p of e.pages) {
        if (!PAGE_ID_SET.has(p as string)) issues.push(`${at}.pages has unknown page "${String(p)}"`);
      }
    }
    if (e.tier !== "primary" && e.tier !== "secondary") {
      issues.push(`${at}.tier must be primary|secondary`);
    }
    if (typeof e.adapter !== "string" || e.adapter === "") issues.push(`${at}.adapter missing`);
    if (typeof e.endpoint !== "string" || !/^https?:\/\//.test(e.endpoint)) {
      issues.push(`${at}.endpoint must be an http(s) URL`);
    }
    if (typeof e.kind !== "string" || e.kind === "") issues.push(`${at}.kind missing`);
    if (typeof e.license !== "string" || e.license.trim() === "") {
      issues.push(`${at}.license note missing (§5.1 requires one per source)`);
    }
    if (typeof e.rate_limit !== "string" || e.rate_limit.trim() === "") {
      issues.push(`${at}.rate_limit note missing`);
    }
    if (typeof e.enabled !== "boolean") issues.push(`${at}.enabled must be a boolean`);
    if (e.mode !== undefined && e.mode !== "data" && e.mode !== "link") {
      issues.push(`${at}.mode must be data|link`);
    }
    if (e.meta !== undefined) {
      if (typeof e.meta !== "object" || e.meta === null || Array.isArray(e.meta)) {
        issues.push(`${at}.meta must be a mapping`);
      } else {
        const w = (e.meta as Record<string, unknown>).weight;
        if (w !== undefined && (typeof w !== "number" || !Number.isFinite(w) || w < 0)) {
          issues.push(`${at}.meta.weight must be a non-negative number`);
        }
      }
    }
  }
  if (issues.length > 0) throw new ConfigValidationError("sources.yaml", issues);
  return doc.sources as SourceEntry[];
}

/** Load `config/sources.yaml` from a path (Node-only; adapters run in Node). */
export function loadSourcesConfig(path: string): SourceEntry[] {
  return parseSourcesConfig(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// config/companies.yaml
// ---------------------------------------------------------------------------

/** One company in the registry — slugs are what company tags carry (§5.3). */
export interface CompanyEntry {
  slug: string;
  name: string;
  aliases: string[];
  domain?: string;
  ticker?: string;
}

/** Parse + validate `config/companies.yaml` content. */
export function parseCompaniesConfig(text: string): CompanyEntry[] {
  const doc = parseYaml(text) as { companies?: unknown };
  const issues: string[] = [];
  if (!Array.isArray(doc?.companies)) {
    throw new ConfigValidationError("companies.yaml", ['"companies" must be a list']);
  }
  const seen = new Set<string>();
  for (const [i, c] of doc.companies.entries()) {
    const at = `companies[${i}]`;
    const e = c as Record<string, unknown> | null;
    if (typeof e !== "object" || e === null) {
      issues.push(`${at} must be a mapping`);
      continue;
    }
    if (typeof e.slug !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(e.slug)) {
      issues.push(`${at}.slug must be a lowercase slug`);
    } else if (seen.has(e.slug)) {
      issues.push(`${at}.slug "${e.slug}" is duplicated`);
    } else {
      seen.add(e.slug);
    }
    if (typeof e.name !== "string" || e.name === "") issues.push(`${at}.name missing`);
    if (e.aliases !== undefined && !Array.isArray(e.aliases)) {
      issues.push(`${at}.aliases must be a list`);
    }
    if (e.ticker !== undefined && (typeof e.ticker !== "string" || !/^[A-Z0-9.]+$/.test(e.ticker))) {
      issues.push(`${at}.ticker must be uppercase`);
    }
  }
  if (issues.length > 0) throw new ConfigValidationError("companies.yaml", issues);
  return (doc.companies as Array<Record<string, unknown>>).map((e) => ({
    slug: e.slug as string,
    name: e.name as string,
    aliases: (e.aliases as string[] | undefined) ?? [],
    ...(e.domain !== undefined ? { domain: e.domain as string } : {}),
    ...(e.ticker !== undefined ? { ticker: e.ticker as string } : {}),
  }));
}

/** Load `config/companies.yaml` from a path. */
export function loadCompaniesConfig(path: string): CompanyEntry[] {
  return parseCompaniesConfig(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// config/publishers.yaml
// ---------------------------------------------------------------------------

/**
 * `config/publishers.yaml` — the L1 attribution map. `domains` maps a URL
 * host (with subdomain matching) to the origin publisher display name;
 * `aggregators` lists recorded publisher names treated as aggregators, not
 * origins. `normalize` rewrites `publisher`/`via` from these.
 */
export interface PublishersConfig {
  domains: Record<string, string>;
  aggregators: string[];
}

/** Parse + validate `config/publishers.yaml` content. */
export function parsePublishersConfig(text: string): PublishersConfig {
  const doc = parseYaml(text) as { domains?: unknown; aggregators?: unknown };
  const issues: string[] = [];
  const domains: Record<string, string> = {};
  if (typeof doc?.domains !== "object" || doc.domains === null || Array.isArray(doc.domains)) {
    issues.push('"domains" must be a mapping of host → publisher name');
  } else {
    for (const [domain, publisher] of Object.entries(doc.domains)) {
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
        issues.push(`domains key "${domain}" is not a hostname`);
      }
      if (typeof publisher !== "string" || publisher.trim() === "") {
        issues.push(`domains."${domain}" must be a non-empty name`);
      } else {
        domains[domain] = publisher;
      }
    }
  }
  const aggregators: string[] = [];
  if (!Array.isArray(doc?.aggregators) || doc.aggregators.length === 0) {
    issues.push('"aggregators" must be a non-empty list of publisher names');
  } else {
    for (const [i, a] of doc.aggregators.entries()) {
      if (typeof a !== "string" || a.trim() === "") {
        issues.push(`aggregators[${i}] must be a non-empty name`);
      } else {
        aggregators.push(a);
      }
    }
  }
  if (issues.length > 0) throw new ConfigValidationError("publishers.yaml", issues);
  return { domains, aggregators };
}

/** Load `config/publishers.yaml` from a path. */
export function loadPublishersConfig(path: string): PublishersConfig {
  return parsePublishersConfig(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// config/markets.json
// ---------------------------------------------------------------------------

/** One ticker in the fixed Markets basket. */
export interface MarketTicker {
  ticker: string;
  name: string;
  /** `core` = §3 fixed list; `pure-play` = C5 pick (justified by `rationale`). */
  role: "core" | "pure-play";
  rationale?: string;
}

export interface MarketsConfig {
  basket: MarketTicker[];
  /** Active provider id (must match a `markets`-adapter entry in sources.yaml). */
  provider: string;
  /** Fallback order when the active provider fails (PLAN §5.1 priority list). */
  provider_priority: string[];
}

/** Parse + validate `config/markets.json` content. */
export function parseMarketsConfig(text: string): MarketsConfig {
  const doc = JSON.parse(text) as Record<string, unknown>;
  const issues: string[] = [];
  if (!Array.isArray(doc.basket) || doc.basket.length === 0) {
    issues.push('"basket" must be a non-empty list');
  } else {
    const seen = new Set<string>();
    for (const [i, t] of doc.basket.entries()) {
      const at = `basket[${i}]`;
      const e = t as Record<string, unknown> | null;
      if (typeof e !== "object" || e === null) {
        issues.push(`${at} must be an object`);
        continue;
      }
      if (typeof e.ticker !== "string" || !/^[A-Z0-9.]+$/.test(e.ticker)) {
        issues.push(`${at}.ticker must be uppercase`);
      } else if (seen.has(e.ticker)) {
        issues.push(`${at}.ticker "${e.ticker}" is duplicated`);
      } else {
        seen.add(e.ticker);
      }
      if (e.role !== "core" && e.role !== "pure-play") {
        issues.push(`${at}.role must be core|pure-play`);
      }
      if (e.role === "pure-play" && (typeof e.rationale !== "string" || e.rationale === "")) {
        issues.push(`${at} pure-play pick needs a rationale`);
      }
    }
  }
  if (typeof doc.provider !== "string" || doc.provider === "") issues.push('"provider" missing');
  if (!Array.isArray(doc.provider_priority) || doc.provider_priority.length === 0) {
    issues.push('"provider_priority" must be a non-empty list');
  }
  if (issues.length > 0) throw new ConfigValidationError("markets.json", issues);
  return doc as unknown as MarketsConfig;
}

/** Load `config/markets.json` from a path. */
export function loadMarketsConfig(path: string): MarketsConfig {
  return parseMarketsConfig(readFileSync(path, "utf8"));
}
