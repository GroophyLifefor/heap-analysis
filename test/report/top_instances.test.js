import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { computeRetainedSizes } from '../../src/graph/retained_size.js';
import { topInstancesByRetainedSize } from '../../src/report/top_instances.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

function topOf(json, options) {
  const snap = parseSnapshot(json);
  const idom = computeDominators(snap);
  const retained = computeRetainedSizes(snap, idom);
  return topInstancesByRetainedSize(snap, retained, options);
}

test('orders the tiny fixture by retained size, largest first', () => {
  const rows = topOf(tinySnapshot());
  // retained sizes are 64 (root), 64 (Foo), 24 (hello) -- root and Foo tie,
  // broken by nodeIndex, so root (0) comes before Foo (1).
  assert.deepEqual(rows.map((r) => r.index), [0, 1, 2]);
  assert.deepEqual(rows.map((r) => r.retainedSize), [64, 64, 24]);
});

test('honours top', () => {
  const rows = topOf(tinySnapshot(), { top: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].index, 0);
});

test('each row is a full decoded node plus retainedSize', () => {
  const rows = topOf(tinySnapshot(), { top: 1 });
  assert.deepEqual(rows[0], {
    index: 0,
    id: 1,
    type: 'synthetic',
    name: '',
    selfSize: 0,
    edgeCount: 1,
    retainedSize: 64,
  });
});

test('on a real snapshot, the top instance retains at least as much as the next one', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    const retained = computeRetainedSizes(snap, idom);
    const rows = topInstancesByRetainedSize(snap, retained, { top: 20 });
    assert.equal(rows.length, 20);
    for (let i = 1; i < rows.length; i++) {
      assert.ok(rows[i - 1].retainedSize >= rows[i].retainedSize);
    }
  });
});
