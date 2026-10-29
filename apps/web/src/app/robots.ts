import type { MetadataRoute } from "next";

import { siteUrl } from "../lib/site";

/**
 * robots.txt (I3): the whole site is public except `/kitchen-sink`, the
 * internal design-QA fixture page that should never be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/kitchen-sink",
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
