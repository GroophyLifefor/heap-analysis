/**
 * Nodes V8 itself has marked detached (detachednessOf === 2): something in
 * JS still holds a reference, but the native side it wrapped is gone. Known
 * best as a browser leak shape (a detached DOM element some code forgot to
 * drop), but not only that: Node.js itself marks some of its own native
 * wrapper handles (e.g. FSReqPromise, BindingData) this way too, verified
 * against a real snapshot of the running test process.
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
