/**
 * `validateEdition` — the deterministic gate behind `pnpm schema:validate`.
 *
 * Two passes:
 * 1. ajv against edition.schema.json (shape, fixed page order, per-page caps,
 *    required sources/evidence, formats).
 * 2. Semantic checks the JSON Schema can't express: evidence.source_index
 *    bounds and quote-in-excerpt containment (PLAN §5.3), date range order.
 *
 * Boundaries (deliberately NOT here): company-slug membership in
 * config/companies.yaml and ≥2-distinct-publishers on discourse are
 * verify-stage (P7) rules; briefing-sentence entailment is an LLM-judge rule.
 */
import Ajv from "ajv";
import addFormats from "ajv-formats";

import editionSchema from "../edition.schema.json";
import type { Edition } from "./edition.types.js";

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const schemaValidate = ajv.compile(editionSchema);

export interface EditionValidationResult {
  ok: boolean;
  errors: string[];
}

interface EvidenceLike {
  source_index?: unknown;
  quote?: unknown;
}

interface SourceLike {
  excerpt?: unknown;
}

function semanticErrors(edition: Record<string, unknown>): string[] {
  const errors: string[] = [];

  const dateStart = edition["date_start"];
  const dateEnd = edition["date_end"];
  if (
    typeof dateStart === "string" &&
    typeof dateEnd === "string" &&
    dateStart > dateEnd
  ) {
    errors.push(`/date_end: ${dateEnd} is before /date_start ${dateStart}`);
  }

  const checkEvidence = (
    evidence: EvidenceLike | undefined,
    sources: SourceLike[] | undefined,
    path: string,
  ) => {
    if (!evidence || !Array.isArray(sources)) return;
    const idx = evidence.source_index;
    if (typeof idx !== "number" || idx < 0 || idx >= sources.length) {
      errors.push(
        `${path}/evidence/source_index: ${String(idx)} out of range (${sources.length} sources)`,
      );
      return;
    }
    const excerpt = sources[idx]?.excerpt;
    if (
      typeof excerpt === "string" &&
      typeof evidence.quote === "string" &&
      !excerpt.includes(evidence.quote)
    ) {
      errors.push(
        `${path}/evidence/quote: not found verbatim in sources[${idx}].excerpt`,
      );
    }
  };

  const pages = edition["pages"];
  if (!Array.isArray(pages)) return errors;

  for (const [p, page] of pages.entries()) {
    const pg = page as Record<string, unknown>;
    const items = pg["items"];
    if (Array.isArray(items)) {
      for (const [i, item] of items.entries()) {
        const it = item as Record<string, unknown>;
        checkEvidence(
          it["evidence"] as EvidenceLike | undefined,
          it["sources"] as SourceLike[] | undefined,
          `/pages/${p}/items/${i}`,
        );
      }
    }
    if (pg["type"] === "markets") {
      const tickers = pg["tickers"];
      if (Array.isArray(tickers)) {
        for (const [t, ticker] of tickers.entries()) {
          checkEvidence(
            (ticker as Record<string, unknown>)["evidence"] as
              | EvidenceLike
              | undefined,
            pg["sources"] as SourceLike[] | undefined,
            `/pages/${p}/tickers/${t}`,
          );
        }
      }
    }
  }

  return errors;
}

export function validateEdition(json: unknown): EditionValidationResult {
  const errors: string[] = [];
  const schemaOk = schemaValidate(json);
  if (!schemaOk) {
    for (const err of schemaValidate.errors ?? []) {
      errors.push(`${err.instancePath || "/"}: ${err.message ?? "invalid"}`);
    }
  }
  if (json !== null && typeof json === "object" && !Array.isArray(json)) {
    errors.push(...semanticErrors(json as Record<string, unknown>));
  }
  return { ok: errors.length === 0, errors };
}

export function assertEdition(json: unknown): asserts json is Edition {
  const result = validateEdition(json);
  if (!result.ok) {
    throw new Error(`Invalid edition:\n  - ${result.errors.join("\n  - ")}`);
  }
}
