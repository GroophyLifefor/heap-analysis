import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSnapshot, loadSnapshot } from '../src/snapshot.js';
import { InvalidSnapshotError, OutOfRangeError } from '../src/errors.js';
import { tinySnapshot, withRealSnapshot } from './helpers/fixture.js';

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

test('edgesOf yields the property edge with its type, name, and target nodeIndex', () => {
  const snap = parseSnapshot(tinySnapshot());
  const edges = [...snap.edgesOf(0)];
  assert.equal(edges.length, 1);
  assert.equal(edges[0].type, 'property');
  assert.equal(edges[0].name, 'prop');
  assert.equal(edges[0].to, 1);
});

test('edgesOf resolves to_node as a nodeIndex, not the raw offset', () => {
  // Regression: to_node is nodeIndex * nodeStride. Returning it unconverted
  // still looks like a plausible number and rarely throws (it's often a
  // valid array position elsewhere), it just silently points at the wrong
  // node.
  const edges = [...parseSnapshot(tinySnapshot()).edgesOf(1)];
  assert.equal(edges[0].to, 2);
});

test('edgesOf finds the right edge for a node past the first', () => {
  const edges = [...parseSnapshot(tinySnapshot()).edgesOf(1)];
  assert.equal(edges.length, 1);
  assert.equal(edges[0].type, 'property');
  assert.equal(edges[0].name, 'prop');
});

test('edgesOf yields nothing for a node with no outgoing edges', () => {
  const edges = [...parseSnapshot(tinySnapshot()).edgesOf(2)];
  assert.equal(edges.length, 0);
});

test('an element or hidden edge keeps name_or_index numeric', () => {
  const json = tinySnapshot();
  json.edges[0] = 1; // element, not property
  json.edges[1] = 7; // an array index, not a string-table index
  const edges = [...parseSnapshot(json).edgesOf(0)];
  assert.equal(edges[0].type, 'element');
  assert.equal(edges[0].name, 7);
});

test('edgesOf rejects an out-of-range nodeIndex', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.throws(() => [...snap.edgesOf(3)], OutOfRangeError);
});

test('every edge in a real snapshot resolves to a valid nodeIndex', async () => {
  // A real snapshot has far more nodes than the hand written fixture, this
  // is what actually exercises the firstEdge index across many nodes rather
  // than the 3-node/2-edge case above.
  await withRealSnapshot(async (file) => {
    const json = JSON.parse(await readFile(file, 'utf8'));
    const snap = parseSnapshot(json);
    assert.ok(snap.nodeCount > 1000, `expected a populated heap, got ${snap.nodeCount} nodes`);

    let checked = 0;
    for (let i = 0; i < 2000; i++) {
      for (const edge of snap.edgesOf(i)) {
        assert.ok(Number.isInteger(edge.to), `edge.to ${edge.to} is not an integer nodeIndex`);
        assert.ok(edge.to >= 0 && edge.to < snap.nodeCount, `edge.to ${edge.to} is out of range`);
        checked++;
      }
    }
    assert.ok(checked > 0, 'expected the first 2000 nodes to have some edges');
  });
});

test('loadSnapshot reads and parses a real snapshot file', async () => {
  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    assert.ok(snap.nodeCount > 0);
  });
});

test('loadSnapshot reports a missing file as InvalidSnapshotError', async () => {
  await assert.rejects(() => loadSnapshot('./does-not-exist.heapsnapshot'), {
    name: 'InvalidSnapshotError',
    message: /no such snapshot/,
  });
});

test('loadSnapshot reports invalid JSON as InvalidSnapshotError', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-'));
  const file = join(dir, 'not-json.heapsnapshot');
  try {
    await writeFile(file, 'this is not json');
    await assert.rejects(() => loadSnapshot(file), {
      name: 'InvalidSnapshotError',
      message: /not valid JSON/,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// loadSnapshot's ERR_STRING_TOO_LONG branch (a snapshot over Node's ~537MB
// string limit) is handled but not covered here: writing a fixture that
// large would make this suite itself the slow, disk-hungry thing it is
// testing against. Verified manually against the real error code instead
// (see the PR description).
