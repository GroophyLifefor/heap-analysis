import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli.js';
import { UsageError } from '../../src/errors.js';
import { tinySnapshot } from '../helpers/fixture.js';

async function withSnapshotFiles(beforeJson, afterJson, run) {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-cli-'));
  const before = join(dir, 'before.heapsnapshot');
  const after = join(dir, 'after.heapsnapshot');
  await writeFile(before, JSON.stringify(beforeJson));
  await writeFile(after, JSON.stringify(afterJson));
  try {
    await run(before, after);
  } finally {
    await unlink(before);
    await unlink(after);
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

function withNewFoo() {
  const json = tinySnapshot();
  json.snapshot.node_count = 4;
  json.nodes.push(3, 1, 99, 40, 0, 0);
  return json;
}

test('diff without --before/--after is a UsageError', async () => {
  await assert.rejects(() => runCli(['diff', '--after', 'x']), UsageError);
});

test('diff --mode class --json shows the Foo count grew by 1', async () => {
  await withSnapshotFiles(tinySnapshot(), withNewFoo(), async (before, after) => {
    const output = await captureStdout(() =>
      runCli(['diff', '--before', before, '--after', after, '--mode', 'class', '--json']),
    );
    const rows = JSON.parse(output);
    const foo = rows.find((r) => r.group === 'Foo');
    assert.equal(foo.countDelta, 1);
  });
});

test('diff --mode object --json shows the new Foo as added', async () => {
  await withSnapshotFiles(tinySnapshot(), withNewFoo(), async (before, after) => {
    const output = await captureStdout(() =>
      runCli(['diff', '--before', before, '--after', after, '--mode', 'object', '--json']),
    );
    const { added, removed } = JSON.parse(output);
    assert.equal(added.length, 1);
    assert.equal(added[0].id, 99);
    assert.deepEqual(removed, []);
  });
});

test('diff --mode growth reports Foo growing', async () => {
  await withSnapshotFiles(tinySnapshot(), withNewFoo(), async (before, after) => {
    const output = await captureStdout(() =>
      runCli(['diff', '--before', before, '--after', after, '--mode', 'growth', '--json']),
    );
    const rows = JSON.parse(output);
    assert.ok(rows.some((r) => r.group === 'Foo'));
  });
});

test('diff with an invalid --mode is a UsageError', async () => {
  await withSnapshotFiles(tinySnapshot(), tinySnapshot(), async (before, after) => {
    await assert.rejects(() => runCli(['diff', '--before', before, '--after', after, '--mode', 'nope']), UsageError);
  });
});

test('diff (default class mode) prints a table', async () => {
  await withSnapshotFiles(tinySnapshot(), withNewFoo(), async (before, after) => {
    const output = await captureStdout(() => runCli(['diff', '--before', before, '--after', after]));
    assert.match(output, /group/);
    assert.match(output, /Foo/);
  });
});
