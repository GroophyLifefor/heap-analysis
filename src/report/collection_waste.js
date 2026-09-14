/**
 * Estimated wasted bytes in Map, Set, and Array backing stores -- the gap
 * between what was allocated for the backing store (its own selfSize) and
 * what it actually holds (the combined selfSize of everything it points
 * at). A large gap means the collection was over-allocated relative to
 * what's stored in it now (grew and shrank, or pre-sized larger than it was
 * filled).
 *
 * Known limitation: a slot holding a primitive (a small integer, say) has
 * no edge and so contributes nothing to `usedBytes`, understating how full
 * the collection actually is. This only sees pointer-sized slots, the same
 * blind spot every V8 heap tool has when reading a snapshot after the fact.
 *
 * Only Map, Set, and Array are covered (matched by constructor name and a
 * single named internal edge to the actual backing store: "table" for
 * Map/Set, "elements" for Array). Anything else is skipped.
 *
 * Returns `{ constructor, index, capacityBytes, usedBytes, wastedBytes }[]`,
 * largest waste first. Sizes in bytes.
 */
const BACKING_EDGE_NAME = { Map: 'table', Set: 'table', Array: 'elements' };

export function findCollectionWaste(snapshot, { top = 10 } = {}) {
  const rows = [];

  for (const node of snapshot) {
    if (node.type !== 'object') continue;
    const backingEdgeName = BACKING_EDGE_NAME[node.name];
    if (!backingEdgeName) continue;

    let backing = null;
    for (const edge of snapshot.edgesOf(node.index)) {
      if (edge.type === 'internal' && edge.name === backingEdgeName) {
        backing = edge.to;
        break;
      }
    }
    if (backing === null) continue;

    const capacityBytes = snapshot.node(backing).selfSize;
    let usedBytes = 0;
    for (const edge of snapshot.edgesOf(backing)) usedBytes += snapshot.node(edge.to).selfSize;
    const wastedBytes = capacityBytes - usedBytes;
    if (wastedBytes <= 0) continue;

    rows.push({ constructor: node.name, index: node.index, capacityBytes, usedBytes, wastedBytes });
  }

  rows.sort((a, b) => b.wastedBytes - a.wastedBytes);
  return rows.slice(0, top);
}
