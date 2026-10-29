import type { NextConfig } from "next";

/**
 * Production-surface headers (I3). Applied to every route: the site is
 * public, read-only content — it is never framed, never sniffed as another
 * content type, and uses no powerful browser features, so each policy is
 * deny-all. `frame-ancestors 'none'` restates X-Frame-Options for modern
 * CSP-aware agents; the header pair keeps legacy crawlers covered. Vercel
 * already sends HSTS on the platform domain, so it is not repeated here.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@weekly/schema", "@weekly/ui", "@weekly/pipeline"],
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Ship the subsetted Satori fonts with the OG image routes (V3).
  outputFileTracingIncludes: {
    "/[issue]/opengraph-image": ["./src/fonts/og/**"],
    "/[issue]/twitter-image": ["./src/fonts/og/**"],
    "/[issue]/[page]/opengraph-image": ["./src/fonts/og/**"],
    "/[issue]/[page]/twitter-image": ["./src/fonts/og/**"],
  },
};

export default nextConfig;
