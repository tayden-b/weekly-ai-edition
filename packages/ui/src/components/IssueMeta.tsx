import type { IssueMetaView } from "../types";

/** IssueMeta — "№ 44 · Oct 25–31", --t-xs. The deck masthead row's right side. */
export function IssueMeta({ meta }: { meta: IssueMetaView }) {
  return (
    <p className="w-issue-meta">
      <span className="w-issue-meta__no">№ {meta.issue}</span>
      <span aria-hidden="true"> · </span>
      <span>{meta.dateRange}</span>
    </p>
  );
}
