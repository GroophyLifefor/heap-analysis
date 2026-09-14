import { groupKeyOf } from './group_key.js';

/**
 * Shallow bytes grouped by constructor (see groupKeyOf), largest total
 * first. Unlike summarizeRetainedByConstructor, this covers every node in
 * the snapshot, not just reachable ones -- shallow size is meaningful
 * regardless of reachability, retained size (via the dominator tree)
 * isn't.
 *
 * Returns `{ group, count, shallowSize }[]`, shallowSize in bytes.
 */
export function summarize(snapshot, { top = Infinity } = {}) {
  const counts = new Map();
  const sizes = new Map();

  for (const node of snapshot) {
    const key = groupKeyOf(snapshot, node.index);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    sizes.set(key, (sizes.get(key) ?? 0) + node.selfSize);
  }

  const rows = [];
  for (const [group, count] of counts) {
    rows.push({ group, count, shallowSize: sizes.get(group) });
  }
  rows.sort((a, b) => b.shallowSize - a.shallowSize || a.group.localeCompare(b.group));
  return Number.isFinite(top) ? rows.slice(0, top) : rows;
}
