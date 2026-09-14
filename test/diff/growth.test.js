import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { findGrowth } from '../../src/diff/growth.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('diffing a snapshot against itself finds no growth', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(findGrowth(snap, snap), []);
});

test('a class that doubled in size has growthRatio 1', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 1, 99, 40, 0, 0); // a second "Foo", same 40 bytes as the first
  const after = parseSnapshot(json);

  const rows = findGrowth(before, after);
  const foo = rows.find((r) => r.group === 'Foo');
  assert.ok(foo);
  assert.equal(foo.sizeBefore, 40);
  assert.equal(foo.sizeAfter, 80);
  assert.equal(foo.growthRatio, 1);
});

test('a class that shrank is not reported as growth', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.nodes[1 * 6 + 3] = 10; // Foo shrinks from 40 to 10 bytes
  const after = parseSnapshot(json);

  const rows = findGrowth(before, after);
  assert.ok(!rows.some((r) => r.group === 'Foo'));
});

test('honours top', () => {
  const before = parseSnapshot(tinySnapshot());
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 1, 99, 40, 0, 0);
  const after = parseSnapshot(json);
  const rows = findGrowth(before, after, { top: 0 });
  assert.equal(rows.length, 0);
});

test('on two real snapshots of the same process, nothing grows', async () => {
  await withRealSnapshot(async (file) => {
    const before = await loadSnapshot(file);
    const after = await loadSnapshot(file);
    assert.deepEqual(findGrowth(before, after), []);
  });
});
