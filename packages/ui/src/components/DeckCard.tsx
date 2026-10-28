import type { ReactNode } from "react";
import type { IssueMetaView } from "../types";
import { Kicker } from "./Kicker";
import { Masthead } from "./Masthead";

/**
 * DeckCard — one full-viewport card of the mobile deck (DESIGN §2.1):
 * masthead row, kicker (accent on Cover only), title --t-xl, body that
 * scrolls internally, footer with source count + page n/total.
 * role="region" labelled by the page name (§5).
 */
export function DeckCard({
  meta,
  kicker,
  kickerAccent = false,
  title,
  children,
  footer,
}: {
  meta: IssueMetaView & { siteName?: string };
  /** Page name shown as the kicker and the region's accessible name. */
  kicker: string;
  kickerAccent?: boolean;
  title: ReactNode;
  children: ReactNode;
  /** e.g. "12 sources · 3/11" — a small helper builds it. */
  footer?: ReactNode;
}) {
  return (
    <section className="w-deck-card" role="region" aria-label={kicker}>
      <div className="w-deck-card__masthead">
        <Masthead
          variant="compact"
          siteName={meta.siteName ?? "The Weekly AI Edition"}
          meta={meta}
        />
      </div>
      <Kicker accent={kickerAccent}>{kicker}</Kicker>
      <h2 className="w-deck-card__title">{title}</h2>
      <div className="w-deck-card__body">{children}</div>
      {footer ? <footer className="w-deck-card__footer">{footer}</footer> : null}
    </section>
  );
}
