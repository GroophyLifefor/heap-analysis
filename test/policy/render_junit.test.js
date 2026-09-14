import test from 'node:test';
import assert from 'node:assert/strict';
import { renderJUnit } from '../../src/policy/render_junit.js';

test('a passing rule renders as a testcase with no failure', () => {
  const xml = renderJUnit({ violations: [], ruleErrors: [] }, { rules: [{ id: 'r1' }] });
  assert.match(xml, /<testcase name="r1"\/>/);
  assert.doesNotMatch(xml, /<failure/);
});

test('a violated rule renders a failure with its message', () => {
  const xml = renderJUnit(
    { violations: [{ id: 'r1', severity: 'error', message: 'too big' }], ruleErrors: [] },
    { rules: [{ id: 'r1' }] },
  );
  assert.match(xml, /<failure message="too big"/);
});

test('escapes XML special characters in the message', () => {
  const xml = renderJUnit(
    { violations: [{ id: 'r1', severity: 'error', message: '<a> & "b"' }], ruleErrors: [] },
    { rules: [{ id: 'r1' }] },
  );
  assert.match(xml, /&lt;a&gt; &amp; &quot;b&quot;/);
});

test('the testsuite counts tests and failures', () => {
  const xml = renderJUnit(
    { violations: [{ id: 'r1', severity: 'error', message: 'x' }], ruleErrors: [] },
    { rules: [{ id: 'r1' }, { id: 'r2' }] },
  );
  assert.match(xml, /tests="2" failures="1"/);
});
