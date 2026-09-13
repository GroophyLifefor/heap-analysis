import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from '../../src/snapshot.js';
import { allPathsToRoot } from '../../src/graph/all_paths.js';
import { tinySnapshot } from '../helpers/fixture.js';

function diamondSnapshot() {
  const NF = 6;
  // 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3: node 3 has two distinct paths to root.
  return parseSnapshot({
    snapshot: {
      meta: {
        node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'detachedness'],
        node_types: [
          ['hidden', 'array', 'string', 'object', 'code', 'closure', 'regexp',
            'number', 'native', 'synthetic'],
          'string', 'number', 'number', 'number', 'number',
        ],
        edge_fields: ['type', 'name_or_index', 'to_node'],
        edge_types: [
          ['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'],
          'string_or_number', 'node',
        ],
      },
      node_count: 4,
      edge_count: 4,
    },
    nodes: [
      9, 0, 1, 0, 2, 0,
      3, 1, 2, 8, 1, 0,
      3, 1, 3, 8, 1, 0,
      3, 1, 4, 8, 0, 0,
    ],
    edges: [2, 2, 1 * NF, 2, 2, 2 * NF, 2, 2, 3 * NF, 2, 2, 3 * NF],
    strings: ['', 'a'],
  });
}

test('a chain has exactly one path to root', () => {
  const snap = parseSnapshot(tinySnapshot());
  const paths = allPathsToRoot(snap, 2, 10);
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0], [0, 1, 2]);
});

test('the root\'s own path is just itself', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(allPathsToRoot(snap, 0, 10), [[0]]);
});

test('a diamond\'s merge point has exactly two paths, one per branch', () => {
  const snap = diamondSnapshot();
  const paths = allPathsToRoot(snap, 3, 10);
  const asStrings = paths.map((p) => p.join(','));
  assert.deepEqual(new Set(asStrings), new Set(['0,1,3', '0,2,3']));
});

test('stops at exactly the requested budget, not one branch\'s worth per sibling', () => {
  // The classic bug this guards against: a budget that resets per
  // recursive call instead of being shared lets each branch return up to
  // maxPaths independently, so a node with two branches to root would
  // return maxPaths * 2 instead of maxPaths.
  const snap = diamondSnapshot();
  assert.equal(allPathsToRoot(snap, 3, 1).length, 1);
});
