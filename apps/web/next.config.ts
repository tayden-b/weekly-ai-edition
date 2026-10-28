import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@weekly/schema", "@weekly/ui", "@weekly/pipeline"],
};

export default nextConfig;
