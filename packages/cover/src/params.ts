/**
 * Seed → params mapping (T3). This is the whole contract between a week's
 * data and the picture: every visual decision a composition can make is
 * enumerated here, and only here.
 *
 * - `seed`         — sha256 of the edition digest (`seed.ts`); recorded in
 *                    provenance.json so a cover can always be re-derived.
 * - `composition`  — the archetype. `seedByte 0` chooses one of
 *                    field | orbit | ridge — ~⅓ of weeks each.
 * - `palette`      — `seedByte 1` indexes the curated set in
 *                    `config/cover-palettes.json`; adding a palette reweights
 *                    all future weeks.
 * - `accent`       — `seedByte 2`: two thirds of weeks allow the palette's
 *                    single warm accent region; the rest stay all-quiet.
 * - `grain`        — `seedByte 3` → feTurbulence alpha 0.045–0.105 (fine
 *                    pigment texture, always subtle).
 * - `depth`        — `seedByte 4` → 0.6–1.4 scale on blur radii (how soft the
 *                    fields feel), ±0.4 around 1.
 * - `geometrySeed` — the seed's first word as a u32; each authorCoverSvg
 *                    call starts a fresh mulberry32 stream from it, so every
 *                    call with the same params produces identical geometry.
 */
import type { CoverPalette } from "./palettes";
import { coverSeed, seedByte, seedUint32 } from "./seed";

export type CoverComposition = "field" | "orbit" | "ridge";

export const COMPOSITIONS: readonly CoverComposition[] = [
  "field",
  "orbit",
  "ridge",
] as const;

export interface CoverParams {
  seed: string;
  composition: CoverComposition;
  palette: CoverPalette;
  /** Whether the palette's warm accent region may appear. */
  accent: boolean;
  /** Grain overlay alpha, 0.045–0.105. */
  grain: number;
  /** Blur/softness scale, 0.6–1.4. */
  depth: number;
  /** u32 seed for the composition's deterministic geometry stream. */
  geometrySeed: number;
}

export function coverParams(
  edition: Record<string, unknown>,
  palettes: readonly CoverPalette[],
): CoverParams {
  const seed = coverSeed(edition);
  const composition = COMPOSITIONS[seedByte(seed, 0) % COMPOSITIONS.length]!;
  const palette = palettes[seedByte(seed, 1) % palettes.length]!;
  return {
    seed,
    composition,
    palette,
    accent: seedByte(seed, 2) % 3 !== 0,
    grain: 0.045 + (seedByte(seed, 3) / 255) * 0.06,
    depth: 0.6 + (seedByte(seed, 4) / 255) * 0.8,
    geometrySeed: seedUint32(seed),
  };
}
