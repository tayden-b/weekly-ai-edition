import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { colors, fonts, motion, space, typeScale } from "./index";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");
const tokensCss = readFileSync(join(here, "tokens.css"), "utf8");
const designMd = readFileSync(join(root, "DESIGN.md"), "utf8");

/* Parse the DESIGN.md §1.1 colour block — the verbatim source of truth.
 * The dark scheme sits after the "dark scheme" line; --up/--down are only
 * defined once (light) and carry over per spec. */
function designColors(scheme: "light" | "dark"): Record<string, string> {
  const [lightPart, darkPart] = designMd.split("dark scheme");
  const text = scheme === "light" ? lightPart! : darkPart!;
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/--(\w[\w-]*)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    out[m[1]!] = m[2]!.toUpperCase();
  }
  if (scheme === "dark") {
    for (const [k, v] of Object.entries(designColors("light"))) {
      out[k] ??= v;
    }
  }
  return out;
}

function cssVar(css: string, name: string): string | undefined {
  return css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim();
}

const camelToKebab = (k: string) =>
  k.replace(/(\d+)$/, "-$1"); // paper2 → paper-2, ink3 → ink-3

describe("colour tokens", () => {
  const expectedLight = designColors("light");
  const expectedDark = designColors("dark");

  it("match the DESIGN.md §1.1 light scheme", () => {
    for (const [key, value] of Object.entries(colors.light)) {
      expect(expectedLight[camelToKebab(key)]).toBe(value);
    }
  });

  it("match the DESIGN.md §1.1 dark scheme", () => {
    for (const [key, value] of Object.entries(colors.dark)) {
      expect(expectedDark[camelToKebab(key)]).toBe(value);
    }
  });

  it("tokens.css emits every colour as a custom property in both schemes", () => {
    for (const [key, value] of Object.entries(colors.light)) {
      expect(cssVar(tokensCss, camelToKebab(key))).toBe(value.toLowerCase());
    }
    const darkBlock = tokensCss.match(/\.w-dark\s*\{([^}]+)\}/)?.[1] ?? "";
    for (const [key, value] of Object.entries(colors.dark)) {
      expect(cssVar(darkBlock, camelToKebab(key))).toBe(value.toLowerCase());
    }
  });
});

describe("type scale", () => {
  it("exports --t-xs through --t-3xl", () => {
    expect(Object.keys(typeScale)).toEqual([
      "t-xs",
      "t-sm",
      "t-base",
      "t-lg",
      "t-xl",
      "t-2xl",
      "t-3xl",
    ]);
  });

  it("emits a var for every step; fixed steps stay fixed", () => {
    expect(cssVar(tokensCss, "t-xs")).toBe(`${typeScale["t-xs"].min}rem`);
    expect(cssVar(tokensCss, "t-sm")).toBe(`${typeScale["t-sm"].min}rem`);
    for (const t of ["t-base", "t-lg", "t-xl", "t-2xl", "t-3xl"] as const) {
      const v = cssVar(tokensCss, t) ?? "";
      expect(v.startsWith("clamp(")).toBe(true);
      expect(v.endsWith(`${typeScale[t].max}rem)`)).toBe(true);
    }
  });

  it("font roles resolve to the three faces (§1.2, §7.3)", () => {
    expect(fonts.display).toContain("Inter Tight");
    expect(fonts.text).toContain("Inter");
    expect(fonts.mono).toContain("Geist Mono");
    expect(cssVar(tokensCss, "font-display")).toContain("Inter Tight");
    expect(cssVar(tokensCss, "font-text")).toContain('"Inter"');
    expect(cssVar(tokensCss, "font-mono")).toContain("Geist Mono");
  });
});

describe("space + motion tokens", () => {
  it("space scale is exactly the §1.3 ladder", () => {
    expect([...space]).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96, 128]);
    for (const s of space) {
      expect(cssVar(tokensCss, `space-${s}`)).toBe(`${s}px`);
    }
  });

  it("motion values match §1.4", () => {
    expect(motion.pageMs).toBe(240);
    expect(motion.pageEase).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(motion.fillMs).toBe(200);
    expect(motion.hoverMs).toBe(120);
    expect(cssVar(tokensCss, "dur-page")).toBe("240ms");
    expect(cssVar(tokensCss, "ease-page")).toBe("cubic-bezier(0.2, 0, 0, 1)");
  });
});
