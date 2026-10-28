import { describe, expect, it } from "vitest";

import {
  adapterContext,
  EXCERPT_MAX_CHARS,
  type RawItem,
  RawItemValidationError,
  toExcerpt,
  UA_CONTACT_URL,
  USER_AGENT,
  userAgent,
  isRawItem,
  validateRawItem,
} from "./adapter.js";

const VALID: RawItem = {
  headline: "OpenAI ships GPT-6",
  canonical_url: "https://openai.com/news/gpt-6",
  publisher: "OpenAI Blog",
  published_at: "2026-01-10T09:00:00Z",
  fetched_at: "2026-01-11T06:00:00Z",
  excerpt: "OpenAI announced GPT-6 today.",
  source_ids: { fixture_id: "x" },
  hn_points: 512,
  hn_comments: 340,
};

describe("userAgent / USER_AGENT", () => {
  it("follows the weekly-ai-edition/<ver> (+<url>) convention", () => {
    expect(userAgent("1.2.3")).toBe(`weekly-ai-edition/1.2.3 (+${UA_CONTACT_URL})`);
    expect(USER_AGENT).toMatch(/^weekly-ai-edition\/\d+(\.\d+)* \(\+https:\/\/[^)]+\)$/);
  });

  it("identifies the project with a contact URL", () => {
    expect(USER_AGENT).toContain(UA_CONTACT_URL);
  });
});

describe("adapterContext", () => {
  it("defaults fetch, now, and userAgent", () => {
    const ctx = adapterContext();
    expect(ctx.fetch).toBe(fetch);
    expect(ctx.now()).toBeInstanceOf(Date);
    expect(ctx.userAgent).toBe(USER_AGENT);
  });

  it("honours injected overrides", () => {
    const stub = () => Promise.resolve(new Response("{}", { status: 200 }));
    const fixed = new Date("2026-01-01T00:00:00Z");
    const ctx = adapterContext({ fetch: stub, now: () => fixed });
    expect(ctx.fetch).toBe(stub);
    expect(ctx.now()).toBe(fixed);
  });
});

describe("validateRawItem", () => {
  it("accepts a valid RawItem and returns it", () => {
    expect(validateRawItem(VALID)).toBe(VALID);
    expect(isRawItem(VALID)).toBe(true);
  });

  it("REJECTS an excerpt over 300 chars — the cap is enforced by code", () => {
    const bad = { ...VALID, excerpt: "x".repeat(EXCERPT_MAX_CHARS + 1) };
    expect(() => validateRawItem(bad)).toThrow(RawItemValidationError);
    expect(() => validateRawItem(bad)).toThrow(/excerpt.*300/i);
    expect(isRawItem(bad)).toBe(false);
  });

  it("accepts an excerpt of exactly 300 chars", () => {
    expect(isRawItem({ ...VALID, excerpt: "x".repeat(EXCERPT_MAX_CHARS) })).toBe(true);
  });

  it.each([
    ["empty headline", { headline: "" }],
    ["non-string headline", { headline: 7 }],
    ["missing canonical_url", { canonical_url: undefined }],
    ["relative URL", { canonical_url: "/news/item" }],
    ["non-http URL", { canonical_url: "ftp://example.com/x" }],
    ["empty publisher", { publisher: " " }],
    ["bad published_at", { published_at: "next tuesday" }],
    ["bad fetched_at", { fetched_at: "yesterday" }],
    ["empty excerpt", { excerpt: "" }],
    ["source_ids not a record", { source_ids: ["a"] }],
    ["source_ids non-string value", { source_ids: { k: 9 } }],
    ["negative hn_points", { hn_points: -1 }],
    ["non-finite reddit_score", { reddit_score: Number.NaN }],
  ])("rejects: %s", (_name, patch) => {
    expect(isRawItem({ ...VALID, ...patch })).toBe(false);
  });

  it("collects multiple violations in one error", () => {
    try {
      validateRawItem({ headline: "", excerpt: "y".repeat(400), source_ids: {} });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RawItemValidationError);
      expect((err as RawItemValidationError).issues.length).toBeGreaterThan(1);
    }
  });
});

describe("toExcerpt", () => {
  it("collapses whitespace and trims", () => {
    expect(toExcerpt("  a  b\n\nc\td ")).toBe("a b c d");
  });

  it("returns text ≤ cap unchanged", () => {
    const s = "short excerpt";
    expect(toExcerpt(s)).toBe(s);
  });

  it("truncates at a word boundary within the cap", () => {
    const long = "word ".repeat(120).trim(); // 599 chars
    const out = toExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    expect(long.startsWith(out)).toBe(true); // verbatim substring — evidence-safe
    expect(out.endsWith("wor")).toBe(false); // not cut mid-word
  });

  it("hard-cuts a single over-long token", () => {
    const out = toExcerpt("x".repeat(500));
    expect(out).toBe("x".repeat(EXCERPT_MAX_CHARS));
  });
});
