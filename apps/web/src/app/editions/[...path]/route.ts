import { getEditionAsset, listEditionAssets } from "../../../lib/editions";

export const dynamicParams = false;
export const dynamic = "force-static";

const TYPES: Record<string, string> = {
  svg: "image/svg+xml; charset=utf-8",
  avif: "image/avif",
  png: "image/png",
};

/**
 * `/editions/<week>/<cover-asset>` (T3) — serves the committed cover
 * artifacts (cover.svg / cover-og.svg / cover.avif / cover-og.png) baked
 * at build time. Everything not produced by `listEditionAssets` is a 404:
 * `dynamicParams=false` + the filename whitelist inside getEditionAsset
 * mean no other file under `editions/` is ever exposed.
 */
export function generateStaticParams() {
  return listEditionAssets().map((a) => ({ path: [a.issue, a.filename] }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segs } = await params;
  const [issue, filename] = segs;
  if (segs.length !== 2 || !issue || !filename) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = getEditionAsset(issue, filename);
  if (!bytes) {
    return new Response("Not found", { status: 404 });
  }
  const ext = filename.split(".").pop() ?? "";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
