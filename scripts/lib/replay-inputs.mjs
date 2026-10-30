/**
 * i162 — the replay-mode input set. A replay reproduces an emission from
 * exactly the inputs its `provenance.json` recorded (the `cache_hashes`
 * map): post-emission cache days/files on disk are ignored, and every
 * recorded path must still hash to its recorded sha256.
 */

const RAW_FILE_RE = /^data\/raw\/([^/]+)\/([^/]+\.json)$/;

/**
 * Partition recorded `cache_hashes` keys into:
 *   days       ingest days whose manifest is pinned (pool membership)
 *   filesByDay day → sorted repo-relative source files (manifest excluded)
 *   fixture    the recorded pool file (fixtures/<week>/edition.json) or null
 *   unknown    recorded paths that are neither cache files nor the fixture —
 *              a second non-cache input can't be replayed, so the caller
 *              fails loudly rather than silently dropping it
 */
export function partitionRecordedInputs(cacheHashes) {
  const days = [];
  const filesByDay = new Map();
  let fixture = null;
  const unknown = [];
  for (const rel of Object.keys(cacheHashes).sort()) {
    const m = RAW_FILE_RE.exec(rel);
    if (m !== null) {
      const [, day, file] = m;
      if (file === "manifest.json") {
        days.push(day);
      } else {
        const list = filesByDay.get(day) ?? [];
        list.push(rel);
        filesByDay.set(day, list);
      }
    } else if (fixture === null) {
      fixture = rel;
    } else {
      unknown.push(rel);
    }
  }
  return { days, filesByDay, fixture, unknown };
}

/**
 * Verify every recorded input still exists and hashes to its recorded
 * sha256. Returns the violation lines ([] = inputs intact).
 * `exists(rel)` / `sha256(rel)` take repo-relative paths and are injected so
 * the check stays fs-free and unit-testable.
 */
export function driftedRecordedInputs(cacheHashes, { exists, sha256 }) {
  const problems = [];
  for (const [rel, want] of Object.entries(cacheHashes)) {
    if (!exists(rel)) {
      problems.push(`${rel} — recorded input missing`);
      continue;
    }
    const got = sha256(rel);
    if (got !== want) problems.push(`${rel} — sha256 drifted (${got} ≠ ${want})`);
  }
  return problems;
}
