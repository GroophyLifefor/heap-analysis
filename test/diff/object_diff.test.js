import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { diffObjects } from '../../src/diff/object_diff.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('diffing a snapshot against itself finds nothing added or removed', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { added, removed } = diffObjects(snap, snap);
  assert.deepEqual(added, []);
  assert.deepEqual(removed, []);
});

test('a node only in after shows up in added', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 1, 99, 48, 0, 0); // a new "Foo" object, id 99
  const after = parseSnapshot(json);

  const { added, removed } = diffObjects(before, after);
  assert.equal(added.length, 1);
  assert.equal(added[0].id, 99);
  assert.equal(added[0].selfSize, 48);
  assert.deepEqual(removed, []);
});

test('honours top, largest selfSize first', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.snapshot.node_count = 5;
  json.nodes.push(
    3, 1, 99, 48, 0, 0, // new Foo, 48 bytes
    3, 1, 101, 96, 0, 0, // new Foo, 96 bytes
  );
  const after = parseSnapshot(json);

  const { added } = diffObjects(before, after, { top: 1 });
  assert.equal(added.length, 1);
  assert.equal(added[0].id, 101);
});

test('on two real snapshots of the same process, nothing is added or removed', async () => {
  await withRealSnapshot(async (file) => {
    const before = await loadSnapshot(file);
    const after = await loadSnapshot(file);
    const { added, removed } = diffObjects(before, after);
    assert.deepEqual(added, []);
    assert.deepEqual(removed, []);
  });
});
