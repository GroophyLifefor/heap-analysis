import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli.js';
import { UsageError } from '../../src/errors.js';
import { tinySnapshot } from '../helpers/fixture.js';

async function withFiles({ snapshot = tinySnapshot(), policy }, run) {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-check-'));
  const snapshotFile = join(dir, 'test.heapsnapshot');
  const policyFile = join(dir, 'policy.json');
  await writeFile(snapshotFile, JSON.stringify(snapshot));
  await writeFile(policyFile, JSON.stringify(policy));
  try {
    await run(snapshotFile, policyFile, dir);
  } finally {
    await unlink(snapshotFile);
    await unlink(policyFile);
  }
}

async function captureStdout(run) {
  const chunks = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => {
    chunks.push(chunk);
    return true;
  };
  try {
    await run();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

test('check without --file is a UsageError', async () => {
  await assert.rejects(() => runCli(['check', '--policy', 'x']), UsageError);
});

test('check without --policy is a UsageError', async () => {
  await assert.rejects(() => runCli(['check', '--file', 'x']), UsageError);
});

test('a clean policy exits 0 and says so', async () => {
  await withFiles({ policy: { rules: [{ id: 'r1', type: 'noDetachedNodes' }] } }, async (snapshotFile, policyFile) => {
    const output = await captureStdout(() => runCli(['check', '--file', snapshotFile, '--policy', policyFile]));
    assert.equal(process.exitCode, 0);
    assert.match(output, /policy check passed/);
    process.exitCode = 0;
  });
});

test('a broken rule exits 2', async () => {
  await withFiles(
    { policy: { rules: [{ id: 'r1', type: 'notARealType' }] } },
    async (snapshotFile, policyFile) => {
      await captureStdout(() => runCli(['check', '--file', snapshotFile, '--policy', policyFile]));
      assert.equal(process.exitCode, 2);
      process.exitCode = 0;
    },
  );
});

test('--junit writes a JUnit XML file', async () => {
  await withFiles({ policy: { rules: [{ id: 'r1', type: 'noDetachedNodes' }] } }, async (snapshotFile, policyFile, dir) => {
    const junitFile = join(dir, 'out.xml');
    await captureStdout(() => runCli(['check', '--file', snapshotFile, '--policy', policyFile, '--junit', junitFile]));
    process.exitCode = 0;
    const xml = await readFile(junitFile, 'utf8');
    assert.match(xml, /<testsuite/);
    await unlink(junitFile);
  });
});

test('--github-actions prints annotation lines instead of the plain report', async () => {
  await withFiles(
    { policy: { rules: [{ id: 'r1', type: 'notARealType' }] } },
    async (snapshotFile, policyFile) => {
      const output = await captureStdout(() =>
        runCli(['check', '--file', snapshotFile, '--policy', policyFile, '--github-actions']),
      );
      process.exitCode = 0;
      assert.match(output, /^::error::/);
    },
  );
});
