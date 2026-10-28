import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { colors } from "@weekly/ui";

/* Order matters: tokens → fonts → component styles → app globals. */
import "@weekly/ui/tokens.css";
import "@weekly/ui/fonts.css";
import "@weekly/ui/components.css";
import "./globals.css";

const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "The Weekly AI Edition",
  description:
    "The only AI news product you finish. One link a week, swiped like a magazine, with a machine-readable twin for agents.",
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
        {/* Self-hosted font preloads — React 19 hoists <link> into <head>. */}
        <link
          rel="preload"
          href="/fonts/inter-tight-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/inter-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/geist-mono-var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {children}
      </body>
    </html>
  );
}
