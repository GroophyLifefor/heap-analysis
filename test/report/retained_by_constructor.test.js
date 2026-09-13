import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, loadSnapshot } from '../../src/snapshot.js';
import { computeDominators } from '../../src/graph/dominator.js';
import { computeRetainedSizes } from '../../src/graph/retained_size.js';
import { summarizeRetainedByConstructor } from '../../src/report/retained_by_constructor.js';
import { tinySnapshot, withRealSnapshot } from '../helpers/fixture.js';

function summarize(json, options) {
  const snap = parseSnapshot(json);
  const idom = computeDominators(snap);
  const retained = computeRetainedSizes(snap, idom);
  return summarizeRetainedByConstructor(snap, retained, options);
}

test('groups the tiny fixture into one row per constructor/type', () => {
  const rows = summarize(tinySnapshot());
  const byGroup = new Map(rows.map((r) => [r.group, r.count]));
  assert.deepEqual(byGroup, new Map([['(synthetic)', 1], ['Foo', 1], ['(string)', 1]]));
});

test('honours top on a real snapshot, where sizes clearly differ', async () => {
  class BigProbe {
    constructor() {
      this.buf = Buffer.alloc(4096);
    }
  }
  globalThis.__bigProbeInstances = Array.from({ length: 50 }, () => new BigProbe());

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    const retained = computeRetainedSizes(snap, idom);
    const all = summarizeRetainedByConstructor(snap, retained);
    const top1 = summarizeRetainedByConstructor(snap, retained, { top: 1 });
    assert.equal(top1.length, 1);
    assert.deepEqual(top1[0], all[0]);
  });

  delete globalThis.__bigProbeInstances;
});

test('on a real snapshot, a class with several instances is reported with the right count', async () => {
  class GroupKeyProbe {
    constructor() {
      this.buf = Buffer.alloc(64);
    }
  }
  globalThis.__groupKeyProbeInstances = Array.from({ length: 25 }, () => new GroupKeyProbe());

  await withRealSnapshot(async (file) => {
    const snap = await loadSnapshot(file);
    const idom = computeDominators(snap);
    const retained = computeRetainedSizes(snap, idom);
    const rows = summarizeRetainedByConstructor(snap, retained);
    const row = rows.find((r) => r.group === 'GroupKeyProbe');
    assert.ok(row, 'expected a GroupKeyProbe row in the summary');
    assert.equal(row.count, 25);
    assert.equal(typeof row.totalRetained, 'number');
  });

  delete globalThis.__groupKeyProbeInstances;
});
