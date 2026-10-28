/**
 * @weekly/ui — design tokens and primitives from DESIGN.md.
 *
 * C4 lands the full token set (colour, type scale, space, motion) and the
 * component primitives (Masthead, Deck, FrontPage, ...). Until then this
 * exports the locked colour tokens so nothing hardcodes a colour elsewhere.
 */

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
  },
} as const;

export type ColorScheme = keyof typeof colors;
