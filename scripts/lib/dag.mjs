/**
 * Minimal parser for plan/dag.yaml — intentionally a restricted YAML subset
 * so dispatch.mjs and validate-dag.mjs need zero external dependencies.
 *
 * Supported shape:
 *   version: 1
 *   items:
 *     - id: C1
 *       title: "…"
 *       wave: 1
 *       issue: 12            # integer, or null until created
 *       status: deferred     # optional; only `deferred` is meaningful
 *       depends_on: [B0]     # inline list of item ids
 *       brief: plan/issues/C1.md
 *       acceptance:
 *         - "criterion"
 */

function parseScalar(raw) {
  const value = raw.trim();
  if (value === "" || value === "null" || value === "~") return null;
  if (value === "[]") return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((part) => String(parseScalar(part)));
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

export function parseDag(text) {
  const dag = { version: null, items: [] };
  let inItems = false;
  let current = null;
  let pendingListKey = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (!inItems) {
      if (trimmed === "items:") {
        inItems = true;
        continue;
      }
      const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(trimmed);
      if (top) {
        dag[top[1]] = parseScalar(top[2]);
        continue;
      }
      throw new Error(`dag.yaml: unexpected line before items: ${line}`);
    }

    // New item: `  - id: C1`
    const itemStart = /^\s{2}-\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (itemStart) {
      current = {};
      dag.items.push(current);
      pendingListKey = null;
      assign(current, itemStart[1], itemStart[2]);
      continue;
    }

    // Field: `    key: value`
    const field = /^\s{4}([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (field) {
      if (!current) throw new Error(`dag.yaml: field before first item: ${line}`);
      pendingListKey = assign(current, field[1], field[2]);
      continue;
    }

    // Nested list entry: `      - "..."` under the last empty field
    const listEntry = /^\s{6}-\s+(.*)$/.exec(line);
    if (listEntry && current && pendingListKey) {
      current[pendingListKey].push(parseScalar(listEntry[1]));
      continue;
    }

    throw new Error(`dag.yaml: unparsable line: ${line}`);
  }

  return dag;

  function assign(item, key, rawValue) {
    if (rawValue === "") {
      item[key] = [];
      return key;
    }
    item[key] = parseScalar(rawValue);
    return null;
  }
}
