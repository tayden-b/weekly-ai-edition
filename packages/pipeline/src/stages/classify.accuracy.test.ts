import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadCompaniesConfig } from "../config.js";
import {
  applyClassification,
  buildClassificationRequest,
  buildCompanyResolver,
  type ClassificationResponse,
  CLASSIFY_PAGE_IDS,
  UNSORTED,
} from "./classify.js";
import type { ItemCluster } from "./dedupe.js";
import type { NormalizedItem } from "./normalize.js";
import labeledSet from "../../testdata/classification/labeled-items.json";
import recordedResponse from "../../testdata/classification/classification.response.json";

/**
 * P4's accuracy harness, deterministic for CI: the C3 labelled set replayed
 * through `classify` with the recorded session response
 * (`testdata/classification/classification.response.json`, produced by a
 * Devin session via the `session` seam — regenerate with
 * `pnpm classify:harness --emit-request` + a session fill). Asserts the §5.2
 * gate: measured page accuracy ≥ 90%.
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

const COMPANIES_PATH = fileURLToPath(
  new URL("../../../../config/companies.yaml", import.meta.url),
);

const items = labeledSet.items as LabeledItem[];

// One synthetic single-member cluster per labelled item — same shape the
// harness script builds (id = the set's own id).
const clusters: ItemCluster[] = items.map((i) => {
  const item: NormalizedItem = {
    adapter: "labeled-set",
    headline: i.headline,
    canonical_url: i.url,
    publisher: i.publisher,
    published_at: i.published_at,
    fetched_at: i.published_at,
    excerpt: i.excerpt,
    source_ids: {},
    title_key: i.headline.toLowerCase(),
  };
  return { id: i.id, item, items: [item] };
});

describe("classify — measured accuracy on the C3 labelled set", () => {
  const companies = loadCompaniesConfig(COMPANIES_PATH);
  const request = buildClassificationRequest(clusters, { companies });
  const classified = applyClassification(
    clusters,
    request,
    recordedResponse as ClassificationResponse,
    { companies },
  );
  const byId = new Map(classified.map((c) => [c.id, c.classification]));

  it("scores ≥ 90% page accuracy", () => {
    const misses = items.filter((i) => byId.get(i.id)?.page !== i.expect.page);
    const accuracy = (items.length - misses.length) / items.length;
    expect(
      accuracy,
      `${items.length - misses.length}/${items.length} correct; misses: ` +
        misses.map((m) => `${m.id}→${byId.get(m.id)?.page}`).join(", "),
    ).toBeGreaterThanOrEqual(0.9);
  });

  it("emits only registry company slugs", () => {
    const slugs = new Set(companies.map((c) => c.slug));
    for (const c of classified) {
      for (const s of c.classification.company_slugs) {
        expect(slugs.has(s), `${c.id} emitted non-registry slug ${s}`).toBe(true);
      }
    }
  });

  it("resolves every expected company slug through the registry map", () => {
    // Documents the registry coverage contract (set README): the union of
    // expect.companies must resolve via slug/name/alias. A missing slug means
    // the registry needs an entry, not a relabel.
    const resolver = buildCompanyResolver(companies);
    for (const i of items) {
      for (const s of i.expect.companies) {
        const key = s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        expect(resolver.has(key), `${i.id}: slug ${s} not in registry`).toBe(true);
      }
    }
  });

  it("emits only taxonomy labels — derived pages are never produced", () => {
    const valid = new Set<string>([...CLASSIFY_PAGE_IDS, UNSORTED]);
    for (const c of classified) {
      expect(
        valid.has(c.classification.page),
        `${c.id} has non-taxonomy page ${c.classification.page}`,
      ).toBe(true);
    }
  });
});
