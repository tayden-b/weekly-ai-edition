/**
 * T3 contract tests — the acceptance criteria that live in code:
 *
 *  - determinism: same edition → same seed → identical SVG + rasters
 *    (the replay gate reproduces committed artifacts byte-for-byte);
 *  - data-seeded: ANY editorial change reseeds the art;
 *  - art direction by construction: no <text>, no external refs, colors
 *    only from curated palettes (config/cover-palettes.json);
 *  - budgets: AVIF ≤180KB, OG PNG ≤200KB at the spec'd sizes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { authorCoverSvg } from "./compose";
import { loadCoverPalettes } from "./palettes";
import { COMPOSITIONS, coverParams } from "./params";
import { renderCoverArt } from "./render";
import { coverSeed, coverSeedInput, mulberry32, seedByte } from "./seed";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const W44 = JSON.parse(
  readFileSync(path.join(ROOT, "editions", "2026-w44.json"), "utf8"),
) as Record<string, unknown>;

const palettes = loadCoverPalettes();
const params = coverParams(W44, palettes);

describe("seed (data-seeded, deterministic)", () => {
  it("same edition → same seed", () => {
    expect(coverSeed(W44)).toBe(coverSeed(W44));
    expect(coverSeed(W44)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("any editorial change reseeds the art", () => {
    const changed = structuredClone(W44);
    const list = (changed.pages as { items?: { headline: string }[] }[]).find(
      (pg) => Array.isArray(pg.items) && pg.items.length > 0,
    )!;
    list.items![0]!.headline = "A completely different story";
    expect(coverSeed(changed)).not.toBe(coverSeed(W44));
  });

  it("digest covers items, mix, companies, tickers", () => {
    const input = coverSeedInput(W44);
    expect(input.issue).toBe(W44.issue_number);
    expect(input.headlines.length).toBeGreaterThan(0);
    expect(Object.keys(input.mix).length).toBeGreaterThan(0);
    expect(input.companies).toEqual([...input.companies].sort());
  });

  it("mulberry32 is a fixed [0,1) stream per state", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
});

describe("params (seed → visual contract)", () => {
  it("composition is one of the 3 archetypes", () => {
    expect(COMPOSITIONS).toContain(params.composition);
  });

  it("palette comes from the curated set (never random RGB)", () => {
    expect(palettes).toContain(params.palette);
    expect(palettes.length).toBeGreaterThanOrEqual(3);
  });

  it("grain and depth stay inside the documented bands", () => {
    expect(params.grain).toBeGreaterThanOrEqual(0.045);
    expect(params.grain).toBeLessThanOrEqual(0.105);
    expect(params.depth).toBeGreaterThanOrEqual(0.6);
    expect(params.depth).toBeLessThanOrEqual(1.4);
  });

  it("seedByte reads the seed deterministically", () => {
    expect(seedByte(params.seed, 0)).toBe(seedByte(params.seed, 0));
  });
});

describe("palettes config", () => {
  it("every palette is muted material: ground + ≥2 fields + hex6 colors", () => {
    for (const p of palettes) {
      expect(p.ground).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.fields.length).toBeGreaterThanOrEqual(2);
      for (const f of p.fields) expect(f).toMatch(/^#[0-9a-f]{6}$/i);
      if (p.accent) expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.name).toBeTruthy();
    }
  });
});

describe("authored SVG (art direction by construction)", () => {
  const svg45 = authorCoverSvg(params, { width: 1600, height: 2000 });
  const svg169 = authorCoverSvg(params, { width: 1200, height: 630 });

  it("valid svg with correct viewBox at both aspects", () => {
    expect(svg45).toContain('viewBox="0 0 1600 2000"');
    expect(svg169).toContain('viewBox="0 0 1200 630"');
    expect(svg45).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
  });

  it("no text, no external references — muted fields only", () => {
    for (const svg of [svg45, svg169]) {
      expect(svg).not.toMatch(/<text[\s>]/i);
      // xmlns is a namespace declaration, not a fetched reference — strip it,
      // then nothing may point outside the document.
      const body = svg.replaceAll(/xmlns="[^"]*"/g, "");
      expect(body).not.toMatch(/href=|https?:\/\/|<image/i);
    }
  });

  it("only palette colors + white/black keywords appear", () => {
    const allowed = new Set([
      params.palette.ground.toLowerCase(),
      ...params.palette.fields.map((f) => f.toLowerCase()),
      ...(params.palette.accent ? [params.palette.accent.toLowerCase()] : []),
    ]);
    const hexes = svg45.match(/#[0-9a-f]{6}/gi) ?? [];
    expect(hexes.length).toBeGreaterThan(0);
    for (const h of hexes) expect(allowed).toContain(h.toLowerCase());
  });

  it("byte-stable: same params → identical markup", () => {
    expect(authorCoverSvg(params, { width: 1600, height: 2000 })).toBe(svg45);
  });
});

describe("renderCoverArt (committed assets)", () => {
  it("two renders → byte-identical avif + og + svg", async () => {
    const a = await renderCoverArt(W44);
    const b = await renderCoverArt(W44);
    expect(a.seed).toBe(b.seed);
    expect(a.svg).toBe(b.svg);
    expect(a.ogSvg).toBe(b.ogSvg);
    expect(a.avif.equals(b.avif)).toBe(true);
    expect(a.og.equals(b.og)).toBe(true);
  }, 120_000);

  it("avif is a real AVIF ≤180KB and og a real PNG ≤200KB", async () => {
    const r = await renderCoverArt(W44);
    // AVIF magic: ftyp...avif in the header
    expect(r.avif.subarray(4, 8).toString("ascii")).toBe("ftyp");
    expect(r.avif.length).toBeLessThanOrEqual(180 * 1024);
    // PNG magic
    expect(r.og.subarray(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
    expect(r.og.length).toBeLessThanOrEqual(200 * 1024);
  }, 120_000);
});
