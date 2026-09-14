import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { findCollectionWaste } from '../../src/report/collection_waste.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

const NODE_STRIDE = 6;

// tinySnapshot() plus a Map object (node 3) whose internal "table" edge
// (node 4, an allocated-100-byte backing array) points at two string nodes
// (node 5 "a", 20 bytes; node 6 "b", 16 bytes) -- an over-allocated backing
// store with two real entries.
function withMap() {
  const json = tinySnapshot();
  json.snapshot.node_count = 7;
  json.snapshot.edge_count = 5;
  json.strings.push('Map', 'table', 'a', 'b');
  json.nodes.push(
    3, 4, 11, 0, 1, 0, // node 3: object "Map", edge_count 1 (table)
    1, 0, 13, 100, 2, 0, // node 4: array "" (the table), selfSize 100, edge_count 2
    2, 6, 15, 20, 0, 0, // node 5: string "a", selfSize 20
    2, 7, 17, 16, 0, 0, // node 6: string "b", selfSize 16
  );
  json.edges.push(
    3, 5, 4 * NODE_STRIDE, // node 3 -internal "table"-> node 4
    1, 0, 5 * NODE_STRIDE, // node 4 -element 0-> node 5
    1, 1, 6 * NODE_STRIDE, // node 4 -element 1-> node 6
  );
  return json;
}

test('finds an over-allocated Map and reports its backing store capacity', () => {
  const rows = findCollectionWaste(parseSnapshot(withMap()));
  const row = rows.find((r) => r.constructor === 'Map');
  assert.ok(row, 'expected a Map row');
  assert.equal(row.capacityBytes, 100);
  assert.ok(row.wastedBytes > 0);
});

test('usedBytes is the summed selfSize of the entries, not the backing store\'s own edgeCount', () => {
  // Backing store selfSize 100, edgeCount 2 (two element edges), entries
  // "a" (20 bytes) and "b" (16 bytes). A version that read edgeCount as
  // usedBytes would compute usedBytes=2, wastedBytes=98 -- wrong on both.
  const rows = findCollectionWaste(parseSnapshot(withMap()));
  const row = rows.find((r) => r.constructor === 'Map');
  assert.equal(row.usedBytes, 36);
  assert.equal(row.wastedBytes, 64);
});

test('skips a collection with no waste', () => {
  const json = tinySnapshot();
  const rows = findCollectionWaste(parseSnapshot(json));
  assert.equal(rows.length, 0);
});

test('skips objects that are not Map, Set, or Array', () => {
  const rows = findCollectionWaste(parseSnapshot(tinySnapshot()));
  assert.ok(!rows.some((r) => r.constructor === 'Foo'));
});

test('honours top', () => {
  const rows = findCollectionWaste(parseSnapshot(withMap()), { top: 0 });
  assert.equal(rows.length, 0);
});

test('on a real snapshot, a large pre-sized array shows up with waste', async () => {
  globalThis.__wasteProbe = new Array(500);
  for (let i = 0; i < 3; i++) globalThis.__wasteProbe[i] = { tag: 'probe-' + i };

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const rows = findCollectionWaste(snap, { top: 50 });
    assert.ok(rows.some((r) => r.constructor === 'Array' && r.wastedBytes > 0));
  });

  delete globalThis.__wasteProbe;
});
