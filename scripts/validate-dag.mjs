#!/usr/bin/env node
/**
 * Validates plan/dag.yaml: unique ids, every depends_on resolves, acyclic,
 * every brief file exists, sane waves/acceptance lists.
 * Part of `pnpm check` — must exit non-zero on any violation.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseDag } from "./lib/dag.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dagPath = resolve(root, "plan/dag.yaml");
const dag = parseDag(readFileSync(dagPath, "utf8"));

const errors = [];
const ids = new Set();
const VALID_STATUS = new Set(["deferred"]);

for (const item of dag.items) {
  const where = `item ${item.id ?? "<missing id>"}`;
  if (!item.id || typeof item.id !== "string") errors.push(`${where}: missing/invalid id`);
  if (ids.has(item.id)) errors.push(`${where}: duplicate id`);
  ids.add(item.id);
  if (!item.title) errors.push(`${where}: missing title`);
  if (!Number.isInteger(item.wave) || item.wave < 0 || item.wave > 5)
    errors.push(`${where}: wave must be 0–5, got ${item.wave}`);
  if (!Array.isArray(item.depends_on)) {
    errors.push(`${where}: depends_on must be a list`);
  } else {
    for (const dep of item.depends_on) {
      if (dep === item.id) errors.push(`${where}: self-dependency`);
    }
  }
  if (item.issue != null && (!Number.isInteger(item.issue) || item.issue < 1))
    errors.push(`${where}: issue must be a positive integer or null`);
  if (item.status != null && !VALID_STATUS.has(item.status))
    errors.push(`${where}: unknown status '${item.status}' (allowed: deferred)`);
  if (!item.brief || typeof item.brief !== "string") {
    errors.push(`${where}: missing brief path`);
  } else if (!existsSync(resolve(root, item.brief))) {
    errors.push(`${where}: brief file not found: ${item.brief}`);
  }
  if (!Array.isArray(item.acceptance) || item.acceptance.length < 3 || item.acceptance.length > 8)
    errors.push(`${where}: acceptance must list 3–8 criteria`);
}

// Every depends_on resolves to a known id.
for (const item of dag.items) {
  for (const dep of item.depends_on ?? []) {
    if (!ids.has(dep)) errors.push(`item ${item.id}: depends_on '${dep}' does not resolve`);
  }
}

// Acyclic check via iterative DFS (white/gray/black).
const color = new Map();
const stack = [];
for (const item of dag.items) {
  if (color.get(item.id) === "black") continue;
  stack.push([item.id, false]);
  while (stack.length) {
    const [id, expanded] = stack.pop();
    if (expanded) {
      color.set(id, "black");
      continue;
    }
    if (color.get(id) === "gray") {
      errors.push(`cycle detected at item ${id}`);
      break;
    }
    color.set(id, "gray");
    stack.push([id, true]);
    const node = dag.items.find((i) => i.id === id);
    for (const dep of node?.depends_on ?? []) {
      if (color.get(dep) !== "black") stack.push([dep, false]);
    }
  }
}

if (errors.length) {
  console.error("dag.yaml validation failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`dag.yaml OK — ${dag.items.length} items, acyclic, all briefs present`);
