import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGithubActions } from '../../src/policy/render_github_actions.js';

test('a violation renders as its own severity level', () => {
  const output = renderGithubActions({
    violations: [{ id: 'r1', severity: 'warning', message: 'x' }],
    ruleErrors: [],
  });
  assert.equal(output, '::warning::[r1] x');
});

test('a rule error always renders as error, regardless of the broken rule\'s own severity', () => {
  const output = renderGithubActions({ violations: [], ruleErrors: [{ id: 'r1', message: 'broken' }] });
  assert.equal(output, '::error::[r1] rule could not run: broken');
});

test('nothing to report renders an empty string', () => {
  assert.equal(renderGithubActions({ violations: [], ruleErrors: [] }), '');
});
