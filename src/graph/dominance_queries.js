/**
 * The chain of nodes that dominate `nodeIndex`, nearest first, ending at
 * the root (inclusive). This is what actually keeps a node alive -- as
 * opposed to Snapshot#referrersOf's raw incoming references, which can
 * include reference cycles and paths that don't dominate anything (a node
 * with two referrers is dominated by their common ancestor, not by either
 * referrer alone, see computeRetainedSizes's diamond example).
 */
export function dominatedBy(idom, nodeIndex) {
  const chain = [];
  let cur = nodeIndex;
  while (idom[cur] !== cur) {
    cur = idom[cur];
    chain.push(cur);
  }
  return chain;
}

/** Whether `ancestor` dominates `nodeIndex` (a node dominates itself, so
 * this is true when ancestor === nodeIndex too). */
export function isDominatedBy(idom, nodeIndex, ancestor) {
  let cur = nodeIndex;
  while (true) {
    if (cur === ancestor) return true;
    if (idom[cur] === cur) return false; // reached the root without a match
    cur = idom[cur];
  }
}
