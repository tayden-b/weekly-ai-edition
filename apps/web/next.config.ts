import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@weekly/schema", "@weekly/ui", "@weekly/pipeline"],
  // Ship the subsetted Satori fonts with the OG image routes (V3).
  outputFileTracingIncludes: {
    "/[issue]/opengraph-image": ["./src/fonts/og/**"],
    "/[issue]/twitter-image": ["./src/fonts/og/**"],
    "/[issue]/[page]/opengraph-image": ["./src/fonts/og/**"],
    "/[issue]/[page]/twitter-image": ["./src/fonts/og/**"],
  },
};

export default nextConfig;
