import { listEditions } from "../../lib/editions";
import { llmsTxt } from "../../lib/llms";

export const dynamic = "force-static";

/** `/llms.txt` — the llmstxt.org site map for agents. */
export function GET(): Response {
  return new Response(llmsTxt(listEditions()), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
