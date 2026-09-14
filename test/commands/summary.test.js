import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
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

test('summary without --file is a UsageError', async () => {
  await assert.rejects(() => runCli(['summary']), UsageError);
});

test('summary --json prints valid JSON matching summarize()', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['summary', '--file', file, '--json']));
    const rows = JSON.parse(output);
    assert.ok(rows.some((r) => r.group === 'Foo' && r.shallowSize === 40));
  });
});

test('summary prints a table with the group and shallowSize columns', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['summary', '--file', file]));
    assert.match(output, /group/);
    assert.match(output, /Foo/);
    assert.match(output, /40/);
  });
});

test('summary --top limits the row count', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['summary', '--file', file, '--top', '1', '--json']));
    assert.equal(JSON.parse(output).length, 1);
  });
});
