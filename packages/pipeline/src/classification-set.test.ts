import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadCompaniesConfig } from "./config.js";
import labeledSet from "../testdata/classification/labeled-items.json";

/**
 * Integrity checks for the C3 labelled classification set — the ground truth
 * P4's accuracy harness is measured against. The set's own README documents
 * the format; these tests keep it loadable and well-formed.
 */

interface LabeledItem {
  id: string;
  headline: string;
  url: string;
  publisher: string;
  published_at: string;
  excerpt: string;
  expect: { page: string; companies: string[] };
  notes?: string;
}

const items = labeledSet.items as LabeledItem[];

describe("labelled classification set", () => {
  it("has at least 50 items", () => {
    expect(items.length).toBeGreaterThanOrEqual(50);
  });

  it("covers every label at least 3 times, including unsorted", () => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.expect.page, (counts.get(item.expect.page) ?? 0) + 1);
    }
    for (const label of labeledSet.labels) {
      expect(counts.get(label) ?? 0, `label ${label}`).toBeGreaterThanOrEqual(3);
    }
    expect(counts.get("unsorted")).toBeGreaterThanOrEqual(3);
  });

  it("has unique ids following the <label>-NNN convention", () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of items) {
      expect(item.id).toMatch(/^[a-z]+-\d{3}$/);
    }
  });

  it("uses real https URLs and ≤300-char excerpts", () => {
    for (const item of items) {
      expect(item.url, item.id).toMatch(/^https:\/\/[^\s/]+\.[^\s/]+\//);
      expect(item.excerpt.length, item.id).toBeLessThanOrEqual(300);
    }
  });

  it("gives every item a declared label and a company array", () => {
    const labels = new Set(labeledSet.labels);
    for (const item of items) {
      expect(labels.has(item.expect.page), item.id).toBe(true);
      expect(Array.isArray(item.expect.companies), item.id).toBe(true);
      expect(item.published_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.headline.length).toBeGreaterThan(0);
      expect(item.publisher.length).toBeGreaterThan(0);
    }
  });

  it("resolves every expect.companies slug against config/companies.yaml", () => {
    // PLAN §5.3: unknown-company items classify to `unsorted`, so a slug absent
    // from the registry can never be emitted — the ground truth must not ask
    // for one. Registry entries are extended instead of relabelling.
    const registry = new Set(
      loadCompaniesConfig(
        fileURLToPath(new URL("../../../config/companies.yaml", import.meta.url)),
      ).map((c) => c.slug),
    );
    for (const item of items) {
      for (const slug of item.expect.companies) {
        expect(registry.has(slug), `${item.id}: slug "${slug}"`).toBe(true);
      }
    }
  });
});
