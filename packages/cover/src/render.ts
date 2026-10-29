/**
 * `renderCoverArt` — the build-time half of T3. Authors the deterministic
 * SVG for an edition, then rasterizes it with sharp to the committed
 * assets: `cover.avif` (4:5 portrait, ≤180KB) and `cover-og.png`
 * (1200×630 OG spec, ≤200KB). sharp pins libvips, so a given edition +
 * sharp version renders byte-identical bytes on every run and every host —
 * the replay determinism gate relies on that.
 *
 * Kept behind the `@weekly/cover/render` subpath: nothing that loads the
 * component (`@weekly/cover`) pulls a native rasterizer into its graph.
 */
import sharp from "sharp";

import { authorCoverSvg } from "./compose";
import { coverParams } from "./params";
import { loadCoverPalettes, type CoverPalette } from "./palettes";
import type { CoverComposition } from "./params";

/** §1.5.2 portrait spec (the 4:5 crop) and the 1200×630 OG spec. */
export const COVER_PORTRAIT = { width: 2000, height: 2500 } as const;
export const COVER_OG = { width: 1200, height: 630 } as const;

export interface CoverArtResult {
  /** sha256 seed the art was derived from — recorded in provenance. */
  seed: string;
  palette: string;
  composition: CoverComposition;
  /** Committed SVG sources (diffable art). */
  svg: string;
  ogSvg: string;
  /** Rasterized assets. */
  avif: Buffer;
  og: Buffer;
}

export interface RenderCoverOptions {
  /** Curated palettes; defaults to config/cover-palettes.json. */
  palettes?: CoverPalette[];
  portrait?: { width: number; height: number };
  og?: { width: number; height: number };
  /** AVIF encoder quality (0–100) — tuned to stay well under 180KB. */
  avifQuality?: number;
}

export async function renderCoverArt(
  edition: Record<string, unknown>,
  opts: RenderCoverOptions = {},
): Promise<CoverArtResult> {
  const palettes = opts.palettes ?? loadCoverPalettes();
  const params = coverParams(edition, palettes);
  const portrait = opts.portrait ?? COVER_PORTRAIT;
  const ogSize = opts.og ?? COVER_OG;

  const svg = authorCoverSvg(params, portrait);
  const ogSvg = authorCoverSvg(params, ogSize);

  const avif = await sharp(Buffer.from(svg, "utf8"), { density: 96 })
    .resize(portrait.width, portrait.height)
    .avif({ quality: opts.avifQuality ?? 45, effort: 6 })
    .toBuffer();

  // PNG cannot compress the fine feTurbulence grain inside budget, so a
  // median(3) pass folds the sub-pixel noise back into the fields before
  // palette quantization — the soft geometry is untouched, the pigment
  // texture survives at larger scales, and 1200×630 lands under 200KB.
  const og = await sharp(Buffer.from(ogSvg, "utf8"), { density: 96 })
    .resize(ogSize.width, ogSize.height)
    .median(3)
    .png({ compressionLevel: 9, palette: true, colours: 160, dither: 0.6 })
    .toBuffer();

  return {
    seed: params.seed,
    palette: params.palette.name,
    composition: params.composition,
    svg,
    ogSvg,
    avif,
    og,
  };
}
