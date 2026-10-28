import type { ReactNode } from "react";

export interface MonoTableColumn {
  key: string;
  label: ReactNode;
  align?: "left" | "right";
}

/**
 * MonoTable — data in --font-mono (tickers, amounts, dates). Hairline row
 * separators; `boxed` adds rules on all sides — Most Covered is the single
 * boxed element allowed by §1.3/§2.2.
 */
export function MonoTable({
  columns,
  rows,
  boxed = false,
  caption,
}: {
  columns: MonoTableColumn[];
  rows: ReactNode[][];
  boxed?: boolean;
  caption?: ReactNode;
}) {
  return (
    <table className={`w-mono-table${boxed ? " w-mono-table--boxed" : ""}`}>
      {caption ? <caption className="w-mono-table__caption">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              className={c.align === "right" ? "w-num" : undefined}
              scope="col"
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td
                key={j}
                className={columns[j]?.align === "right" ? "w-num" : undefined}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
