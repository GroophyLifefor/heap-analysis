import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { findDetachedNodes } from '../../src/report/detached_nodes.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('finds nothing when no node is marked detached', () => {
  const rows = findDetachedNodes(parseSnapshot(tinySnapshot()));
  assert.deepEqual(rows, []);
});

test('finds a node whose detachedness field is 2', () => {
  const json = tinySnapshot();
  json.nodes[1 * 6 + 5] = 2; // node 1 ("Foo")'s detachedness field
  const rows = findDetachedNodes(parseSnapshot(json));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].index, 1);
  assert.equal(rows[0].name, 'Foo');
});

test('detachedness value 1 (attached) is not reported', () => {
  const json = tinySnapshot();
  json.nodes[1 * 6 + 5] = 1;
  const rows = findDetachedNodes(parseSnapshot(json));
  assert.deepEqual(rows, []);
});

test('honours top and sorts by selfSize, largest first', () => {
  const json = tinySnapshot();
  json.nodes[1 * 6 + 5] = 2; // Foo, 40 bytes
  json.nodes[2 * 6 + 5] = 2; // hello, 24 bytes
  const rows = findDetachedNodes(parseSnapshot(json), { top: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Foo');
});

test('a snapshot from a V8 without a detachedness field reports nothing rather than throwing', () => {
  const json = tinySnapshot();
  json.snapshot.meta.node_fields = ['type', 'name', 'id', 'self_size', 'edge_count'];
  json.nodes = [
    9, 0, 1, 0, 1,
    3, 1, 3, 40, 1,
    2, 2, 5, 24, 0,
  ];
  const rows = findDetachedNodes(parseSnapshot(json));
  assert.deepEqual(rows, []);
});

test('on a real Node.js snapshot, every row really has detachedness 2', async () => {
  // Node's own native wrapper handles (FSReqPromise, BindingData, ...) get
  // marked detached too, it isn't only a browser DOM thing -- so this
  // asserts the field value directly rather than assuming the list is
  // empty outside a browser.
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const rows = findDetachedNodes(snap);
    for (const row of rows) assert.equal(snap.detachednessOf(row.index), 2);
  });
});
