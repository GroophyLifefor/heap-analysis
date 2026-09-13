import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { findByClassName } from '../../src/graph/find_by_class_name.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('finds the one object node matching a class name on the tiny fixture', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(findByClassName(snap, 'Foo'), [1]);
});

test('finds nothing for a class name with no instances', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(findByClassName(snap, 'Bar'), []);
});

test('never matches a non-object node, even one whose name happens to coincide', () => {
  // node 2 is a string node named "hello" -- findByClassName only looks at
  // object nodes' constructor names, a string's "name" is its contents.
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(findByClassName(snap, 'hello'), []);
});

test('on a real snapshot, finds every instance of a class with several', async () => {
  class FindProbe {
    constructor(i) {
      this.i = i;
    }
  }
  globalThis.__findProbeInstances = Array.from({ length: 12 }, (_, i) => new FindProbe(i));

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const matches = findByClassName(snap, 'FindProbe');
    assert.equal(matches.length, 12);
    for (const nodeIndex of matches) assert.equal(snap.nameOf(nodeIndex), 'FindProbe');
  });

  delete globalThis.__findProbeInstances;
});
