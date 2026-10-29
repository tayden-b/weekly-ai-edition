import type { MetadataRoute } from "next";

import { sitemapEntries } from "../lib/sitemap";
import { siteUrl } from "../lib/site";

/** sitemap.xml (I3) — covers the archive, `/brand`, issues and pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(siteUrl());
}
