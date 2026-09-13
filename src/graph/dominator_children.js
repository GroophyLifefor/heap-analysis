import { OutOfRangeError } from '../errors.js';

/**
 * The dominator tree's parent/child relationship, flattened into the same
 * firstEdge/edges shape used elsewhere in this package: firstChild[i] is
 * where node i's children start in childNodes, so node i owns
 * firstChild[i] .. firstChild[i + 1] - 1.
 *
 * `idom` is computeDominators()'s output.
 */
export function buildDominatorChildren(snapshot, idom) {
  const counts = new Int32Array(snapshot.nodeCount);
  for (let i = 0; i < snapshot.nodeCount; i++) {
    if (i === 0 || idom[i] === -1) continue; // root has no parent, -1 is unreachable
    counts[idom[i]]++;
  }

  const firstChild = new Int32Array(snapshot.nodeCount + 1);
  let acc = 0;
  for (let i = 0; i < snapshot.nodeCount; i++) {
    firstChild[i] = acc;
    acc += counts[i];
  }
  firstChild[snapshot.nodeCount] = acc;

  // A mutable cursor per node, starting at its own offset -- same role
  // `counts` played, reused so a third array isn't needed.
  const cursor = counts;
  cursor.set(firstChild.subarray(0, snapshot.nodeCount));
  const childNodes = new Int32Array(acc);
  for (let i = 0; i < snapshot.nodeCount; i++) {
    if (i === 0 || idom[i] === -1) continue;
    childNodes[cursor[idom[i]]++] = i;
  }

  return { firstChild, childNodes };
}

/** How many dominator-tree children `nodeIndex` has. */
export function childCountOf(children, nodeIndex) {
  return children.firstChild[nodeIndex + 1] - children.firstChild[nodeIndex];
}

/** The i-th dominator-tree child of `nodeIndex` (0-indexed). */
export function childAt(children, nodeIndex, i) {
  const count = childCountOf(children, nodeIndex);
  if (i < 0 || i > count) {
    throw new OutOfRangeError(`child index ${i} is outside 0..${count - 1} for node ${nodeIndex}`);
  }
  return children.childNodes[children.firstChild[nodeIndex] + i];
}
