import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { dominatedBy, isDominatedBy } from '../../src/graph/dominance_queries.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('dominatedBy walks the chain up to the root on a linear fixture', () => {
  const idom = computeDominators(parseSnapshot(tinySnapshot()));
  assert.deepEqual(dominatedBy(idom, 2), [1, 0]);
  assert.deepEqual(dominatedBy(idom, 1), [0]);
  assert.deepEqual(dominatedBy(idom, 0), []);
});

test('isDominatedBy is true for every node in its own dominatedBy chain, and for itself', () => {
  const idom = computeDominators(parseSnapshot(tinySnapshot()));
  assert.equal(isDominatedBy(idom, 2, 2), true);
  assert.equal(isDominatedBy(idom, 2, 1), true);
  assert.equal(isDominatedBy(idom, 2, 0), true);
});

test('isDominatedBy is false for a node not in the chain', () => {
  const idom = computeDominators(parseSnapshot(tinySnapshot()));
  assert.equal(isDominatedBy(idom, 0, 1), false); // root is not dominated by its own child
  assert.equal(isDominatedBy(idom, 1, 2), false); // a node is not dominated by its own child
});

test('on a diamond, neither branch dominates the merge point -- only their common ancestor does', () => {
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
  const idom = computeDominators(snap);
  assert.equal(isDominatedBy(idom, 3, 1), false);
  assert.equal(isDominatedBy(idom, 3, 2), false);
  assert.equal(isDominatedBy(idom, 3, 0), true);
  assert.deepEqual(dominatedBy(idom, 3), [0]);
});

test('on a real snapshot, every node in its own dominatedBy chain reports isDominatedBy true', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    let checked = 0;
    for (const nodeIndex of snap.reachableNodes()) {
      for (const ancestor of dominatedBy(idom, nodeIndex)) {
        assert.ok(isDominatedBy(idom, nodeIndex, ancestor));
        checked++;
      }
    }
    assert.ok(checked > 0);
  });
});
