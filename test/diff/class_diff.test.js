import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { diffByClass } from '../../src/diff/class_diff.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('diffing a snapshot against itself shows no change anywhere', () => {
  const snap = parseSnapshot(tinySnapshot());
  const rows = diffByClass(snap, snap);
  for (const row of rows) {
    assert.equal(row.countDelta, 0);
    assert.equal(row.sizeDelta, 0);
  }
});

test('a group only present after shows up with a zero before side', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 1, 7, 48, 0, 0); // a second "Foo" object node, 48 bytes
  const after = parseSnapshot(json);

  const rows = diffByClass(before, after);
  const foo = rows.find((r) => r.group === 'Foo');
  assert.equal(foo.countBefore, 1);
  assert.equal(foo.countAfter, 2);
  assert.equal(foo.countDelta, 1);
  assert.equal(foo.sizeBefore, 40);
  assert.equal(foo.sizeAfter, 88);
  assert.equal(foo.sizeDelta, 48);
});

test('honours top, sorted by biggest absolute sizeDelta first', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 1, 7, 48, 0, 0);
  const after = parseSnapshot(json);

  const rows = diffByClass(before, after, { top: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].group, 'Foo');
});

test('on two real snapshots of the same process, nothing grows unexpectedly', async () => {
  await withRealSnapshot(async (file) => {
    const before = await loadSnapshot(file);
    const after = await loadSnapshot(file);
    const rows = diffByClass(before, after);
    for (const row of rows) {
      assert.equal(row.countDelta, 0);
      assert.equal(row.sizeDelta, 0);
    }
  });
});
