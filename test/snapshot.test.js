import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from '../src/snapshot.js';
import { InvalidSnapshotError, OutOfRangeError } from '../src/errors.js';
import { tinySnapshot } from './helpers/fixture.js';

test('parses a well formed snapshot and derives strides from meta', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.equal(snap.nodeCount, 3);
  assert.equal(snap.edgeCount, 2);
  assert.equal(snap.nodeStride, 6);
  assert.equal(snap.edgeStride, 3);
});

test('rejects JSON with no snapshot.meta as InvalidSnapshotError, not a bare Error', () => {
  assert.throws(() => parseSnapshot({ hello: 'world' }), InvalidSnapshotError);
  assert.throws(() => parseSnapshot(null), InvalidSnapshotError);
  assert.throws(() => parseSnapshot({ snapshot: {} }), InvalidSnapshotError);
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

test('decodes the first node into a plain object', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(snap.node(0), {
    index: 0,
    id: 1,
    type: 'synthetic',
    name: '',
    selfSize: 0,
    edgeCount: 1,
  });
});

test('decodes a node past the first using the snapshot\'s own stride', () => {
  // Regression: base offset must come from `this.nodeStride` (derived from
  // meta.node_fields), not a hardcoded constant -- node(0) alone can't catch
  // a wrong stride since nodeIndex * anything is still 0.
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(snap.node(1), {
    index: 1,
    id: 3,
    type: 'object',
    name: 'Foo',
    selfSize: 40,
    edgeCount: 1,
  });
  assert.deepEqual(snap.node(2), {
    index: 2,
    id: 5,
    type: 'string',
    name: 'hello',
    selfSize: 24,
    edgeCount: 0,
  });
});

test('typeOf and nameOf read the same fields node() does, standalone', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.equal(snap.typeOf(1), 'object');
  assert.equal(snap.nameOf(1), 'Foo');
  assert.equal(snap.typeOf(2), 'string');
  assert.equal(snap.nameOf(2), 'hello');
});

test('typeOf and nameOf reject an out-of-range nodeIndex like node() does', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.throws(() => snap.typeOf(3), OutOfRangeError);
  assert.throws(() => snap.nameOf(3), OutOfRangeError);
});

test('rejects a nodeIndex outside the snapshot', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.throws(() => snap.node(3), OutOfRangeError);
  assert.throws(() => snap.node(-1), OutOfRangeError);
  assert.throws(() => snap.node(1.5), OutOfRangeError);
});
