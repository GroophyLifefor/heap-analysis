import test from 'node:test';
import assert from 'node:assert/strict';
import { missingFiles, REQUIRED_FILES } from '../scripts/verify-pack.mjs';

test('missingFiles finds nothing missing when everything required is present', () => {
  assert.deepEqual(missingFiles(REQUIRED_FILES), []);
});

test('missingFiles finds nothing missing when extra files are also present', () => {
  assert.deepEqual(missingFiles([...REQUIRED_FILES, 'CONTRIBUTING.md']), []);
});

test('missingFiles reports exactly what is absent', () => {
  const withoutReadme = REQUIRED_FILES.filter((f) => f !== 'README.md');
  assert.deepEqual(missingFiles(withoutReadme), ['README.md']);
});

test('missingFiles reports everything when given an empty list', () => {
  assert.deepEqual(missingFiles([]), REQUIRED_FILES);
});
