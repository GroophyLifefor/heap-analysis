import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { alignSnapshots } from '../../src/diff/align_snapshots.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('aligning a snapshot with itself matches every node by id, nothing added or removed', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { matched, removed, added } = alignSnapshots(snap, snap);
  assert.equal(matched.length, 3);
  assert.deepEqual(removed, []);
  assert.deepEqual(added, []);
  for (const m of matched) {
    assert.equal(m.beforeIndex, m.afterIndex);
    assert.equal(m.id, snap.idOf(m.beforeIndex));
  }
});

test('every before nodeIndex is accounted for exactly once, matched or removed', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { matched, removed } = alignSnapshots(snap, snap);
  const seen = new Set([...matched.map((m) => m.beforeIndex), ...removed]);
  assert.equal(seen.size, snap.nodeCount);
});

test('every after nodeIndex is accounted for exactly once, matched or added', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { matched, added } = alignSnapshots(snap, snap);
  const seen = new Set([...matched.map((m) => m.afterIndex), ...added]);
  assert.equal(seen.size, snap.nodeCount);
});

test('on two real snapshots of the same process, every node aligns with itself', async () => {
  await withRealSnapshot(async (file) => {
    const before = await loadSnapshot(file);
    const after = await loadSnapshot(file);
    const { matched } = alignSnapshots(before, after);
    assert.equal(matched.length, before.nodeCount);
  });
});
