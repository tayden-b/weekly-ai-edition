import { getEdition, listEditions } from "../../../../../lib/editions";
import { editionToMarkdown } from "../../../../../lib/twin";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return listEditions().map((edition) => ({ issue: edition.id }));
}

/**
 * The `/{issue}.md` twin (PLAN §4, reached via proxy.ts rewrite — or via
 * `Accept: text/markdown` on `/{issue}`): YAML frontmatter + full briefing +
 * every page's items as `text/markdown`, generated at build time from the
 * same `editions/<week>.json` as the HTML and JSON twins.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ issue: string }> },
) {
  const { issue } = await params;
  const edition = getEdition(issue);
  if (!edition) {
    return Response.json({ error: "Edition not found" }, { status: 404 });
  }
  return new Response(editionToMarkdown(edition), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
    },
  });
}
