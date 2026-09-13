import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { tinySnapshot, withRealSnapshot } from './helpers/fixture.js';

test('tinySnapshot is internally consistent with its own declared counts', () => {
  const s = tinySnapshot();
  const nodeStride = s.snapshot.meta.node_fields.length;
  const edgeStride = s.snapshot.meta.edge_fields.length;

  assert.equal(s.nodes.length, s.snapshot.node_count * nodeStride);
  assert.equal(s.edges.length, s.snapshot.edge_count * edgeStride);

  // Every to_node must be a valid offset into `nodes`, i.e. a multiple of
  // the stride and within range -- the same invariant real snapshots hold.
  const toNodeField = s.snapshot.meta.edge_fields.indexOf('to_node');
  for (let e = 0; e < s.snapshot.edge_count; e++) {
    const toNode = s.edges[e * edgeStride + toNodeField];
    assert.equal(toNode % nodeStride, 0, `to_node ${toNode} is not a multiple of stride ${nodeStride}`);
    assert.ok(toNode < s.nodes.length, `to_node ${toNode} is out of range`);
  }

  // Every name/name_or_index that indexes the string table must be in range.
  const nameField = s.snapshot.meta.node_fields.indexOf('name');
  for (let i = 0; i < s.snapshot.node_count; i++) {
    assert.ok(s.nodes[i * nodeStride + nameField] < s.strings.length);
  }
});

test('withRealSnapshot hands back a real file that exists during the callback', async () => {
  let seenDuringCallback;
  await withRealSnapshot(async (file) => {
    seenDuringCallback = existsSync(file);
  });
  assert.equal(seenDuringCallback, true);
});

test('withRealSnapshot removes the temp file after the callback returns', async () => {
  let capturedPath;
  await withRealSnapshot(async (file) => {
    capturedPath = file;
  });
  assert.equal(existsSync(capturedPath), false);
});

test('withRealSnapshot removes the temp file even when the callback throws', async () => {
  let capturedPath;
  await assert.rejects(
    withRealSnapshot(async (file) => {
      capturedPath = file;
      throw new Error('boom');
    }),
    { message: 'boom' },
  );
  assert.equal(existsSync(capturedPath), false);
});
