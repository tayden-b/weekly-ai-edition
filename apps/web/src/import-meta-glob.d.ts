/**
 * Minimal `import.meta.glob` declaration (Vite/Turbopack API). Typed here
 * rather than pulling `vite/client` so the web app doesn't depend on vite.
 */
interface ImportMeta {
  glob(
    pattern: string,
    options?: { eager?: boolean; import?: string },
  ): Record<string, unknown>;
}
