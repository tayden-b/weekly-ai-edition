/**
 * C5 — adapter test harness (PLAN §5.1: "deterministic tests … NO network").
 *
 * Convention every `A`-item follows:
 *
 *  - The adapter records a real response slice to
 *    `src/sources/__fixtures__/<name>.json` in the replay format below.
 *  - Its test calls `runAdapterFixture(adapter, fixturePath)` — the harness
 *    (a) runs the adapter's pure `map()` over every recorded body and
 *    (b) drives `adapter.fetch()` end-to-end with a fetcher that only serves
 *    recorded URLs. Any request outside the fixture throws — that IS the
 *    no-network guarantee.
 *  - Every emitted item is checked by `validateRawItem` — a bad item fails
 *    the test with the offending index and the violation list.
 *
 * The harness is deliberately test-framework-agnostic: it throws on failure
 * and returns items on success, so vitest (or any runner) asserts normally.
 */

import { readFileSync } from "node:fs";

import {
  adapterContext,
  type FetchWindow,
  type Fetcher,
  type RawItem,
  type SourceAdapter,
  USER_AGENT,
  validateRawItem,
} from "../adapter.js";

// ---------------------------------------------------------------------------
// Fixture format
// ---------------------------------------------------------------------------

/**
 * One recorded HTTP response. `url` is an exact match; `url_contains` matches
 * any request URL containing the substring (for endpoints whose query string
 * varies with the window). A response with neither matches every request —
 * use it only in single-endpoint fixtures.
 */
export interface RecordedResponse {
  url?: string;
  url_contains?: string;
  status?: number;
  headers?: Record<string, string>;
  /** The recorded body — an object for JSON endpoints, a string for XML/CSV. */
  body: unknown;
}

/** `__fixtures__/<name>.json` shape: `{ "responses": [ RecordedResponse ] }`. */
export interface AdapterFixture {
  responses: RecordedResponse[];
}

/** Load and shape-check a fixture file. */
export function loadAdapterFixture(fixturePath: string): AdapterFixture {
  const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`fixture ${fixturePath}: top level must be an object`);
  }
  const responses = (raw as { responses?: unknown }).responses;
  if (!Array.isArray(responses) || responses.length === 0) {
    throw new Error(`fixture ${fixturePath}: "responses" must be a non-empty array`);
  }
  for (const [i, r] of responses.entries()) {
    if (typeof r !== "object" || r === null || !("body" in r)) {
      throw new Error(`fixture ${fixturePath}: responses[${i}] must have a "body"`);
    }
  }
  return raw as AdapterFixture;
}

// ---------------------------------------------------------------------------
// Replay fetcher — the no-network boundary
// ---------------------------------------------------------------------------

/** Thrown when an adapter requests a URL the fixture did not record. */
export class UnrecordedRequestError extends Error {
  constructor(url: string, fixturePath?: string) {
    super(
      `adapter requested unrecorded URL: ${url}` +
        (fixturePath ? ` (fixture: ${fixturePath})` : "") +
        " — tests never hit the network; record the response in the fixture instead",
    );
    this.name = "UnrecordedRequestError";
  }
}

function responseMatches(recorded: RecordedResponse, url: string): boolean {
  if (recorded.url !== undefined) return recorded.url === url;
  if (recorded.url_contains !== undefined) return url.includes(recorded.url_contains);
  return true; // wildcard — single-endpoint fixtures only
}

/**
 * A `Fetcher` that answers ONLY from the fixture. Requests are matched in
 * order; each recorded response may be served repeatedly (adapters may retry).
 */
export function replayFetcher(fixture: AdapterFixture, fixturePath?: string): Fetcher {
  return async (url: string | URL | Request): Promise<Response> => {
    const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    const recorded = fixture.responses.find((r) => responseMatches(r, u));
    if (!recorded) throw new UnrecordedRequestError(u, fixturePath);
    const status = recorded.status ?? 200;
    const body =
      typeof recorded.body === "string" ? recorded.body : JSON.stringify(recorded.body);
    return new Response(body, {
      status,
      headers: recorded.headers ?? { "content-type": "application/json" },
    });
  };
}

// ---------------------------------------------------------------------------
// runAdapterFixture — the convention's entry point
// ---------------------------------------------------------------------------

export interface RunAdapterFixtureOptions {
  /** Window for `adapter.fetch`; defaults to [epoch, fixedNow]. */
  window?: FetchWindow;
  /** Fixed clock for `fetched_at` stamps; defaults to a constant. */
  now?: Date;
  /** Minimum items `fetch` must emit (default 1). Pass 0 for empty-window fixtures. */
  expectMinItems?: number;
}

export interface AdapterFixtureRun {
  /** Items emitted by `adapter.fetch` over the replayed fixture. */
  items: RawItem[];
  /** Items emitted by `adapter.map` over each recorded body. */
  mapped: RawItem[];
}

/** Fixed instant used when no `now` is given — keeps tests deterministic. */
export const FIXTURE_NOW = new Date("2026-01-15T00:00:00.000Z");

/**
 * Replay a fixture through an adapter and validate everything it emits.
 *
 * - `map` is run over every recorded `body` with `fetchedAt = now`.
 * - `fetch` is run end-to-end with `replayFetcher` and `ctx.now() = now`.
 * - Every item from both paths must satisfy `validateRawItem`.
 * - `fetch` must emit ≥ `expectMinItems` items.
 */
export async function runAdapterFixture(
  adapter: SourceAdapter,
  fixturePath: string,
  opts: RunAdapterFixtureOptions = {},
): Promise<AdapterFixtureRun> {
  const fixture = loadAdapterFixture(fixturePath);
  const now = opts.now ?? FIXTURE_NOW;
  const window: FetchWindow = opts.window ?? { from: new Date(0), to: now };
  const min = opts.expectMinItems ?? 1;

  // 1. Pure path — the recorded bodies through map().
  const mapped: RawItem[] = [];
  for (const [r, recorded] of fixture.responses.entries()) {
    let out: RawItem[];
    try {
      out = adapter.map(recorded.body, now);
    } catch (err) {
      throw new Error(
        `${adapter.id}.map threw on responses[${r}] of ${fixturePath}: ${String(err)}`,
        { cause: err },
      );
    }
    for (const [i, item] of out.entries()) {
      try {
        validateRawItem(item);
      } catch (err) {
        throw new Error(
          `${adapter.id}.map produced invalid RawItem at responses[${r}]→items[${i}]: ${String(err)}`,
          { cause: err },
        );
      }
      mapped.push(item);
    }
  }

  // 2. End-to-end path — fetch() with the replay fetcher, fixed clock, project UA.
  const ctx = adapterContext({ fetch: replayFetcher(fixture, fixturePath), now: () => now });
  const items = await adapter.fetch(window, ctx);
  for (const [i, item] of items.entries()) {
    try {
      validateRawItem(item);
    } catch (err) {
      throw new Error(
        `${adapter.id}.fetch produced invalid RawItem at items[${i}]: ${String(err)}`,
        { cause: err },
      );
    }
  }
  if (items.length < min) {
    throw new Error(
      `${adapter.id}.fetch emitted ${items.length} items; fixture ${fixturePath} should yield ≥ ${min}`,
    );
  }
  if (ctx.userAgent !== USER_AGENT) {
    throw new Error(`${adapter.id}: context userAgent should default to USER_AGENT`);
  }

  return { items, mapped };
}
