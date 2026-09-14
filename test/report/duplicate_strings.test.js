import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { findDuplicateStrings } from '../../src/report/duplicate_strings.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

// Two more string nodes on top of the one tinySnapshot() already has. They
// carry no edges of their own (edge_count 0), so they don't disturb the
// existing edge offsets -- findDuplicateStrings walks every node in the
// snapshot regardless of reachability, so that's enough to exercise it.
function withDuplicateString() {
  const json = tinySnapshot();
  json.snapshot.node_count = 5;
  json.strings.push('solo');
  json.nodes.push(
    2, 2, 7, 24, 0, 0, // node 3: string "hello" (dup of node 2, name index 2 reused)
    2, 4, 9, 8, 0, 0, // node 4: string "solo" (unique)
  );
  return json;
}

test('groups identical string values and counts them', () => {
  const rows = findDuplicateStrings(parseSnapshot(withDuplicateString()));
  const hello = rows.find((r) => r.value === 'hello');
  assert.ok(hello, 'expected a "hello" group');
  assert.equal(hello.count, 2);
  assert.equal(hello.totalBytes, 48);
  assert.equal(hello.wastedBytes, 24);
});

test('drops values that only appear once', () => {
  const rows = findDuplicateStrings(parseSnapshot(withDuplicateString()));
  assert.ok(!rows.some((r) => r.value === 'solo'));
  assert.ok(!rows.some((r) => r.value === 'Foo'));
});

test('counts concatenated and sliced string nodes too, not just plain string', () => {
  const json = tinySnapshot();
  json.snapshot.node_count = 5;
  json.nodes.push(
    10, 2, 7, 24, 0, 0, // node 3: concatenated string "hello" (dup of node 2)
    11, 2, 9, 24, 0, 0, // node 4: sliced string "hello" (dup of node 2)
  );
  const rows = findDuplicateStrings(parseSnapshot(json));
  const hello = rows.find((r) => r.value === 'hello');
  assert.ok(hello, 'expected a "hello" group spanning all three string node types');
  assert.equal(hello.count, 3);
  assert.equal(hello.totalBytes, 72);
});

test('honours top', () => {
  const json = withDuplicateString();
  const rows = findDuplicateStrings(parseSnapshot(json), { top: 0 });
  assert.equal(rows.length, 0);
});

test('on a real snapshot, a string repeated many times shows up with the right count', async () => {
  // Built via Buffer decode, not a literal, so V8 doesn't intern all 25 into
  // one shared string object the way repeating a literal would.
  const bytes = Buffer.from('duplicate-string-probe-value', 'utf8');
  globalThis.__dupStringProbe = Array.from({ length: 25 }, () => bytes.toString('utf8'));

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const rows = findDuplicateStrings(snap, { top: 50 });
    const row = rows.find((r) => r.value === 'duplicate-string-probe-value');
    assert.ok(row, 'expected the probe string to show up as duplicated');
    assert.ok(row.count >= 25);
    assert.ok(row.wastedBytes > 0);
  });

  delete globalThis.__dupStringProbe;
});
