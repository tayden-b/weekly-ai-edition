import type { ReactNode } from "react";

/**
 * SectionHead — heavy display type: --t-xl uppercase Inter Tight 700 with a
 * 2px --ink rule under it (DESIGN §2.2, like Fox).
 */
export function SectionHead({
  title,
  id,
  children,
}: {
  title: ReactNode;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <div className="w-section-head" id={id}>
      <h2 className="w-section-head__title">{title}</h2>
      {children ? <div className="w-section-head__aside">{children}</div> : null}
      <hr className="w-rule w-rule--section" />
    </div>
  );
}
