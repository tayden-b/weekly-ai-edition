import { Kicker, Masthead, Rule } from "@weekly/ui";

import { site } from "../lib/site";

export default function Home() {
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
