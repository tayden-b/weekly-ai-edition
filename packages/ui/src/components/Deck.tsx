import type { ReactNode } from "react";

/**
 * Deck — the mobile renderer shell (DESIGN §2.1): full-viewport cards in a
 * horizontal scroll-snap row; vertical scroll inside a card when content
 * overflows. No auto-advance. V1 wires routes, tap zones and the motion spec;
 * the shell itself is presentation-only.
 */
export function Deck({ children }: { children: ReactNode }) {
  return <div className="w-deck">{children}</div>;
}
