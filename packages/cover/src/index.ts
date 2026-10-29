/**
 * @weekly/cover — the keyless generative cover (T3). A week's data seeds one
 * deterministic piece of muted material art; the same seed renders identically
 * as an inline React surface (`CoverArt`) and as committed build-time assets
 * (`@weekly/cover/render` → cover.avif / cover-og.png / cover.svg).
 */

export { CoverArt, COVER_ASPECTS, type CoverAspect } from "./CoverArt";
export { authorCoverSvg, type CoverCanvas } from "./compose";
export {
  coverParams,
  COMPOSITIONS,
  type CoverComposition,
  type CoverParams,
} from "./params";
export {
  coverSeed,
  coverSeedInput,
  mulberry32,
  seedByte,
  seedUint32,
  type CoverSeedInput,
} from "./seed";
export { loadCoverPalettes, type CoverPalette } from "./palettes";
