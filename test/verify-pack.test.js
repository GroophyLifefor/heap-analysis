import test from 'node:test';
import assert from 'node:assert/strict';
import { missingFiles, verifyPack, REQUIRED_FILES } from '../scripts/verify-pack.mjs';

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

test('verifyPack does not throw when everything required is packed', () => {
  assert.doesNotThrow(() => verifyPack(() => REQUIRED_FILES));
});

test('verifyPack throws when a required file is missing', () => {
  assert.throws(
    () => verifyPack(() => REQUIRED_FILES.filter((f) => f !== 'LICENSE')),
    /missing from the published tarball: LICENSE/,
  );
});

test('verifyPack propagates a failure from getPackedFiles instead of swallowing it', () => {
  // Regression: this used to be wrapped in a bare try/catch, so a failing
  // npm pack (bad package.json, npm missing) would leave the release check
  // silently green.
  const brokenPack = () => {
    throw new Error('npm pack exited with code 1');
  };
  assert.throws(() => verifyPack(brokenPack), /npm pack exited with code 1/);
});
