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
  json.edges.push(4, 4, 4 * NODE_STRIDE); // node 3 -internal "context"-> node 4
  return json;
}

test('a context captured by only one closure is not reported', () => {
  const rows = findContextRetention(parseSnapshot(withOneClosure()));
  assert.deepEqual(rows, []);
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
