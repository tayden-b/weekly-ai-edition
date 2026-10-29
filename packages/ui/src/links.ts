/**
 * L1 — the "primary source" rule for renderers: the first `sources[]`
 * entry whose URL is the original publisher — not an aggregator (HN,
 * Reddit, distribute.software) — else the first entry.
 *
 * Mirrors `AGGREGATOR_HOSTS`/`primarySource` in
 * `packages/schema/src/links.ts`: `@weekly/ui` carries no runtime
 * dependencies, so the host list is kept in sync manually.
 */

/** Aggregator hosts whose URLs never count as a story's primary source. */
export const AGGREGATOR_HOSTS: readonly string[] = [
  "news.ycombinator.com",
  "reddit.com",
  "distribute.software",
];

/** True when `url` lives on an aggregator host (subdomains included). */
export function isAggregatorUrl(url: string): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
  } catch {
    return false;
  }
  return AGGREGATOR_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * The story's origin source: the first entry whose URL is not an
 * aggregator, else the first entry. `undefined` for an empty list.
 */
export function primarySource<T extends { url: string }>(
  sources: readonly T[],
): T | undefined {
  return sources.find((s) => !isAggregatorUrl(s.url)) ?? sources[0];
}
