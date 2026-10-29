/**
 * Deterministic SVG authoring for the weekly cover (T3, DESIGN §0/§1.5,
 * STYLE.md §9): muted colour-field / material abstraction — soft fields of
 * colour, gentle directional light, fine pigment texture, depth. Never
 * people, products, logos, or text: the vocabulary is gradients, blurred
 * fields, curves, and noise only.
 *
 * Everything here is a pure function of `CoverParams` + the canvas size —
 * no clocks, no randomness outside the mulberry32 stream each call seeds
 * from `params.geometrySeed`, so the same params always draw the same
 * picture. Colour comes from the curated `palette`
 * (config/cover-palettes.json); the only other values are SVG `white`/`black`
 * keywords at low alpha for light and shadow — the zero-hardcode-style gate
 * scans this file and finds no colour literals by construction.
 */
import type { CoverParams } from "./params";
import { mulberry32 } from "./seed";

export interface CoverCanvas {
  width: number;
  height: number;
}

/** Deterministic number formatting — 2dp, trailing zeros trimmed. */
const n = (x: number): string => {
  const s = x.toFixed(2);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

interface ArchetypeCtx {
  p: CoverParams;
  w: number;
  h: number;
}


/**
 * Midpoint smoothing: chain `Q` quadratics through midpoints so a sparse
 * point list becomes one organic curve. Deterministic per point list.
 */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  const segs: string[] = [];
  let prev = first!;
  for (const cur of rest) {
    const mx = (prev[0] + cur[0]) / 2;
    const my = (prev[1] + cur[1]) / 2;
    segs.push(`Q ${n(prev[0])} ${n(prev[1])} ${n(mx)} ${n(my)}`);
    prev = cur;
  }
  segs.push(`L ${n(prev[0])} ${n(prev[1])}`);
  return `M ${n(first![0])} ${n(first![1])} ${segs.join(" ")}`;
}

/** The shared finishing layer: pigment grain + a gentle corner vignette. */
function finish(c: ArchetypeCtx): string {
  const { p, w, h } = c;
  // Grain seed stays inside the int32 feTurbulence wants.
  const gSeed = parseInt(p.seed.slice(8, 16), 16) % 65536;
  return `
  <filter id="grain" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" seed="${gSeed}" stitchTiles="stitch"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="${n(p.grain)}" intercept="0"/></feComponentTransfer>
    <feComposite operator="in" in2="SourceGraphic"/>
  </filter>
  <radialGradient id="vignette" cx="50%" cy="42%" r="75%">
    <stop offset="62%" stop-color="black" stop-opacity="0"/>
    <stop offset="100%" stop-color="black" stop-opacity="0.10"/>
  </radialGradient>
  <rect width="${n(w)}" height="${n(h)}" filter="url(#grain)"/>
  <rect width="${n(w)}" height="${n(h)}" fill="url(#vignette)"/>`;
}

/**
 * field — layered blurred colour fields over paper, one directional light
 * wash. The A17.2-soft-blur archetype: 3–4 large muted ellipses bleeding off
 * the edges, at most one small warm accent region.
 */
function fieldSvg(c: ArchetypeCtx): string {
  const { p, w, h } = c;
  const rng = mulberry32(p.geometrySeed);
  const f = p.palette.fields;
  const blur = Math.round(40 * p.depth);
  const shapes: string[] = [];

  // Back fields: large, edge-bleeding, drawn first.
  const count = 3 + Math.floor(rng() * 2); // 3–4 fields
  for (let i = 0; i < count; i++) {
    const cx = (0.1 + rng() * 0.8) * w;
    const cy = (0.08 + rng() * 0.84) * h;
    const rx = (0.34 + rng() * 0.3) * w;
    const ry = (0.3 + rng() * 0.32) * h;
    const color = f[i % f.length];
    const opacity = 0.64 + rng() * 0.3;
    shapes.push(
      `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${color}" opacity="${n(opacity)}"/>`,
    );
  }

  // The single warm accent region: small, soft, tucked near an edge.
  let accent = "";
  if (p.accent && p.palette.accent !== undefined) {
    const ax = (rng() < 0.5 ? 0.12 + rng() * 0.18 : 0.7 + rng() * 0.2) * w;
    const ay = (0.15 + rng() * 0.7) * h;
    accent = `<ellipse cx="${n(ax)}" cy="${n(ay)}" rx="${n(0.11 * w)}" ry="${n(0.09 * h)}" fill="${p.palette.accent}" opacity="0.72"/>`;
  }

  // Directional light: a soft diagonal wash at a seeded angle.
  const angle = rng() < 0.5 ? "0" : "1"; // light from upper-left or upper-right
  const wash = `
  <linearGradient id="light" x1="${angle}" y1="0" x2="${angle === "0" ? "1" : "0"}" y2="1">
    <stop offset="0%" stop-color="white" stop-opacity="0.14"/>
    <stop offset="55%" stop-color="white" stop-opacity="0"/>
  </linearGradient>
  <rect width="${n(w)}" height="${n(h)}" fill="url(#light)"/>`;

  return `
  <filter id="soft"><feGaussianBlur stdDeviation="${blur}"/></filter>
  <rect width="${n(w)}" height="${n(h)}" fill="${p.palette.ground}"/>
  <g filter="url(#soft)">${shapes.join("")}${accent}</g>
  ${wash}`;
}

/**
 * orbit — concentric tonal discs drifting around an off-centre point:
 * nested muted circles with softly blurred rims, a small highlight near the
 * core, optionally one thin warm ring.
 */
