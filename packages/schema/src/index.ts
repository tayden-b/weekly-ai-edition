/**
 * @weekly/schema — the edition contract.
 *
 * C2 lands `edition.schema.json`, the generated TS types, and the validator.
 * Until then this module carries the week-id helpers every other package
 * already needs, so interfaces do not drift.
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
export const EDITION_SCHEMA_VERSION = 0;
