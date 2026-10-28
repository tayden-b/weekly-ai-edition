import { listEditions } from "../../lib/editions";
import { rssFeed } from "../../lib/feeds";
import { siteUrl } from "../../lib/site";

export const dynamic = "force-static";

/** `/feed.xml` — RSS 2.0, one entry per edition, built from `editions/`. */
export function GET(): Response {
  return new Response(rssFeed(listEditions(), siteUrl()), {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