function orbitSvg(c: ArchetypeCtx): string {
  const { p, w, h } = c;
  const rng = mulberry32(p.geometrySeed);
  const f = p.palette.fields;
  const blur = Math.round(26 * p.depth);
  const cx = (0.32 + rng() * 0.36) * w;
  const cy = (0.3 + rng() * 0.4) * h;
  const base = Math.max(w, h);

  const rings = 5 + Math.floor(rng() * 3); // 5–7 nested discs
  const shapes: string[] = [];
  for (let i = 0; i < rings; i++) {
    const r = base * (0.52 - i * (0.4 / rings) * (0.9 + rng() * 0.2));
    if (r <= 0) break;
    const dx = (rng() - 0.5) * base * 0.05 * i;
    const dy = (rng() - 0.5) * base * 0.05 * i;
    const color = i === rings - 1 ? p.palette.ground : f[i % f.length];
    shapes.push(
      `<circle cx="${n(cx + dx)}" cy="${n(cy + dy)}" r="${n(r)}" fill="${color}" opacity="${n(0.8 - i * 0.04)}"/>`,
    );
  }

  let accent = "";
  if (p.accent && p.palette.accent !== undefined) {
    const ar = base * (0.2 + rng() * 0.16);
    accent = `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(ar)}" fill="none" stroke="${p.palette.accent}" stroke-width="${n(base * 0.018)}" opacity="0.7"/>`;
  }

  // Core highlight: a small soft light pulled slightly toward the light.
  const hx = cx + (rng() - 0.4) * w * 0.08;
  const hy = cy - (0.04 + rng() * 0.06) * h;
  const highlight = `<ellipse cx="${n(hx)}" cy="${n(hy)}" rx="${n(base * 0.07)}" ry="${n(base * 0.05)}" fill="white" opacity="0.2"/>`;

  return `
  <filter id="soft"><feGaussianBlur stdDeviation="${blur}"/></filter>
  <rect width="${n(w)}" height="${n(h)}" fill="${p.palette.ground}"/>
  <g filter="url(#soft)">${shapes.join("")}${accent}${highlight}</g>`;
}

/**
 * ridge — stacked topographic ridgelines: a quiet sky glow, then 4–6 tonal
 * bands whose crests undulate on smooth curves — mist between the distant
 * ridges, darker and crisper toward the front.
 */
function ridgeSvg(c: ArchetypeCtx): string {
  const { p, w, h } = c;
  const rng = mulberry32(p.geometrySeed);
  const f = p.palette.fields;
  const shapes: string[] = [];
  const defs: string[] = [];

  // Sky glow above the first ridge — the soft directional light.
  const glowX = (0.25 + rng() * 0.5) * w;
  const glowY = (0.18 + rng() * 0.18) * h;
  const glowR = (0.3 + rng() * 0.15) * w;
  shapes.push(
    `<ellipse cx="${n(glowX)}" cy="${n(glowY)}" rx="${n(glowR)}" ry="${n(glowR * 0.6)}" fill="white" opacity="0.3"/>`,
  );

  const ridges = 4 + Math.floor(rng() * 3); // 4–6 bands
  const accentAt =
    p.accent && p.palette.accent !== undefined
      ? 1 + Math.floor(rng() * (ridges - 2))
      : -1;
  for (let i = 0; i < ridges; i++) {
    // Front-to-back tonality: deeper ridges take deeper fields.
    const tone = f[Math.min(i, f.length - 1)]!;
    const fill = i === accentAt ? p.palette.accent! : tone;
    const base = h * (0.34 + (i / ridges) * 0.78);
    const pts: [number, number][] = [];
    const nPts = 5;
    for (let k = 0; k <= nPts; k++) {
      const x = (k / nPts) * w;
      const y = base + (rng() - 0.5) * h * 0.1 - Math.sin((k / nPts) * Math.PI) * h * 0.05;
      pts.push([x, y]);
    }
    // Crest curve, then close along the bottom — one tonal band.
    const crest = smoothPath(pts);
    const blur = Math.round(2 + (ridges - i) * 1.6 * p.depth);
    defs.push(`<filter id="r${i}"><feGaussianBlur stdDeviation="${blur}"/></filter>`);
    const opacity = i === accentAt ? 0.55 : 0.9;
    shapes.push(
      `<path d="${crest} L ${n(w)} ${n(h)} L 0 ${n(h)} Z" fill="${fill}" opacity="${n(opacity)}" filter="url(#r${i})"/>`,
    );
    // Mist along the crest line of all but the nearest ridge.
    if (i < ridges - 1) {
      const mist = `<rect x="0" y="${n(base - h * 0.02)}" width="${n(w)}" height="${n(h * 0.05)}" fill="white" opacity="0.1" filter="url(#r${i})"/>`;
      shapes.push(mist);
    }
  }

  return `${defs.join("\n  ")}
  <rect width="${n(w)}" height="${n(h)}" fill="${p.palette.ground}"/>
  ${shapes.join("\n  ")}`;
}

const BUILDERS: Record<CoverParams["composition"], (c: ArchetypeCtx) => string> = {
  field: fieldSvg,
  orbit: orbitSvg,
  ridge: ridgeSvg,
};

/**
 * Author the cover SVG for an edition's params at a canvas size. Every
 * archetype is tasteful at 4:5 (portrait) and ~16:9 (the 1200×630 OG spec):
 * all geometry is fractional, so the same seed re-renders identically at any
 * aspect.
 */
export function authorCoverSvg(
  params: CoverParams,
  canvas: CoverCanvas,
): string {
  const { width, height } = canvas;
  const ctx: ArchetypeCtx = { p: params, w: width, h: height };
  const body = BUILDERS[params.composition](ctx);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}" height="${n(height)}" viewBox="0 0 ${n(width)} ${n(height)}">
  ${body}
  ${finish(ctx)}
</svg>
`;
}
