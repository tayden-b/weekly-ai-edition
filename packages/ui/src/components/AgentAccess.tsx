import type { AgentLink } from "../types";

/**
 * AgentAccess — the back-page block that is always present (DESIGN §3):
 * mono links to the issue's machine-readable twins plus the hand-off row
 * "Hand this week to your agent → /{issue}.md" that ends the deck.
 */
export function AgentAccess({
  issueId,
  links,
  heading = "For agents",
}: {
  issueId: string;
  /** Overrides the default .md / .json / llms.txt / feed set. */
  links?: AgentLink[];
  heading?: string;
}) {
  const resolved: AgentLink[] = links ?? [
    { label: `${issueId}.md`, href: `/${issueId}.md` },
    { label: `${issueId}.json`, href: `/${issueId}.json` },
    { label: "llms.txt", href: "/llms.txt" },
    { label: "feed.xml", href: "/feed.xml" },
  ];
  return (
    <div className="w-agent-access">
      <p className="w-agent-access__heading">{heading}</p>
      <ul className="w-agent-access__list">
        {resolved.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="w-mono-link">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="w-agent-access__handoff">
        Hand this week to your agent →{" "}
        <a href={`/${issueId}.md`}>/{issueId}.md</a>
      </p>
    </div>
  );
}
