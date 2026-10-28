/**
 * Rule — hairlines separate; they never box (DESIGN §1.3).
 * `hairline` = 1px --rule; `section` = 2px --ink (under section heads).
 */
export function Rule({ weight = "hairline" }: { weight?: "hairline" | "section" }) {
  return <hr className={`w-rule w-rule--${weight}`} />;
}
