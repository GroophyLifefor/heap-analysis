import test from 'node:test';
import assert from 'node:assert/strict';
import * as pkg from '../index.js';

test('every documented export exists and is the right kind of thing', () => {
  const functions = [
    'parseSnapshot',
    'loadSnapshot',
    'reversePostorder',
    'computeDominators',
    'buildDominatorChildren',
    'childCountOf',
    'childAt',
    'computeRetainedSizes',
    'dominatedBy',
    'isDominatedBy',
    'shortestPathToRoot',
    'renderPath',
    'allPathsToRoot',
    'findByClassName',
    'groupKeyOf',
    'summarize',
    'summarizeRetainedByConstructor',
    'topInstancesByRetainedSize',
    'findDuplicateStrings',
    'findCollectionWaste',
    'findDetachedNodes',
    'findContextRetention',
    'humanSize',
    'alignSnapshots',
    'diffByClass',
    'diffObjects',
    'findGrowth',
    'loadPolicy',
    'evaluatePolicy',
    'gateResult',
    'renderJUnit',
    'renderGithubActions',
  ];
  for (const name of functions) assert.equal(typeof pkg[name], 'function', `${name} should be exported as a function`);

  const classes = ['Snapshot', 'HeapAnalysisError', 'InvalidSnapshotError', 'OutOfRangeError', 'UsageError', 'InvalidPolicyError'];
  for (const name of classes) assert.equal(typeof pkg[name], 'function', `${name} should be exported as a class`);
});

test('a small end-to-end run using only the public exports works', async () => {
  const { parseSnapshot, computeDominators, computeRetainedSizes, summarize, summarizeRetainedByConstructor } = pkg;
  const { tinySnapshot } = await import('./helpers/fixture.js');

  const snapshot = parseSnapshot(tinySnapshot());
  const idom = computeDominators(snapshot);
  const retained = computeRetainedSizes(snapshot, idom);

  assert.ok(summarize(snapshot).some((r) => r.group === 'Foo'));
  assert.ok(summarizeRetainedByConstructor(snapshot, retained).some((r) => r.group === 'Foo'));
});
