import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { coverSeed } from "@weekly/cover/seed";

import { buildProvenance, checkProvenance, type IngestCache } from "./provenance";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const W44 = JSON.parse(
  readFileSync(path.join(ROOT, "editions", "2026-w44.json"), "utf8"),
) as Record<string, unknown>;

/** Minimal ingest run so the record's required fields exist. */
const RUN: IngestCache = {
  manifest: {
    date: "2026-10-30",
    ran_at: "2026-10-30T00:00:00.000Z",
    window: { from: "a", to: "b" },
    sources: [{ source: "s", adapter: "a", ok: true, count: 1 }],
  },
  cache_hashes: { "data/raw/x/y.json": `sha256:${"0".repeat(64)}` },
};

const COVER = {
  generator: "@weekly/cover",
  seed: coverSeed(W44),
  composition: "field",
};

/** Edition clone with the cover image set (as edition:build emits). */
function editionWithCover(): Record<string, unknown> {
  const e = structuredClone(W44);
  (e.pages as { image?: string }[])[0]!.image =
    "editions/2026-w44/cover.avif";
  return e;
}

describe("provenance cover block (T3)", () => {
  it("buildProvenance carries {generator, seed, composition}", () => {
    const rec = buildProvenance(editionWithCover(), [RUN], COVER);
    expect(rec.cover).toEqual(COVER);
  });

  it("clean record + consistent cover → no cover issues", () => {
    const ed = editionWithCover();
    const rec = buildProvenance(ed, [RUN], COVER);
    const issues = checkProvenance(ed, rec).filter((i) =>
      i.path.includes("cover"),
    );
    expect(issues).toEqual([]);
  });

  it("edition declares cover.image but record lacks the block → flagged", () => {
    const ed = editionWithCover();
    const rec = buildProvenance(ed, [RUN]); // no cover arg
    const issues = checkProvenance(ed, rec);
    expect(issues.some((i) => i.path === "provenance.json.cover")).toBe(true);
  });

  it("cover block without edition image → flagged (inconsistent)", () => {
    const bare = structuredClone(W44);
    delete (bare.pages as { image?: string }[])[0]!.image;
    const rec = buildProvenance(bare, [RUN], COVER);
    const issues = checkProvenance(bare, rec);
    expect(issues.some((i) => i.path === "provenance.json.cover")).toBe(true);
  });

  it("seed must be sha256 hex matching the edition's canonical digest", () => {
    const ed = editionWithCover();
    const rec = buildProvenance(ed, [RUN], {
      ...COVER,
      seed: "f".repeat(64), // wrong seed
    });
    const issues = checkProvenance(ed, rec);
    expect(issues.some((i) => i.path === "provenance.json.cover.seed")).toBe(
      true,
    );
  });

  it("malformed fields → flagged", () => {
    const ed = editionWithCover();
    const rec = buildProvenance(ed, [RUN], {
      generator: "",
      seed: "nothex",
      composition: "",
    });
    const issues = checkProvenance(ed, rec);
    expect(
      issues.some((i) => i.path === "provenance.json.cover.generator"),
    ).toBe(true);
    expect(issues.some((i) => i.path === "provenance.json.cover.seed")).toBe(
      true,
    );
    expect(
      issues.some((i) => i.path === "provenance.json.cover.composition"),
    ).toBe(true);
  });
});
