import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from '../src/snapshot.js';
import { InvalidSnapshotError } from '../src/errors.js';
import { tinySnapshot } from './helpers/fixture.js';

test('parses a well formed snapshot and derives strides from meta', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.equal(snap.nodeCount, 3);
  assert.equal(snap.edgeCount, 2);
  assert.equal(snap.nodeStride, 6);
  assert.equal(snap.edgeStride, 3);
});

test('rejects a snapshot missing a required node field', () => {
  const json = tinySnapshot();
  json.snapshot.meta.node_fields = json.snapshot.meta.node_fields.filter((f) => f !== 'self_size');
  assert.throws(() => parseSnapshot(json), {
    name: 'InvalidSnapshotError',
    message: /node_fields has no `self_size`/,
  });
});

test('rejects a snapshot missing a required edge field', () => {
  const json = tinySnapshot();
  json.snapshot.meta.edge_fields = json.snapshot.meta.edge_fields.filter((f) => f !== 'to_node');
  assert.throws(() => parseSnapshot(json), {
    name: 'InvalidSnapshotError',
    message: /edge_fields has no `to_node`/,
  });
});

test('rejects a nodes array whose length does not match node_count * stride', () => {
  const json = tinySnapshot();
  json.snapshot.node_count = 4; // still only 3 nodes worth of integers
  assert.throws(() => parseSnapshot(json), {
    name: 'InvalidSnapshotError',
    message: /expected 24 for 4 nodes/,
  });
});

test('rejects an edges array whose length does not match edge_count * stride', () => {
  const json = tinySnapshot();
  json.snapshot.edge_count = 3; // still only 2 edges worth of integers
  assert.throws(() => parseSnapshot(json), {
    name: 'InvalidSnapshotError',
    message: /expected 9 for 3 edges/,
  });
});

test('defaults strings to an empty array when absent', () => {
  const json = tinySnapshot();
  delete json.strings;
  assert.doesNotThrow(() => parseSnapshot(json));
});

test('every InvalidSnapshotError from a required-field check is an instance of it', () => {
  // Guards against a bare `throw new Error(...)` creeping into any of the
  // required-field checks below the top-level shape check.
  const missingNodeField = tinySnapshot();
  missingNodeField.snapshot.meta.node_fields = [];
  assert.throws(() => parseSnapshot(missingNodeField), InvalidSnapshotError);

  const missingEdgeField = tinySnapshot();
  missingEdgeField.snapshot.meta.edge_fields = [];
  assert.throws(() => parseSnapshot(missingEdgeField), InvalidSnapshotError);
});
