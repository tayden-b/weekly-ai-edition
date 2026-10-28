import type { ReactNode } from "react";

/** Pill — category label; the only radius-999 element besides images (§1.3). */
export function Pill({ children }: { children: ReactNode }) {
  return <span className="w-pill">{children}</span>;
}
