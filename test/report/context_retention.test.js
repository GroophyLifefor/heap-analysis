import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { findContextRetention } from '../../src/report/context_retention.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

const NODE_STRIDE = 6;

// tinySnapshot() plus one closure (node 3) with an internal "context" edge
// to an object standing in for a V8 Context (node 4).
function withOneClosure() {
  const json = tinySnapshot();
  json.snapshot.node_count = 5;
  json.snapshot.edge_count = 3;
  json.strings.push('context');
  json.nodes.push(
    5, 0, 21, 0, 1, 0, // node 3: closure, edge_count 1
    3, 0, 25, 64, 0, 0, // node 4: object (stands in for a Context), 64 bytes
  );
  json.edges.push(3, 4, 4 * NODE_STRIDE); // node 3 -internal "context"-> node 4
  return json;
}

test('a context captured by only one closure is not reported', () => {
  const rows = findContextRetention(parseSnapshot(withOneClosure()));
  assert.deepEqual(rows, []);
});

test('contextRetainerCountOf counts a real capture, not just non-zero', () => {
  // node 4's offset (4 * NODE_STRIDE = 24) is well past nodeCount (5) --
  // a version that used the raw offset as the array index instead of
  // dividing it back to a nodeIndex would silently drop this write and
  // report 0 here forever.
  const snap = parseSnapshot(withOneClosure());
  assert.equal(snap.contextRetainerCountOf(4), 1);
});

test('a context captured by two closures is reported with the right count', () => {
  const json = withOneClosure();
  json.snapshot.node_count = 6;
  json.snapshot.edge_count = 4;
  json.nodes.push(5, 0, 27, 0, 1, 0); // node 5: a second closure, edge_count 1
  json.edges.push(3, 4, 4 * NODE_STRIDE); // node 5 -internal "context"-> node 4 too
  const rows = findContextRetention(parseSnapshot(json));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].index, 4);
  assert.equal(rows[0].closureCount, 2);
});

test('contextRetainerCountOf is 0 for a node no closure targets at all', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.equal(snap.contextRetainerCountOf(1), 0);
  assert.equal(snap.contextRetainerCountOf(2), 0);
});

test('honours top', () => {
  const rows = findContextRetention(parseSnapshot(withOneClosure()), { top: 0 });
  assert.equal(rows.length, 0);
});

test('on a real snapshot, every reported row is really shared by 2+ closures', async () => {
  function makeClosures() {
    const shared = { tag: 'probe-shared-context' };
    const fns = [];
    for (let i = 0; i < 6; i++) fns.push(() => shared.tag + i);
    return fns;
  }
  globalThis.__closureProbe = makeClosures();

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const rows = findContextRetention(snap, { top: 50 });
    for (const row of rows) assert.ok(row.closureCount >= 2);
  });

  delete globalThis.__closureProbe;
});
