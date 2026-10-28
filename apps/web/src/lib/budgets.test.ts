/**
 * I5 asset budgets (DESIGN §5) — the static half of the perf/a11y gate,
 * runnable without a browser inside `pnpm check`:
 *
 *  - fonts: self-hosted woff2 subsets under public/fonts, font-display: swap,
 *    no external font CDN anywhere in the stylesheet.
 *  - cover: every `pages[].image` in an edition/fixture resolves to a real
 *    ≤180KB AVIF under public/.
 *  - client JS: the front page allows only the sticky bar + keyboard nav
 *    island (FrontPageChrome) and the deck island (DeckView) — any other
 *    "use client" module fails the budget.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const WEB = path.resolve(import.meta.dirname, "..", "..");
const ROOT = path.resolve(WEB, "..", "..");
const FONTS_CSS = path.join(ROOT, "packages/ui/src/fonts.css");
const PUBLIC = path.join(WEB, "public");

// budget.json is the committed Lighthouse budgets file — the same numbers
// are asserted here directly against the repo's assets, so the gate works
// in `pnpm check` without a browser.
const budgets = JSON.parse(
  readFileSync(path.join(WEB, "budget.json"), "utf8"),
) as {
  resourceSizes?: { resourceType: string; budget: number }[];
}[];
const kb = (type: string) =>
  (budgets[0]?.resourceSizes?.find((r) => r.resourceType === type)?.budget ??
    0) * 1024;
const COVER_BUDGET = kb("image"); // §5: cover ≤ 180KB AVIF
const FONT_BUDGET = kb("font"); // latin subsets — far under a full face

/** "use client" directive = first statement of the module. */
function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/.test(source);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

describe("font budgets", () => {
  const css = readFileSync(FONTS_CSS, "utf8");
  const faces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];

  it("declares faces and every face is font-display: swap", () => {
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(face).toContain("font-display: swap");
    }
  });

  it("sources are self-hosted woff2, present, and subset-sized", () => {
    expect(css).not.toMatch(/https?:\/\//); // no external font CDN
    const srcs = [...css.matchAll(/src:\s*url\("([^"]+)"\)/g)].map(
      (m) => m[1]!,
    );
    expect(srcs.length).toBe(faces.length);
    for (const src of srcs) {
      expect(src).toMatch(/^\/fonts\/[\w.-]+\.woff2$/); // same-origin + woff2
      const file = path.join(PUBLIC, src);
      expect(existsSync(file), `${src} must exist in public/`).toBe(true);
      const kb = statSync(file).size / 1024;
      expect(kb, `${src} must stay a subset`).toBeLessThan(FONT_BUDGET / 1024);
    }
  });
});

describe("cover budget (≤180KB AVIF)", () => {
  const editionFiles = [
    ...walk(path.join(ROOT, "editions")),
    ...walk(path.join(ROOT, "fixtures")),
  ].filter((f) => f.endsWith(".json"));

  it("every edition cover image is a real ≤180KB AVIF in public/", () => {
    const checked: string[] = [];
    for (const file of editionFiles) {
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        pages?: { image?: string }[];
      };
      for (const p of json.pages ?? []) {
        if (!p.image) continue;
        checked.push(p.image);
        expect(p.image, `${file}: ${p.image} must be AVIF`).toMatch(
          /\.avif$/i,
        );
        const asset = path.join(PUBLIC, p.image);
        expect(
          existsSync(asset),
          `${file}: ${p.image} missing from public/`,
        ).toBe(true);
        expect(
          statSync(asset).size,
          `${file}: ${p.image} over 180KB`,
        ).toBeLessThanOrEqual(COVER_BUDGET);
      }
    }
    // Vacuous today (no covers yet) — the gate exists for when they land.
    expect(checked).toBeInstanceOf(Array);
  });
});

describe("client-JS allowlist (§5: no unexpected client JS)", () => {
  // DESIGN §5 allows the sticky bar + keyboard nav (FrontPageChrome) and the
  // deck island (DeckView) — the chart needs no hydration.
  const ALLOWED = new Set([
    "app/[issue]/DeckView.tsx",
    "app/[issue]/FrontPageChrome.tsx",
  ]);

  it("apps/web ships no other client modules", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(WEB, "src"))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (isClientModule(readFileSync(file, "utf8"))) {
        const rel = path.relative(path.join(WEB, "src"), file);
        if (!ALLOWED.has(rel)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("@weekly/ui components ship no client modules", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "packages/ui/src"))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      if (isClientModule(readFileSync(file, "utf8"))) {
        offenders.push(path.relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
