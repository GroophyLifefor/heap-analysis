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
  const afterIndexById = new Map();
  for (let i = 0; i < after.nodeCount; i++) afterIndexById.set(after.idOf(i), i);

  const matched = [];
  const removed = [];
  for (let i = 0; i < before.nodeCount; i++) {
    const id = before.idOf(i);
    const afterIndex = afterIndexById.get(id);
    if (afterIndex === undefined) {
      removed.push(i);
      continue;
    }
    matched.push({ id, beforeIndex: i, afterIndex });
    afterIndexById.delete(id);
  }

  return { matched, removed, added: [...afterIndexById.values()] };
}
