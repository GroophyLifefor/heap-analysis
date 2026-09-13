/**
 * Retained size of every node: its own selfSize plus the retained size of
 * everything it dominates. A node dominated by more than one ancestor
 * (shared by two branches, like a diamond's merge point) is counted once,
 * under its immediate dominator, not once per branch that reaches it --
 * that's the whole reason to build this from the dominator tree rather
 * than summing edgesOf recursively, which would double count shared
 * descendants.
 *
 * `idom` is computeDominators()'s output. Returns a Float64Array (not
 * Int32) since a real heap's total retained size can exceed 2^31 bytes.
 */
export function computeRetainedSizes(snapshot, idom) {
  const children = Array.from({ length: snapshot.nodeCount }, () => []);
  for (let i = 0; i < snapshot.nodeCount; i++) {
    if (i === 0 || idom[i] === -1) continue; // root has no parent, -1 is unreachable
    children[idom[i]].push(i);
  }

  // Iterative post-order over the dominator tree (a real tree, since every
  // reachable non-root node has exactly one idom): children finish before
  // their parent, so each parent can sum already-finished children.
  const finished = [];
  const stack = [0];
  const childCursor = new Int32Array(snapshot.nodeCount);
  while (stack.length > 0) {
    const node = stack[stack.length - 1];
    if (childCursor[node] < children[node].length) {
      stack.push(children[node][childCursor[node]++]);
    } else {
      finished.push(node);
      stack.pop();
    }
  }

  const retained = new Float64Array(snapshot.nodeCount);
  for (const node of finished) {
    let sum = snapshot.node(node).selfSize;
    for (const child of children[node]) sum += retained[child];
    retained[node] = sum;
  }
  return retained;
}
