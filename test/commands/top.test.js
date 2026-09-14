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

test('top without --file is a UsageError', async () => {
  await assert.rejects(() => runCli(['top']), UsageError);
});

test('top --json prints valid JSON, largest retained instance first', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['top', '--file', file, '--json']));
    const rows = JSON.parse(output);
    assert.equal(rows[0].index, 0); // root, ties with Foo at 64, index breaks the tie
  });
});

test('top --top limits the row count', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['top', '--file', file, '--top', '1', '--json']));
    assert.equal(JSON.parse(output).length, 1);
  });
});

test('top prints a table with the name column', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['top', '--file', file]));
    assert.match(output, /name/);
    assert.match(output, /Foo/);
  });
});
