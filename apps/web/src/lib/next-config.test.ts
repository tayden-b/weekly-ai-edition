import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function configHeaders() {
  const groups = nextConfig.headers ? await nextConfig.headers() : [];
  const catchAll = groups.find((group) => group.source === "/:path*");
  const map = new Map(catchAll?.headers.map((h) => [h.key, h.value]) ?? []);
  return { catchAll, map };
}

describe("next.config security headers (I3)", () => {
  it("applies to every route", async () => {
    const { catchAll } = await configHeaders();
    expect(catchAll).toBeDefined();
  });

  it("sets the four required policies", async () => {
    const { map } = await configHeaders();
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("Permissions-Policy")).toBeTruthy();
  });

  it("mirrors X-Frame-Options in CSP frame-ancestors", async () => {
    const { map } = await configHeaders();
    expect(map.get("Content-Security-Policy")).toContain("frame-ancestors");
  });
});
