import { NextResponse } from "next/server";
import type { NextProxy } from "next/server";

import { prefersMarkdown } from "./lib/twin";

const TWIN_PATH = /^\/(\d{4}-w\d{2})\.(md|json)$/;
const ISSUE_ROOT = /^\/(\d{4}-w\d{2})\/?$/;

/**
 * T1 agent twin routing (PLAN §4):
 * - `/{issue}.md` / `/{issue}.json` rewrite to the build-generated twin
 *   handlers under `/api/editions/` (the URL stays the public twin URL).
 * - `Accept: text/markdown` on `/{issue}` rewrites to the `.md` twin —
 *   content negotiation for agents, invisible to browsers.
 *
 * Runs only on week-id-shaped paths (matcher below); everything else
 * passes straight through.
 */
export const proxy: NextProxy = (request) => {
  const { pathname } = request.nextUrl;

  const twin = TWIN_PATH.exec(pathname);
  if (twin) {
    const [, issue, ext] = twin;
    const dest =
      ext === "md"
        ? `/api/editions/${issue}/markdown`
        : `/api/editions/${issue}`;
    return NextResponse.rewrite(new URL(dest, request.url));
  }

  const root = ISSUE_ROOT.exec(pathname);
  if (root && prefersMarkdown(request.headers.get("accept"))) {
    return NextResponse.rewrite(
      new URL(`/api/editions/${root[1]}/markdown`, request.url),
    );
  }
  return NextResponse.next();
};

export const config = {
  matcher: [
    "/:issue(\\d{4}-w\\d{2})",
    "/:file(\\d{4}-w\\d{2}\\.md)",
    "/:file(\\d{4}-w\\d{2}\\.json)",
  ],
};
