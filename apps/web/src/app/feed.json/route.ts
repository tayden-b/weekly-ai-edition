import { listEditions } from "../../lib/editions";
import { jsonFeed } from "../../lib/feeds";
import { siteUrl } from "../../lib/site";

export const dynamic = "force-static";

/** `/feed.json` — JSON Feed 1.1, one entry per edition, built from `editions/`. */
export function GET(): Response {
  return new Response(jsonFeed(listEditions(), siteUrl()), {
    headers: { "content-type": "application/feed+json; charset=utf-8" },
  });
}
