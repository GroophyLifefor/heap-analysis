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

// Same three node identities in both snapshots, but "Foo" and "hello" swap
// positions between before and after -- nodeIndex-based matching gets this
// wrong even though nothing was actually added or removed.
function buildFlat(entries) {
  const base = tinySnapshot();
  const strings = [''];
  const nameIndex = (name) => {
    let i = strings.indexOf(name);
    if (i === -1) {
      i = strings.length;
      strings.push(name);
    }
    return i;
  };
  const nodes = [];
  for (const e of entries) {
    nodes.push(base.snapshot.meta.node_types[0].indexOf(e.type), nameIndex(e.name), e.id, e.selfSize, 0, 0);
  }
  return {
    snapshot: { meta: base.snapshot.meta, node_count: entries.length, edge_count: 0 },
    nodes,
    edges: [],
    strings,
  };
}

test('matches nodes by id even when their position moved between snapshots', () => {
  const before = parseSnapshot(buildFlat([
    { type: 'synthetic', name: '', id: 1, selfSize: 0 },
    { type: 'object', name: 'Foo', id: 3, selfSize: 40 },
    { type: 'string', name: 'hello', id: 5, selfSize: 24 },
  ]));
  const after = parseSnapshot(buildFlat([
    { type: 'synthetic', name: '', id: 1, selfSize: 0 },
    { type: 'string', name: 'hello', id: 5, selfSize: 24 },
    { type: 'object', name: 'Foo', id: 3, selfSize: 40 },
  ]));

  const { matched, removed, added } = alignSnapshots(before, after);
  assert.equal(matched.length, 3);
  assert.deepEqual(removed, []);
  assert.deepEqual(added, []);

  const byId = new Map(matched.map((m) => [m.id, m]));
  assert.deepEqual(byId.get(3), { id: 3, beforeIndex: 1, afterIndex: 2 });
  assert.deepEqual(byId.get(5), { id: 5, beforeIndex: 2, afterIndex: 1 });
});

test('on two real snapshots of the same process, every node aligns with itself', async () => {
  await withRealSnapshot(async (file) => {
    const before = await loadSnapshot(file);
    const after = await loadSnapshot(file);
    const { matched } = alignSnapshots(before, after);
    assert.equal(matched.length, before.nodeCount);
  });
});
