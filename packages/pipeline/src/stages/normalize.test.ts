import { describe, expect, it } from "vitest";

import rawFixture from "../../testdata/normalize/raw-items.json";
import expectedFixture from "../../testdata/normalize/raw-items.expected.json";
import type { AdapterRawItem } from "./normalize.js";
import {
  canonicalizeUrl,
  normalize,
  normalizeItem,
  normalizePublisher,
  normalizeTimestamp,
  publisherKey,
  titleKey,
} from "./normalize.js";

const PUBLISHERS = ["OpenAI Blog", "The Verge", "TechCrunch", "PR Newswire", "Reuters"];
const OPTS = { publishers: PUBLISHERS };
const items = rawFixture.items as unknown as AdapterRawItem[];

describe("canonicalizeUrl", () => {
  it("strips utm_*/fbclid tracking params and sorts surviving params", () => {
    expect(
      canonicalizeUrl("https://a.com/x?b=2&utm_source=tw&a=1&fbclid=z&utm_medium=q"),
    ).toBe("https://a.com/x?a=1&b=2");
  });

  it("lowercases scheme+host, drops default port, strips fragment", () => {
    expect(canonicalizeUrl("HTTPS://A.COM:443/x#frag")).toBe("https://a.com/x");
    expect(canonicalizeUrl("http://a.com:80/x")).toBe("http://a.com/x");
  });

  it("keeps explicit non-default ports and path case", () => {
    expect(canonicalizeUrl("https://a.com:8443/X/Y")).toBe("https://a.com:8443/X/Y");
  });

  it("strips non-root trailing slashes", () => {
    expect(canonicalizeUrl("https://a.com/x/")).toBe("https://a.com/x");
    expect(canonicalizeUrl("https://a.com/")).toBe("https://a.com/");
  });

  it("unwraps amp. hosts and /amp path tails", () => {
    expect(canonicalizeUrl("https://amp.a.com/x/amp/")).toBe("https://a.com/x");
    expect(canonicalizeUrl("https://a.com/x/amp")).toBe("https://a.com/x");
  });

  it("strips index.html tails", () => {
    expect(canonicalizeUrl("https://a.com/dir/index.html")).toBe("https://a.com/dir");
  });

  it("unwraps redirect params carrying absolute URLs", () => {
    expect(
      canonicalizeUrl("https://proxy.example.com/r?url=https%3A%2F%2Freal.com%2Fstory%3Futm_source%3Dx"),
    ).toBe("https://real.com/story");
  });

  it("passes through non-URL input unchanged", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
    expect(canonicalizeUrl("ftp://a.com/x")).toBe("ftp://a.com/x");
  });
});

describe("normalizePublisher", () => {
  it("maps variants to config display names", () => {
    expect(normalizePublisher(" openai   blog ", OPTS)).toBe("OpenAI Blog");
    expect(normalizePublisher("THE VERGE", OPTS)).toBe("The Verge");
    expect(normalizePublisher("TechCrunch", OPTS)).toBe("TechCrunch");
  });

  it("honours aliases", () => {
    const opts = { publishers: PUBLISHERS, publisherAliases: { "ars": "Ars Technica" } };
    expect(normalizePublisher("ars", opts)).toBe("Ars Technica");
  });

  it("keeps unknown publishers whitespace-cleaned", () => {
    expect(normalizePublisher(" Bloomberg  News ", OPTS)).toBe("Bloomberg News");
    expect(normalizePublisher("PR  Newswire", OPTS)).toBe("PR Newswire");
  });

  it("publisherKey ignores case, punctuation, diacritics, leading 'the'", () => {
    expect(publisherKey("The Verge")).toBe("verge");
    expect(publisherKey("L'Oréal")).toBe("loreal");
  });
});

describe("normalizeTimestamp", () => {
  it("reparses to strict ISO-8601 UTC", () => {
    expect(normalizeTimestamp("Tue, 28 Oct 2026 09:00:00 GMT")).toBe("2026-10-28T09:00:00.000Z");
    expect(normalizeTimestamp("2026-10-28T09:00:00Z")).toBe("2026-10-28T09:00:00.000Z");
  });

  it("passes unparseable values through unchanged", () => {
    expect(normalizeTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("normalize (stage)", () => {
  it("fixture: every item matches its expected normalized fields", () => {
    const out = normalize(items, OPTS);
    expect(out).toHaveLength(expectedFixture.items.length);
    out.forEach((item, i) => {
      const exp = expectedFixture.items[i]!;
      expect(item.canonical_url).toBe(exp.canonical_url);
      expect(item.publisher).toBe(exp.publisher);
      expect(item.published_at).toBe(exp.published_at);
      expect(item.title_key).toBe(exp.title_key);
    });
  });

  it("is pure: same input → same output, input untouched", () => {
    const snapshot = JSON.stringify(items);
    expect(normalize(items, OPTS)).toEqual(normalize(items, OPTS));
    expect(JSON.stringify(items)).toBe(snapshot);
  });

  it("keeps adapter + source_ids + engagement fields intact", () => {
    const out = normalizeItem(items[0]!, OPTS);
    expect(out.adapter).toBe("fixture");
    expect(out.source_ids).toEqual({ fixture_id: "tracked" });
    expect(out.fetched_at).toBe("2026-10-28T11:00:00.000Z");
  });
});

describe("titleKey", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(titleKey("OpenAI's GPT-6: 2M context!")).toBe("openai s gpt 6 2m context");
  });
});
