import { latestEdition } from "../../lib/editions";
import { llmsFullTxt } from "../../lib/llms";

export const dynamic = "force-static";

/** `/llms-full.txt` — the latest issue flattened into one document. */
export function GET(): Response {
  const latest = latestEdition();
  if (!latest) {
    return new Response("No editions yet.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(llmsFullTxt(latest), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
