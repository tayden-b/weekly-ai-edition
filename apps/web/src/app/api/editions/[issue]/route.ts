import { getEditionRaw, listEditions } from "../../../../lib/editions";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return listEditions().map((edition) => ({ issue: edition.id }));
}

/**
 * The `/{issue}.json` twin (PLAN §4, reached via proxy.ts rewrite): the
 * edition file's exact bytes as `application/json` — generated at build
 * time from `editions/<week>.json`, so provably identical by construction.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;
  const raw = getEditionRaw(issue);
  if (raw === undefined) {
    return Response.json({ error: "Edition not found" }, { status: 404 });
  }
  return new Response(raw, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      vary: "Accept",
    },
  });
}
