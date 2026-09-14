import test from 'node:test';
import assert from 'node:assert/strict';
import { humanSize } from '../../src/report/human_size.js';

test('bytes under 1024 are shown as a plain integer', () => {
  assert.equal(humanSize(0), '0 bytes');
  assert.equal(humanSize(512), '512 bytes');
});

test('crosses each unit boundary', () => {
  assert.equal(humanSize(1024), '1.0 KB');
  assert.equal(humanSize(1024 * 1024), '1.0 MB');
  assert.equal(humanSize(1024 * 1024 * 1024), '1.0 GB');
});

test('rounds to one decimal place', () => {
  assert.equal(humanSize(1536), '1.5 KB');
});
