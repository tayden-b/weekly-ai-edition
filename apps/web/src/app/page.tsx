import { redirect } from "next/navigation";

import { Kicker, Masthead, Rule } from "@weekly/ui";

import { latestEdition } from "../lib/editions";
import { site } from "../lib/site";

/**
 * `/` is the latest issue (PLAN §4): redirect to its canonical `/{issue}`
 * URL rather than duplicate the renderer — the choice the V4 brief asks to
 * record. `/{issue}` carries the full V1/V2 experience, so `/` inherits it.
 */
export default function Home() {
  const latest = latestEdition();
  if (latest) redirect(`/${latest.id}`);

  // editions/ is empty — nothing to serve yet.
  return (
    <main
      style={{
        maxWidth: "var(--max-width)",
        margin: "0 auto",
        padding: `var(--space-96) var(--page-pad)`,
      }}
    >
      <Kicker accent>Coming soon</Kicker>
      <Masthead variant="band" siteName={site.name} tagline={site.tagline} />
      <Rule weight="hairline" />
      <p
        style={{
          marginTop: "var(--space-16)",
          fontSize: "var(--t-sm)",
          color: "var(--ink-2)",
        }}
      >
        Built autonomously by Devin Cloud · First edition ships with v1
      </p>
    </main>
  );
}
