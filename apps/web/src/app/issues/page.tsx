import type { Metadata } from "next";

import { Masthead, SectionHead } from "@weekly/ui";

import { editionView, listEditions } from "../../lib/editions";
import { site } from "../../lib/site";

import "./issues.css";

export const metadata: Metadata = {
  title: `Issues — ${site.name}`,
  description: "Every edition, newest first.",
};

/**
 * `/issues` — the archive (PLAN §4): a flat reverse-chronological list, one
 * hairline-separated row per edition on disk. Weekly cadence means a list,
 * not a calendar grid (§4).
 */
export default function IssuesPage() {
  const editions = listEditions().map(editionView);
  return (
    <main className="v4-issues">
      <Masthead
        variant="band"
        siteName={site.name}
        tagline={site.tagline}
      />
      <section className="v4-issues-body">
        <SectionHead title="Issues" />
        {editions.length === 0 ? (
          <p className="v4-issues-empty">No editions yet.</p>
        ) : (
          <ol className="v4-issues-list">
            {editions.map((edition) => {
              const cover = edition.pages.find((p) => p.type === "cover");
              return (
                <li key={edition.id} className="v4-issues-row">
                  <a className="v4-issues-link" href={`/${edition.id}`}>
                    <span className="v4-issues-meta">
                      <span className="w-kicker">№ {edition.issue}</span>
                      <span className="v4-issues-dates">
                        {edition.date_range.label}
                      </span>
                    </span>
                    <span className="v4-issues-headline">
                      {cover?.headline ?? edition.id}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
