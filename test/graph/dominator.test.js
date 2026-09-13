import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { tinySnapshot } from '../helpers/fixture.js';

test('the root is its own immediate dominator', () => {
  const snap = parseSnapshot(tinySnapshot());
  const idom = computeDominators(snap);
  assert.equal(idom[0], 0);
});

test('idom has one entry per node', () => {
  const snap = parseSnapshot(tinySnapshot());
  const idom = computeDominators(snap);
  assert.equal(idom.length, snap.nodeCount);
});

test('a node with no path from the root is left at -1', () => {
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 3, 7, 8, 0, 0); // unreached
  const snap = parseSnapshot(json);
  const idom = computeDominators(snap);
  assert.equal(idom[3], -1);
});
