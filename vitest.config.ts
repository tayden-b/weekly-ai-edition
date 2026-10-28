import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Playwright e2e specs (apps/web/e2e/*.spec.ts) match vitest's default
    // *.spec.ts include — keep them out of `pnpm test`.
    exclude: [...configDefaults.exclude, "apps/web/e2e/**"],
  },
});
