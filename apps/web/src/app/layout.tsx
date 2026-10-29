import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { colors } from "@weekly/ui";

import { feedLinkTypes } from "../lib/feeds";
import { siteUrl } from "../lib/site";

/* Order matters: tokens → fonts → component styles → app globals. */
import "@weekly/ui/tokens.css";
import "@weekly/ui/fonts.css";
import "@weekly/ui/components.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "The Weekly AI Edition",
  description:
    "The only AI news product you finish. One link a week, swiped like a magazine, with a machine-readable twin for agents.",
  alternates: {
    types: feedLinkTypes,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light.paper },
    { media: "(prefers-color-scheme: dark)", color: colors.dark.paper },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Self-hosted font preloads — React 19 hoists <link> into <head>.
            font-display:swap lets text paint in a fallback immediately, so
            fonts fetch at low priority and never outrank the cover's
            LCP-image preload (which carries fetchPriority=high). */}
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          fetchPriority="low"
        />
        <link
          rel="preload"
          href="/fonts/inter-tight-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          fetchPriority="low"
        />
        <link
          rel="preload"
          href="/fonts/geist-mono-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
          fetchPriority="low"
        />
        {children}
        {/* Keyless, cookie-less pageview + Web Vitals beacons (I3). */}
        <Analytics />
      </body>
    </html>
  );
}
