import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { buildDominatorChildren, childCountOf, childAt } from '../../src/graph/dominator_children.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('on a linear chain, each node has exactly one dominator-tree child', () => {
  const snap = parseSnapshot(tinySnapshot());
  const children = buildDominatorChildren(snap, computeDominators(snap));
  assert.equal(childCountOf(children, 0), 1);
  assert.equal(childAt(children, 0, 0), 1);
  assert.equal(childCountOf(children, 1), 1);
  assert.equal(childAt(children, 1, 0), 2);
  assert.equal(childCountOf(children, 2), 0);
});

test('a diamond\'s root has both branches as children, the merge point has none', () => {
  const NF = 6;
  const snap = parseSnapshot({
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
  const children = buildDominatorChildren(snap, computeDominators(snap));
  assert.equal(childCountOf(children, 0), 3); // 1, 2, and 3 (merge point dominated directly by 0)
  assert.equal(childCountOf(children, 1), 0);
  assert.equal(childCountOf(children, 2), 0);
});

test('every dominator-tree child count sums to the reachable node count minus the root', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    const children = buildDominatorChildren(snap, idom);
    let total = 0;
    for (let i = 0; i < snap.nodeCount; i++) total += childCountOf(children, i);
    assert.equal(total, snap.reachableNodes().size - 1);
  });
});
