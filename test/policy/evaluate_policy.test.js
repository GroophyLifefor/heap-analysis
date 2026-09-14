import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot } from '../../src/snapshot.js';
import { evaluatePolicy } from '../../src/policy/evaluate_policy.js';
import { tinySnapshot } from '../helpers/fixture.js';

function policy(rules) {
  return { rules: rules.map((r) => ({ severity: 'error', ...r })) };
}

test('maxRetainedByConstructor passes when under the limit', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { violations } = evaluatePolicy(snap, policy([{ id: 'r1', type: 'maxRetainedByConstructor', constructor: 'Foo', maxBytes: 1000 }]));
  assert.deepEqual(violations, []);
});

test('maxRetainedByConstructor reports a violation when over the limit', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { violations } = evaluatePolicy(snap, policy([{ id: 'r1', type: 'maxRetainedByConstructor', constructor: 'Foo', maxBytes: 1 }]));
  assert.equal(violations.length, 1);
  assert.equal(violations[0].id, 'r1');
  assert.match(violations[0].message, /Foo/);
});

test('a constructor with no matching group counts as 0 bytes retained', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { violations } = evaluatePolicy(snap, policy([{ id: 'r1', type: 'maxRetainedByConstructor', constructor: 'NoSuchClass', maxBytes: 0 }]));
  assert.deepEqual(violations, []);
});

test('noDetachedNodes passes on a fixture with nothing detached', () => {
  const snap = parseSnapshot(tinySnapshot());
  const { violations } = evaluatePolicy(snap, policy([{ id: 'r1', type: 'noDetachedNodes' }]));
  assert.deepEqual(violations, []);
});

test('noDetachedNodes reports a violation when a node is marked detached', () => {
  const json = tinySnapshot();
  json.nodes[1 * 6 + 5] = 2; // Foo's detachedness field
  const snap = parseSnapshot(json);
  const { violations } = evaluatePolicy(snap, policy([{ id: 'r1', type: 'noDetachedNodes' }]));
  assert.equal(violations.length, 1);
});

test('evaluating an empty rule set finds nothing', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.deepEqual(evaluatePolicy(snap, policy([])), { violations: [], ruleErrors: [] });
});

test('a rule with an unknown type does not throw or crash the run', () => {
  const snap = parseSnapshot(tinySnapshot());
  assert.doesNotThrow(() => evaluatePolicy(snap, policy([{ id: 'r1', type: 'notARealRuleType' }])));
});
