import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { summarize } from '../../src/report/summary.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

test('groups the tiny fixture by constructor/type with exact byte sizes', () => {
  const rows = summarize(parseSnapshot(tinySnapshot()));
  const byGroup = new Map(rows.map((r) => [r.group, r]));
  assert.deepEqual(byGroup.get('Foo'), { group: 'Foo', count: 1, shallowSize: 40 });
  assert.deepEqual(byGroup.get('(string)'), { group: '(string)', count: 1, shallowSize: 24 });
  assert.deepEqual(byGroup.get('(synthetic)'), { group: '(synthetic)', count: 1, shallowSize: 0 });
});

test('honours top', () => {
  const rows = summarize(parseSnapshot(tinySnapshot()), { top: 1 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].group, 'Foo'); // 40 bytes, the largest single group
});

test('counts an unreachable node too, unlike the retained-size summary', () => {
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 3, 7, 8, 0, 0); // unreached object node named "prop"
  const snap = parseSnapshot(json);
  const rows = summarize(snap);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  assert.equal(total, 4);
});

test('on a real snapshot, a known class shows up with the right count and shallow size', async () => {
  class SummaryProbe {
    constructor() {
      this.buf = Buffer.alloc(64);
    }
  }
  globalThis.__summaryProbeInstances = Array.from({ length: 10 }, () => new SummaryProbe());

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const row = summarize(snap).find((r) => r.group === 'SummaryProbe');
    assert.ok(row, 'expected a SummaryProbe row');
    assert.equal(row.count, 10);
    assert.ok(row.shallowSize > 0);
  });

  delete globalThis.__summaryProbeInstances;
});
