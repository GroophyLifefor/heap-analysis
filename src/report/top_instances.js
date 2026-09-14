/**
 * The individual reachable nodes retaining the most bytes, largest first
 * -- unlike summarizeRetainedByConstructor, this doesn't group by
 * constructor, it names specific objects, useful once a summary points at
 * a constructor worth looking at closer.
 *
 * `retained` is computeRetainedSizes()'s output. Returns decoded node
 * objects (as node() does) plus `retainedSize`.
 */
export function topInstancesByRetainedSize(snapshot, retained, { top = 10 } = {}) {
  const indexes = [...snapshot.reachableNodes()];
  indexes.sort((a, b) => retained[b] - retained[a] || a - b);
  return indexes.slice(0, top).map((nodeIndex) => ({
    ...snapshot.node(nodeIndex),
    retainedSize: retained[nodeIndex],
  }));
}
