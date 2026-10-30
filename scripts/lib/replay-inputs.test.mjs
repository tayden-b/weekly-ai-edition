/**
 * i162 — replay input pinning: the recorded `cache_hashes` set, and only it,
 * defines the replay pool; every recorded path must hash-match on disk.
 */
import { describe, expect, it } from "vitest";

import { driftedRecordedInputs, partitionRecordedInputs } from "./replay-inputs.mjs";

const HASHES = {
  "data/raw/2026-10-28/hn-algolia.json": "sha256:aaa",
  "data/raw/2026-10-28/manifest.json": "sha256:bbb",
  "data/raw/2026-10-28/sec-edgar.json": "sha256:ccc",
  "data/raw/2026-10-29/hn-algolia.json": "sha256:ddd",
  "data/raw/2026-10-29/manifest.json": "sha256:eee",
  "fixtures/2026-w44/edition.json": "sha256:fff",
};

describe("partitionRecordedInputs", () => {
  it("groups source files by day, keeps manifests as day markers only", () => {
    const { days, filesByDay } = partitionRecordedInputs(HASHES);
    expect(days).toEqual(["2026-10-28", "2026-10-29"]);
    expect(filesByDay.get("2026-10-28")).toEqual([
      "data/raw/2026-10-28/hn-algolia.json",
      "data/raw/2026-10-28/sec-edgar.json",
    ]);
    expect(filesByDay.get("2026-10-29")).toEqual(["data/raw/2026-10-29/hn-algolia.json"]);
  });

  it("excludes post-emission days/files — they are not recorded keys", () => {
    // the recorded set simply lacks 2026-10-30, so nothing can select it
    const { days } = partitionRecordedInputs(HASHES);
    expect(days).not.toContain("2026-10-30");
  });

  it("resolves the single non-cache input as the fixture pool", () => {
    expect(partitionRecordedInputs(HASHES).fixture).toBe("fixtures/2026-w44/edition.json");
  });

  it("reports a second non-cache input as unknown — cannot replay faithfully", () => {
    const { unknown } = partitionRecordedInputs({
      ...HASHES,
      "fixtures/2026-w44/extra.json": "sha256:111",
    });
    expect(unknown).toEqual(["fixtures/2026-w44/extra.json"]);
  });

  it("handles a day whose recorded files are only the manifest", () => {
    const { days, filesByDay } = partitionRecordedInputs({
      "data/raw/2026-10-28/manifest.json": "sha256:bbb",
    });
    expect(days).toEqual(["2026-10-28"]);
    expect(filesByDay.get("2026-10-28")).toBeUndefined();
  });
});

describe("driftedRecordedInputs", () => {
  const intact = {
    exists: () => true,
    sha256: (rel) => HASHES[rel],
  };

  it("is silent when every recorded input exists and hashes clean", () => {
    expect(driftedRecordedInputs(HASHES, intact)).toEqual([]);
  });

  it("names a missing recorded file", () => {
    const problems = driftedRecordedInputs(HASHES, {
      ...intact,
      exists: (rel) => rel !== "data/raw/2026-10-28/hn-algolia.json",
    });
    expect(problems).toEqual(["data/raw/2026-10-28/hn-algolia.json — recorded input missing"]);
  });

  it("names a drifted recorded file with both hashes", () => {
    const problems = driftedRecordedInputs(HASHES, {
      ...intact,
      sha256: (rel) => (rel === "fixtures/2026-w44/edition.json" ? "sha256:zzz" : HASHES[rel]),
    });
    expect(problems).toEqual([
      "fixtures/2026-w44/edition.json — sha256 drifted (sha256:zzz ≠ sha256:fff)",
    ]);
  });
});
