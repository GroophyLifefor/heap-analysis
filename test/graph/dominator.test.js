import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

/** 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3: neither 1 nor 2 alone dominates 3,
 * only their common ancestor 0 does. Exercises intersect(), which the
 * 3-node linear fixture (no node with two predecessors) never does. */
function diamondSnapshot() {
  const NF = 6;
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
      9, 0, 1, 0, 2, 0, // node0: root, 2 edges
      3, 1, 2, 8, 1, 0, // node1
      3, 1, 3, 8, 1, 0, // node2
      3, 1, 4, 8, 0, 0, // node3
    ],
    edges: [
      2, 2, 1 * NF, // node0 -> node1
      2, 2, 2 * NF, // node0 -> node2
      2, 2, 3 * NF, // node1 -> node3
      2, 2, 3 * NF, // node2 -> node3
    ],
    strings: ['', 'a'],
  });
}

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

test('on a linear chain, each node is dominated by the one before it', () => {
  const idom = computeDominators(parseSnapshot(tinySnapshot()));
  assert.deepEqual([...idom], [0, 0, 1]);
});

test('on a diamond, the merge point is dominated by the common ancestor, not either branch', () => {
  const idom = computeDominators(diamondSnapshot());
  assert.deepEqual([...idom], [0, 0, 0, 0]);
});

test('every reachable node in a real snapshot has an idom chain that terminates at the root without cycling', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    const reachable = snap.reachableNodes();
    for (const nodeIndex of reachable) {
      const seen = new Set();
      let cur = nodeIndex;
      while (cur !== 0) {
        assert.ok(!seen.has(cur), `cycle in idom chain at node ${cur}`);
        seen.add(cur);
        assert.notEqual(idom[cur], -1, `node ${nodeIndex}'s chain hit an unset idom at ${cur}`);
        cur = idom[cur];
      }
    }
  });
});
