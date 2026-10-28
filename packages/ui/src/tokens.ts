/**
 * @weekly/ui — design tokens, verbatim from DESIGN.md §1 and §7.
 * This module is the ONLY source of visual constants in the repo.
 * The same values are emitted as CSS custom properties by `tokens.css`;
 * `tokens.test.ts` keeps the two in sync.
 */

/* §1.1 Colour — accent appears at most once per viewport; up/down only next to a number. */
export const colors = {
  light: {
    paper: "#F4F3EF",
    paper2: "#ECEBE6",
    ink: "#111111",
    ink2: "#5C5C58",
    ink3: "#A3A29D",
    rule: "#D9D8D2",
    accent: "#D9281C",
    up: "#1F7A3A",
    down: "#B3261E",
  },
  dark: {
    paper: "#121212",
    paper2: "#1B1B1B",
    ink: "#F1F0EC",
    ink2: "#A8A7A2",
    ink3: "#6B6A66",
    rule: "#2A2A2A",
    accent: "#FF4A3D",
    up: "#1F7A3A",
    down: "#B3261E",
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorToken = keyof (typeof colors)["light"];

/* §1.2 Type — two families, three roles. Display face is one token so it can swap later. */
export const fonts = {
  display: '"Inter Tight", Geist, "Helvetica Neue", Arial, sans-serif',
  text: '"Inter", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  mono: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
} as const;

export type FontRole = keyof typeof fonts;

/** rem sizes as `min / max` across 390px → 1280px viewport widths; emitted as clamp(). */
export const typeScale = {
  "t-xs": { min: 0.6875, max: 0.6875 }, // labels, kickers, metadata
  "t-sm": { min: 0.8125, max: 0.8125 }, // captions, takes, source lines
  "t-base": { min: 1.0, max: 1.0625 }, // body
  "t-lg": { min: 1.25, max: 1.375 }, // item headlines
  "t-xl": { min: 1.75, max: 2.25 }, // section heads
  "t-2xl": { min: 2.5, max: 4.0 }, // Briefing lead, cover deck
  "t-3xl": { min: 3.5, max: 7.0 }, // cover headline
} as const;

export type TypeToken = keyof typeof typeScale;

export const leading = {
  display: 1.0, // 0.95–1.05 per spec; midpoint
  text: 1.45,
  mono: 1.3,
} as const;

/** Max measure (§1.2). */
export const measure = { body: "64ch", display: "28ch" } as const;

/* §1.3 Space — base unit 4px. Keys are the px value. */
export const space = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const;
export type SpaceStep = (typeof space)[number];

export const grid = {
  columns: 12,
  gutter: 24,
  maxWidth: 1280,
  pagePadding: 32,
  mobile: { columns: 4, gutter: 16, pagePadding: 20 },
} as const;

/** Radius: 0 everywhere except pills (999) and images (2). No shadows. */
export const radius = { pill: 999, image: 2 } as const;

/* §1.4 Motion — translate only; reduced-motion cuts to instant. */
export const motion = {
  pageMs: 240,
  pageEase: "cubic-bezier(0.2, 0, 0, 1)",
  fillMs: 200,
  fillEase: "linear",
  hoverMs: 120,
} as const;
