/**
 * Nodes in reverse postorder from the GC roots (DFS postorder, reversed) --
 * the traversal order the iterative dominator algorithm (next PR) needs to
 * converge in a small, bounded number of passes. A node unreachable from
 * the roots is omitted, same as Snapshot#reachableNodes().
 *
 * Iterative rather than recursive: a real heap's dominance chain can run
 * deep enough to blow a recursive DFS's call stack.
 */
export function reversePostorder(snapshot) {
  const order = [];
  const visited = new Uint8Array(snapshot.nodeCount);
  const stack = [[0, snapshot.edgesOf(0)]];
  visited[0] = 1;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const next = frame[1].next();
    if (next.done) {
      order.push(frame[0]);
      stack.pop();
      continue;
    }
    const to = next.value.to;
    if (!visited[to]) {
      visited[to] = 1;
      stack.push([to, snapshot.edgesOf(to)]);
    }
  }

  return order.reverse();
}
