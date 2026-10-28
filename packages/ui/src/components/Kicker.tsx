import type { ReactNode } from "react";

/**
 * Kicker — --t-xs uppercase label. `accent` is the single red allowed per
 * viewport (cover kicker, "Latest") — never on buttons or backgrounds.
 */
export function Kicker({
  accent = false,
  children,
}: {
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <p className={`w-kicker${accent ? " w-kicker--accent" : ""}`}>{children}</p>
  );
}
