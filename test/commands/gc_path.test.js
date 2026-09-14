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

test('gc-path without --file is a UsageError', async () => {
  await assert.rejects(() => runCli(['gc-path', '--class', 'Foo']), UsageError);
});

test('gc-path without --class is a UsageError', async () => {
  await withSnapshotFile(async (file) => {
    await assert.rejects(() => runCli(['gc-path', '--file', file]), UsageError);
  });
});

test('gc-path --json returns the path for the matching instance', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['gc-path', '--file', file, '--class', 'Foo', '--json']));
    const rows = JSON.parse(output);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].path, [0, 1]);
  });
});

test('gc-path prints a rendered path with the class name in it', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['gc-path', '--file', file, '--class', 'Foo']));
    assert.match(output, /Foo/);
    assert.match(output, /-->/);
  });
});

test('gc-path for a class with no reachable instance says so', async () => {
  await withSnapshotFile(async (file) => {
    const output = await captureStdout(() => runCli(['gc-path', '--file', file, '--class', 'Nope']));
    assert.match(output, /no reachable instance/);
  });
});
