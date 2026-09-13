import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { shortestPathToRoot } from '../../src/graph/gc_path.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('finds a path containing every node on the chain, root first', () => {
  const snap = parseSnapshot(tinySnapshot());
  const path = shortestPathToRoot(snap, 2);
  // Regression: the array was built walking nodeIndex -> root and never
  // reversed, so this used to come out [2, 1, 0] instead.
  assert.deepEqual(path, [0, 1, 2]);
});

test('returns null for a node unreachable from the root', () => {
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 3, 7, 8, 0, 0); // unreached
  const snap = parseSnapshot(json);
  assert.equal(shortestPathToRoot(snap, 3), null);
});

test('the root\'s own path is just itself', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(shortestPathToRoot(snap, 0), [0]);
});

test('on a real snapshot, every step of the path is a real edge', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    // Pick some node with a nontrivial path: the first with edgeCount > 0
    // found via referrers (i.e. something other people point at), several
    // hops deep tends to be more interesting than a root's direct child.
    let target = -1;
    for (const nodeIndex of snap.reachableNodes()) {
      if (snap.referrersOf(nodeIndex).length > 0 && nodeIndex !== 0) {
        target = nodeIndex;
        break;
      }
    }
    assert.notEqual(target, -1);

    const path = shortestPathToRoot(snap, target);
    assert.ok(path.length >= 1);
    assert.equal(path[0], 0, 'path should start at the root');
    assert.equal(path[path.length - 1], target, 'path should end at the target');

    // Every consecutive pair in the path must be a real edge, in some
    // direction (we don't assert which end is root here).
    for (let i = 0; i < path.length - 1; i++) {
      const [a, b] = [path[i], path[i + 1]];
      const connected = [...snap.edgesOf(a)].some((e) => e.to === b) ||
        [...snap.edgesOf(b)].some((e) => e.to === a);
      assert.ok(connected, `no edge between ${a} and ${b}`);
    }
  });
});
