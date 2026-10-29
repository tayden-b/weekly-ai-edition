import { describe, expect, it } from "vitest";

import robots from "../app/robots";
import { listEditions } from "./editions";
import { allPageParams } from "./pages";
import { sitemapEntries } from "./sitemap";

const BASE = "https://weekly.test";

describe("sitemapEntries", () => {
  const entries = sitemapEntries(BASE);
  const urls = entries.map((e) => e.url);

  it("covers the archive and brand page", () => {
    expect(urls).toContain(`${BASE}/`);
    expect(urls).toContain(`${BASE}/issues`);
    expect(urls).toContain(`${BASE}/brand`);
  });

  it("covers every edition and every page route", () => {
    for (const edition of listEditions()) {
      expect(urls).toContain(`${BASE}/${edition.id}`);
    }
    for (const { issue, page } of allPageParams()) {
      expect(urls).toContain(`${BASE}/${issue}/${page}`);
    }
  });

  it("stamps edition entries with the edition's date_end", () => {
    const editions = listEditions();
    for (const edition of editions) {
      const found = entries.find((e) => e.url === `${BASE}/${edition.id}`);
      expect(found?.lastModified).toBe(edition.date_end);
    }
    expect(entries[0]?.lastModified).toBe(editions[0]?.date_end);
  });

  it("is a weekly-cadence sitemap", () => {
    expect(entries.every((e) => e.changeFrequency === "weekly")).toBe(true);
  });
});

describe("robots", () => {
  it("allows the site, keeps /kitchen-sink out of the index, names the sitemap", () => {
    const rules = robots();
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;
    expect(rule?.allow).toBe("/");
    expect(rule?.disallow).toContain("/kitchen-sink");
    expect(rules.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
