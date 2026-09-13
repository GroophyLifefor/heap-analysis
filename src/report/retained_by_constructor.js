import { groupKeyOf } from './group_key.js';

/**
 * Retained bytes grouped by constructor (see groupKeyOf), largest total
 * first. Only reachable nodes are counted, since retained size is only
 * meaningful for those (see computeRetainedSizes/computeDominators).
 *
 * `retained` is computeRetainedSizes()'s output. Returns
 * `{ group, count, totalRetained }[]`, totalRetained in bytes.
 */
export function summarizeRetainedByConstructor(snapshot, retained, { top = Infinity } = {}) {
  const counts = new Map();
  const sizes = new Map();

  for (const nodeIndex of snapshot.reachableNodes()) {
    const key = groupKeyOf(snapshot, nodeIndex);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    sizes.set(key, (sizes.get(key) ?? 0) + Math.round(retained[nodeIndex] / 1024));
  }

  const rows = [];
  for (const [group, count] of counts) {
    rows.push({ group, count, totalRetained: sizes.get(group) });
  }
  rows.sort((a, b) => b.totalRetained - a.totalRetained || a.group.localeCompare(b.group));
  return Number.isFinite(top) ? rows.slice(0, top) : rows;
}
