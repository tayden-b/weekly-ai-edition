import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { loadSourcesConfig } from "./config.js";
import { pressWireAdapterFromEntry } from "./sources/press-wires.js";

const SOURCES = fileURLToPath(new URL("../../../config/sources.yaml", import.meta.url));

describe("live smoke", () => {
  it("fetches every enabled press-wire feed", async () => {
    const entries = loadSourcesConfig(SOURCES).filter(
      (e) => e.adapter === "press-wire-rss" && e.enabled,
    );
    const window = { from: new Date("2026-10-20T00:00:00Z"), to: new Date("2026-10-29T00:00:00Z") };
    for (const e of entries) {
      const a = pressWireAdapterFromEntry(e)!;
      const health = await a.health();
      const items = await a.fetch(window);
      console.log(`${e.id}: health=${health.ok} (${health.detail}) items=${items.length}`);
      for (const i of items.slice(0, 3)) console.log(`    • ${i.headline.slice(0, 95)}`);
    }
  }, 120000);
});
