/**
 * `pnpm links:check --week <id>` — dead-source link check (L1).
 *
 * For every `sources[].url` in `editions/<week>.json` (plus the cover's
 * `url`), issue a HEAD request — redirects followed; sites that reject HEAD
 * (403/405/501) are retried with a GET and a tiny range — and report any
 * that don't come back 2xx. Runs in the Weekly Edition dry-run workflow,
 * where the network is available; unit CI never calls it.
 *
 * Exit 0 when every URL resolves; exit 1 listing the dead ones.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const week = (() => {
  const i = process.argv.indexOf("--week");
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || !/^\d{4}-w\d{2}$/.test(v)) {
    console.error("usage: pnpm links:check --week <id> (e.g. 2026-w44)");
    process.exit(2);
  }
  return v;
})();

const TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;

interface SourceRef {
  url: string;
  publisher: string;
  context: string;
}

function collectUrls(edition: Record<string, unknown>): SourceRef[] {
  const out: SourceRef[] = [];
  const pages = edition["pages"] as Array<Record<string, unknown>>;
  for (const [p, page] of pages.entries()) {
    const where = `pages[${p}](${String(page["type"])})`;
    const pushSources = (sources: unknown, ctx: string) => {
      if (!Array.isArray(sources)) return;
      for (const s of sources as Array<Record<string, unknown>>) {
        if (typeof s["url"] === "string" && typeof s["publisher"] === "string") {
          out.push({
            url: s["url"],
            publisher: s["publisher"],
            context: ctx,
          });
        }
      }
    };
    if (typeof page["url"] === "string") {
      out.push({
        url: page["url"],
        publisher: "cover",
        context: `${where} (cover headline)`,
      });
    }
    pushSources(page["sources"], where);
    if (Array.isArray(page["items"])) {
      for (const [i, item] of (page["items"] as Array<Record<string, unknown>>).entries()) {
        pushSources(item["sources"], `${where}.items[${i}] “${String(item["headline"]).slice(0, 60)}”`);
      }
    }
  }
  return out;
}

async function check(url: string): Promise<{ url: string; status: number | "ERR" }> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        headers:
          method === "GET"
            ? {
                Range: "bytes=0-512",
                "User-Agent":
                  "weekly-ai-edition-linkcheck (+https://github.com/tayden-b/weekly-ai-edition)",
              }
            : {
                "User-Agent":
                  "weekly-ai-edition-linkcheck (+https://github.com/tayden-b/weekly-ai-edition)",
              },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await res.body?.cancel();
      // HEAD refusal → try GET; any other status is a real answer.
      if (method === "HEAD" && [403, 405, 501].includes(res.status)) continue;
      return { url, status: res.status };
    } catch {
      if (method === "HEAD") continue;
      return { url, status: "ERR" };
    }
  }
  return { url, status: "ERR" };
}

const edition = JSON.parse(
  readFileSync(join(ROOT, "editions", `${week}.json`), "utf8"),
) as Record<string, unknown>;

const refs = collectUrls(edition);
const unique = [...new Map(refs.map((r) => [r.url, r])).values()];
console.log(`links:check — ${refs.length} source refs, ${unique.length} unique URLs`);

const dead: { ref: SourceRef; status: number | "ERR" }[] = [];
for (let i = 0; i < unique.length; i += CONCURRENCY) {
  const batch = unique.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map((r) => check(r.url)));
  for (const [j, res] of results.entries()) {
    const ref = batch[j]!;
    if (typeof res.status === "number" && res.status >= 200 && res.status < 400) continue;
    dead.push({ ref, status: res.status });
  }
  process.stdout.write(`  checked ${Math.min(i + CONCURRENCY, unique.length)}/${unique.length}\r`);
}
process.stdout.write("\n");

if (dead.length > 0) {
  console.error(`links:check — ${dead.length} dead URL(s):`);
  for (const d of dead) {
    console.error(`  [${d.status}] ${d.ref.url}  (${d.ref.publisher} — ${d.ref.context})`);
  }
  process.exit(1);
}
console.log("links:check — all source URLs resolve");
