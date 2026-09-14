import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPolicy } from '../../src/policy/load_policy.js';
import { InvalidPolicyError } from '../../src/errors.js';

async function withPolicyFile(content, run) {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-policy-'));
  const file = join(dir, 'policy.json');
  await writeFile(file, typeof content === 'string' ? content : JSON.stringify(content));
  try {
    return await run(file);
  } finally {
    await unlink(file);
  }
}

test('loads a well formed policy and defaults severity to error', async () => {
  await withPolicyFile({ rules: [{ id: 'r1', type: 'maxRetainedByConstructor', maxBytes: 1000 }] }, async (file) => {
    const { rules } = await loadPolicy(file);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].severity, 'error');
    assert.equal(rules[0].maxBytes, 1000);
  });
});

test('keeps an explicit severity as given', async () => {
  await withPolicyFile({ rules: [{ id: 'r1', type: 'x', severity: 'warning' }] }, async (file) => {
    const { rules } = await loadPolicy(file);
    assert.equal(rules[0].severity, 'warning');
  });
});

test('an empty rules array is valid', async () => {
  await withPolicyFile({ rules: [] }, async (file) => {
    assert.deepEqual(await loadPolicy(file), { rules: [] });
  });
});

test('a missing file is an InvalidPolicyError', async () => {
  await assert.rejects(() => loadPolicy('/no/such/policy.json'), InvalidPolicyError);
});

test('invalid JSON is an InvalidPolicyError', async () => {
  await withPolicyFile('not json', async (file) => {
    await assert.rejects(() => loadPolicy(file), InvalidPolicyError);
  });
});

test('a missing top-level rules array is an InvalidPolicyError', async () => {
  await withPolicyFile({ notRules: [] }, async (file) => {
    await assert.rejects(() => loadPolicy(file), InvalidPolicyError);
  });
});

test('a rule with no id is an InvalidPolicyError', async () => {
  await withPolicyFile({ rules: [{ type: 'x' }] }, async (file) => {
    await assert.rejects(() => loadPolicy(file), InvalidPolicyError);
  });
});

test('a rule with no type is an InvalidPolicyError', async () => {
  await withPolicyFile({ rules: [{ id: 'r1' }] }, async (file) => {
    await assert.rejects(() => loadPolicy(file), InvalidPolicyError);
  });
});

test('a duplicate rule id is an InvalidPolicyError', async () => {
  await withPolicyFile({ rules: [{ id: 'r1', type: 'x' }, { id: 'r1', type: 'y' }] }, async (file) => {
    await assert.rejects(() => loadPolicy(file), InvalidPolicyError);
  });
});

test('an invalid severity is an InvalidPolicyError', async () => {
  await withPolicyFile({ rules: [{ id: 'r1', type: 'x', severity: 'critical' }] }, async (file) => {
    await assert.rejects(() => loadPolicy(file), InvalidPolicyError);
  });
});
