import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { reversePostorder } from '../../src/graph/reverse_postorder.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('root comes last on the tiny linear chain', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(reversePostorder(snap), [0, 1, 2]);
});

test('omits a node unreachable from the root', () => {
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 3, 7, 8, 0, 0); // unreached
  const snap = parseSnapshot(json);
  assert.deepEqual(reversePostorder(snap), [0, 1, 2]);
});

test('every reachable node appears exactly once, root first', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const order = reversePostorder(snap);
    const reachable = snap.reachableNodes();
    assert.equal(order.length, reachable.size);
    assert.equal(order[0], 0, 'root should come first in reverse postorder');
    assert.equal(new Set(order).size, order.length, 'no duplicates');
    for (const nodeIndex of order) assert.ok(reachable.has(nodeIndex));
  });
});
