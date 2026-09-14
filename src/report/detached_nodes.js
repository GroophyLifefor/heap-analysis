/**
 * Nodes V8 itself has marked detached (detachednessOf === 2): something in
 * JS still holds a reference, but the native side it wrapped is gone. A
 * classic browser leak shape (a detached DOM element some code forgot to
 * drop); Node.js processes without a DOM rarely produce any, but the field
 * exists in every snapshot capable of tracking it, and third-party native
 * addons can set it too.
 *
 * Returns decoded node objects (as node() does), largest selfSize first.
 */
export function findDetachedNodes(snapshot, { top = 10 } = {}) {
  const rows = [];
  for (let i = 0; i < snapshot.nodeCount; i++) {
    if (snapshot.detachednessOf(i) === 2) rows.push(snapshot.node(i));
  }
  rows.sort((a, b) => b.selfSize - a.selfSize);
  return rows.slice(0, top);
}
