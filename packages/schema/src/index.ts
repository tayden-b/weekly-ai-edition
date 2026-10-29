/**
 * @weekly/schema — the edition contract.
 *
 * `edition.schema.json` is the source of truth; `edition.types.ts` is
 * generated from it (`pnpm schema:types`, sync checked by a test);
 * `validateEdition` is the deterministic validator behind
 * `pnpm schema:validate`.
 */

/** ISO-8601-ish week id used for routes, file names, and edition ids: `2026-w44`. */
export type EditionWeekId = `${number}-w${number}`;

const WEEK_ID_RE = /^(\d{4})-w(\d{2})$/;

export function isEditionWeekId(value: string): value is EditionWeekId {
  const match = WEEK_ID_RE.exec(value);
  if (!match) return false;
  const week = Number(match[2]);
  return week >= 1 && week <= 53;
}

/** Version marker for the edition schema. Bump when the contract changes. */
export const EDITION_SCHEMA_VERSION = 1;

export type {
  Edition,
  EditionAgentLinks,
  EditionBackPage,
  EditionBriefingPage,
  EditionChartPoint,
  EditionCoverPage,
  EditionDealsPage,
  EditionDiscoursePage,
  EditionEvidence,
  EditionFundingPage,
  EditionItem,
  EditionItemDeal,
  EditionItemDiscourse,
  EditionItemFunding,
  EditionItemNumbered,
  EditionLaunchesPage,
  EditionMarketsChart,
  EditionMarketsPage,
  EditionModelsPage,
  EditionMostCoveredEntry,
  EditionMostCoveredPage,
  EditionPerformancePage,
  EditionSource,
  EditionSourceCount,
  EditionTicker,
  Slug,
} from "./edition.types";

import type { Edition } from "./edition.types";

/** Union of the 11 page types, in fixed template order. */
export type EditionPage = Edition["pages"][number];

export { assertEdition, validateEdition } from "./validate";
export type { EditionValidationResult } from "./validate";

export {
  AGGREGATOR_HOSTS,
  discussionUrl,
  isAggregatorUrl,
  primarySource,
} from "./links";
