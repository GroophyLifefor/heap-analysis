import { reversePostorder } from './reverse_postorder.js';

/**
 * Cooper-Harvey-Kennedy iterative dominance algorithm
 * ("A Simple, Fast Dominance Algorithm", 2001).
 *
 * Returns an Int32Array `idom` where `idom[nodeIndex]` is that node's
 * immediate dominator's nodeIndex. `idom[root] === root` by convention
 * (root has no strict dominator). A node unreachable from the root is
 * left at -1.
 *
 * Must walk nodes in reverse postorder for `intersect` below to converge
 * in a handful of passes: it relies on a predecessor already having a
 * (possibly provisional) idom by the time its successor is processed,
 * which reverse postorder guarantees for a forward edge but an arbitrary
 * order does not.
 */
export function computeDominators(snapshot) {
  const rpo = reversePostorder(snapshot);
  const rpoNumber = new Int32Array(snapshot.nodeCount).fill(-1);
  for (let i = 0; i < rpo.length; i++) rpoNumber[rpo[i]] = i;

  const idom = new Int32Array(snapshot.nodeCount).fill(-1);
  const root = rpo[0];
  idom[root] = root;

  const intersect = (a, b) => {
    while (a !== b) {
      while (rpoNumber[a] > rpoNumber[b]) a = idom[a];
      while (rpoNumber[b] > rpoNumber[a]) b = idom[b];
    }
    return a;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < rpo.length; i++) {
      const b = rpo[i];
      let newIdom = -1;
      for (const p of snapshot.referrersOf(b)) {
        if (idom[p] === -1) continue; // predecessor not processed yet
        newIdom = newIdom === -1 ? p : intersect(newIdom, p);
      }
      if (newIdom !== -1 && newIdom !== idom[b]) {
        idom[b] = newIdom;
        changed = true;
      }
    }
  }

  return idom;
}
