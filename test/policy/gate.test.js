import test from 'node:test';
import assert from 'node:assert/strict';
import { gateResult } from '../../src/policy/gate.js';

test('no violations and no rule errors exits 0', () => {
  const result = gateResult({ violations: [], ruleErrors: [] });
  assert.equal(result.exitCode, 0);
});

test('any rule error exits 2, regardless of failOn', () => {
  const evaluation = { violations: [], ruleErrors: [{ id: 'r1', message: 'broken' }] };
  assert.equal(gateResult(evaluation, { failOn: 'warning' }).exitCode, 2);
  assert.equal(gateResult(evaluation, { failOn: 'error' }).exitCode, 2);
});

test('an error-severity violation fails the gate when failOn is warning', () => {
  const evaluation = { violations: [{ id: 'r1', severity: 'error', message: 'x' }], ruleErrors: [] };
  assert.equal(gateResult(evaluation, { failOn: 'warning' }).exitCode, 1);
});

test('gateResult passes through violations and ruleErrors unchanged', () => {
  const evaluation = { violations: [{ id: 'r1', severity: 'error', message: 'x' }], ruleErrors: [] };
  const result = gateResult(evaluation, { failOn: 'warning' });
  assert.deepEqual(result.violations, evaluation.violations);
  assert.deepEqual(result.ruleErrors, evaluation.ruleErrors);
});
