/**
 * The cover seed (T3): one sha256 over a canonical digest of the edition —
 * issue number plus a hash-friendly summary of the week's items and sector
 * mix. Same edition → same seed → byte-identical cover, forever (issue spec:
 * "deterministically seeds from edition data … Same input = identical
 * output, byte-stable").
 */
import { createHash } from "node:crypto";

type AnyPage = Record<string, unknown>;

/**
 * Canonical seed document. Field order is fixed by construction so
 * `JSON.stringify` is deterministic:
 *
 * - `issue`     — the edition's issue_number ("№ 1" → identity)
 * - `headlines` — every emitted item's headline, in page order (the week's
 *                 items — any editorial change reseeds the cover)
 * - `mix`       — item counts per item-bearing page type (the sector mix)
 * - `companies` — sorted unique company slugs tagged on items
 * - `tickers`   — the markets basket, in emitted order
 */
export interface CoverSeedInput {
  issue: number;
  headlines: string[];
  mix: Record<string, number>;
  companies: string[];
  tickers: string[];
}

/** Extract the canonical digest from an emitted edition object. */
export function coverSeedInput(edition: Record<string, unknown>): CoverSeedInput {
  const pages = Array.isArray(edition.pages) ? (edition.pages as AnyPage[]) : [];
  const headlines: string[] = [];
  const mix: Record<string, number> = {};
  const companies = new Set<string>();
  const tickers: string[] = [];
  for (const page of pages) {
    const type = typeof page.type === "string" ? page.type : "";
    if (Array.isArray(page.items)) {
      const items = page.items as AnyPage[];
      if (type !== "") mix[type] = items.length;
      for (const item of items) {
        if (typeof item.headline === "string") headlines.push(item.headline);
        if (Array.isArray(item.companies)) {
          for (const c of item.companies as unknown[]) {
            if (typeof c === "string") companies.add(c);
          }
        }
      }
    }
    if (type === "markets" && Array.isArray(page.tickers)) {
      for (const t of page.tickers as AnyPage[]) {
        if (typeof t.ticker === "string") tickers.push(t.ticker);
      }
    }
  }
  return {
    issue: typeof edition.issue_number === "number" ? edition.issue_number : 0,
    headlines,
    mix,
    companies: [...companies].sort(),
    tickers,
  };
}

/** sha256 hex of the canonical digest — the cover's seed. */
export function coverSeed(edition: Record<string, unknown>): string {
  const input = coverSeedInput(edition);
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}

/** Byte `i` of the seed as a uint8 — coarse switches (composition, palette). */
export function seedByte(seed: string, i: number): number {
  return parseInt(seed.slice((i * 2) % 64, (i * 2) % 64 + 2), 16);
}

/** First 8 hex chars of the seed as a uint32 — PRNG state for geometry. */
export function seedUint32(seed: string, offset = 0): number {
  return parseInt(seed.slice((offset * 8) % 56, (offset * 8) % 56 + 8), 16) >>> 0;
}

/**
 * mulberry32 — the standard tiny deterministic PRNG. Given the same state it
 * produces the same [0,1) stream on every platform; the compositions draw
 * all geometry from this stream so the art can never drift.
 */
export function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
