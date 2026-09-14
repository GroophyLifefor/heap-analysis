import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli.js';
import { UsageError } from '../../src/errors.js';
import { tinySnapshot } from '../helpers/fixture.js';

async function withSnapshotFile(run) {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-cli-'));
  const file = join(dir, 'test.heapsnapshot');
  await writeFile(file, JSON.stringify(tinySnapshot()));
  try {
    await run(file);
  } finally {
    await unlink(file);
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

test('retained without --file is a UsageError', async () => {
  await assert.rejects(() => runCli(['retained']), UsageError);
});

test('retained --json prints valid JSON with a Foo group', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['retained', '--file', file, '--json']));
    const rows = JSON.parse(output);
    assert.ok(rows.some((r) => r.group === 'Foo'));
  });
});

test('retained --json keeps totalRetained a number, not a "1.2 MB" style string', () => {
  return withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['retained', '--file', file, '--json']));
    const rows = JSON.parse(output);
    const foo = rows.find((r) => r.group === 'Foo');
    assert.equal(typeof foo.totalRetained, 'number');
    assert.equal(foo.totalRetained, 64);
  });
});

test('retained prints a table with the group column', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['retained', '--file', file]));
    assert.match(output, /group/);
    assert.match(output, /Foo/);
  });
});
