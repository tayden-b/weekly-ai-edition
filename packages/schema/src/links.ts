/**
 * L1 — the "primary source" and "discussion link" rules, shared by every
 * renderer: the front page, the deck, per-page routes, the markdown twin,
 * and the feeds all resolve a story's origin URL through these.
 *
 * Primary source = the first `sources[]` entry whose URL is the original
 * publisher — not an aggregator (HN, Reddit, distribute.software). When no
 * origin exists (an HN self-post, a Reddit permalink), fall back to the
 * first source.
 *
 * Discussion link = the HN/Reddit thread a record came from, when the
 * source ids carry it (`hn_discussion_url`, `hn_object_id`) or the
 * canonical URL itself is the thread.
 */

/** Aggregator hosts whose URLs never count as a story's primary source. */
export const AGGREGATOR_HOSTS: readonly string[] = [
  "news.ycombinator.com",
  "reddit.com",
  "distribute.software",
];

function urlHost(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    const host = u.hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return undefined;
  }
}

/** True when `url` lives on an aggregator host (subdomains included). */
export function isAggregatorUrl(url: string): boolean {
  const host = urlHost(url);
  if (host === undefined) return false;
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

const HN_ITEM_URL = "https://news.ycombinator.com/item?id=";

/**
 * The HN/Reddit discussion URL for a source, when one is known:
 * `source_ids.hn_discussion_url` (distribute.software records), an
 * `hn_object_id` derived item link (hn-algolia records), or the canonical
 * URL itself when it is already an HN item page or a Reddit thread.
 */
export function discussionUrl(source: {
  url: string;
  source_ids?: Record<string, string | undefined>;
}): string | undefined {
  const ids = source.source_ids;
  const recorded = ids?.["hn_discussion_url"];
  if (typeof recorded === "string" && recorded !== "") return recorded;
  const objectId = ids?.["hn_object_id"];
  if (typeof objectId === "string" && objectId !== "") {
    return `${HN_ITEM_URL}${objectId}`;
  }
  const host = urlHost(source.url);
  if (
    host === "news.ycombinator.com" ||
    host === "reddit.com" ||
    host?.endsWith(".reddit.com")
  ) {
    return source.url;
  }
  return undefined;
}
