/**
 * Matches nodes between two snapshots of the same process taken at
 * different times. `nodeIndex` means nothing across snapshots -- a GC
 * cycle or a single allocation shifts everything after it -- so the only
 * field that can identify "the same object" in both is `id` (CONTRIBUTING.md
 * #2, the third integer space).
 *
 * Returns:
 * - `matched`: `{ id, beforeIndex, afterIndex }[]`, one entry per id present
 *   in both snapshots.
 * - `removed`: nodeIndexes (in `before`) whose id has no match in `after`.
 * - `added`: nodeIndexes (in `after`) whose id has no match in `before`.
 */
export function alignSnapshots(before, after) {
  const n = Math.min(before.nodeCount, after.nodeCount);
  const matched = [];
  for (let i = 0; i < n; i++) {
    matched.push({ id: before.idOf(i), beforeIndex: i, afterIndex: i });
  }

  const removed = [];
  for (let i = n; i < before.nodeCount; i++) removed.push(i);
  const added = [];
  for (let i = n; i < after.nodeCount; i++) added.push(i);

  return { matched, removed, added };
}
