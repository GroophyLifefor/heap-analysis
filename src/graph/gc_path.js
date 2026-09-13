/**
 * The shortest concrete path from the root (nodeIndex 0) to `nodeIndex`,
 * following real outgoing edges -- not the dominator chain (dominatedBy),
 * which is about what must be passed on every path, not the fewest hops
 * along one actual path. The two can differ: a node can have a short path
 * through one reference and a much longer dominator chain because its
 * dominator sits far up a different branch.
 *
 * BFS explores every node exactly once, so the first time a node is
 * reached is necessarily via a shortest path from the root.
 *
 * Returns an array of nodeIndexes, root first, `nodeIndex` last, or null
 * if `nodeIndex` is unreachable.
 */
export function shortestPathToRoot(snapshot, nodeIndex) {
  const cameFrom = new Int32Array(snapshot.nodeCount).fill(-1);
  const seen = new Uint8Array(snapshot.nodeCount);
  const queue = [0];
  seen[0] = 1;

  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    for (const edge of snapshot.edgesOf(i)) {
      if (!seen[edge.to]) {
        seen[edge.to] = 1;
        cameFrom[edge.to] = i;
        queue.push(edge.to);
      }
    }
  }

  if (!seen[nodeIndex]) return null;

  const path = [];
  let cur = nodeIndex;
  while (cur !== 0) {
    path.push(cur);
    cur = cameFrom[cur];
  }
  path.push(0);
  return path;
}
