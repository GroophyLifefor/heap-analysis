import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { computeRetainedSizes } from '../../src/graph/retained_size.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('on a linear chain, retained size accumulates down the chain', () => {
  const snap = parseSnapshot(tinySnapshot());
  const retained = computeRetainedSizes(snap, computeDominators(snap));
  // selfSizes are 0, 40, 24.
  assert.deepEqual([...retained], [64, 64, 24]);
});

test('a shared descendant on a diamond is counted once, under the merge point\'s dominator', () => {
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
    // 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3. selfSizes 0, 8, 8, 8.
    nodes: [
      9, 0, 1, 0, 2, 0,
      3, 1, 2, 8, 1, 0,
      3, 1, 3, 8, 1, 0,
      3, 1, 4, 8, 0, 0,
    ],
    edges: [2, 2, 1 * NF, 2, 2, 2 * NF, 2, 2, 3 * NF, 2, 2, 3 * NF],
    strings: ['', 'a'],
  });
  const retained = computeRetainedSizes(snap, computeDominators(snap));
  // If node3's 8 bytes were double counted under both branches, node0 would
  // show 32 (0 + 8 + 8 + 8 + 8) instead of the correct 24.
  assert.deepEqual([...retained], [24, 8, 8, 8]);
});

test('the root\'s retained size equals totalShallowSize when everything is reachable', () => {
  const snap = parseSnapshot(tinySnapshot());
  const retained = computeRetainedSizes(snap, computeDominators(snap));
  assert.equal(retained[0], snap.totalShallowSize);
});

test('on a real snapshot, retained size never decreases going up the dominator chain', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    const retained = computeRetainedSizes(snap, idom);
    let checked = 0;
    for (const nodeIndex of snap.reachableNodes()) {
      if (nodeIndex === 0) continue;
      const parent = idom[nodeIndex];
      assert.ok(
        retained[parent] >= retained[nodeIndex],
        `parent ${parent} (${retained[parent]}) retains less than its child ${nodeIndex} (${retained[nodeIndex]})`,
      );
      checked++;
    }
    assert.ok(checked > 0);
  });
});
