import test from 'node:test';
import assert from 'node:assert/strict';
import { HeapAnalysisError, InvalidSnapshotError, OutOfRangeError, UsageError, InvalidPolicyError } from '../index.js';

test('every subclass is instanceof HeapAnalysisError and Error', () => {
  assert.ok(new InvalidSnapshotError('x') instanceof HeapAnalysisError);
  assert.ok(new InvalidSnapshotError('x') instanceof Error);
  assert.ok(new OutOfRangeError('x') instanceof HeapAnalysisError);
  assert.ok(new UsageError('x') instanceof HeapAnalysisError);
  assert.ok(new InvalidPolicyError('x') instanceof HeapAnalysisError);
});

test('name matches the concrete subclass, not the base class', () => {
  assert.equal(new InvalidSnapshotError('x').name, 'InvalidSnapshotError');
  assert.equal(new OutOfRangeError('x').name, 'OutOfRangeError');
  assert.equal(new UsageError('x').name, 'UsageError');
  assert.equal(new InvalidPolicyError('x').name, 'InvalidPolicyError');
});

test('cause survives construction', () => {
  // A constructor that forwards message but not `options` to `super()`
  // silently drops `cause` -- this is the exact mistake CONTRIBUTING.md #5
  // warns about, locked in here so it cannot regress unnoticed.
  const root = new Error('root cause');
  const wrapped = new InvalidSnapshotError('wrapped', { cause: root });
  assert.equal(wrapped.cause, root);
});
