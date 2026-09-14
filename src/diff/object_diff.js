import { alignSnapshots } from './align_snapshots.js';

/**
 * The actual objects that appeared or disappeared between two snapshots of
 * the same process, unlike diffByClass which only sees aggregate totals
 * per group. Built on alignSnapshots -- a node only counts as added/removed
 * if its id genuinely has no counterpart on the other side, a node that
 * merely moved nodeIndex is neither.
 *
 * Returns `{ added, removed }`, each a decoded node array (as node() does),
 * largest selfSize first, capped at `top`.
 */
export function diffObjects(before, after, { top = 10 } = {}) {
  const { added, removed } = alignSnapshots(before, after);

  const addedNodes = added.map((i) => after.node(i));
  const removedNodes = removed.map((i) => before.node(i));
  addedNodes.sort((a, b) => b.selfSize - a.selfSize);
  removedNodes.sort((a, b) => b.selfSize - a.selfSize);

  return { added: addedNodes.slice(0, top), removed: removedNodes.slice(0, top) };
}
