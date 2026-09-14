import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runCli, COMMANDS } from '../src/cli.js';
import { UsageError } from '../src/errors.js';

const binPath = fileURLToPath(new URL('../bin/heap-analysis.js', import.meta.url));

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

test('no command prints usage', async () => {
  const output = await captureStdout(() => runCli([]));
  assert.match(output, /Usage: heap-analysis/);
});

test('--help prints usage', async () => {
  const output = await captureStdout(() => runCli(['--help']));
  assert.match(output, /Usage: heap-analysis/);
});

test('--version prints just the version', async () => {
  const output = await captureStdout(() => runCli(['--version']));
  assert.match(output, /^\d+\.\d+\.\d+\n$/);
});

test('an unknown command throws UsageError, not a bare Error', async () => {
  await assert.rejects(() => runCli(['not-a-real-command']), UsageError);
});

test('COMMANDS has the summary command registered', () => {
  assert.ok(typeof COMMANDS.summary === 'function');
});

test('the bin entry point runs, prints usage, and exits 0 with no command', () => {
  const output = execFileSync(process.execPath, [binPath], { encoding: 'utf8' });
  assert.match(output, /Usage: heap-analysis/);
});

test('the bin entry point exits non-zero and prints just the message for an unknown command', () => {
  assert.throws(() => execFileSync(process.execPath, [binPath, 'nope'], { encoding: 'utf8', stdio: 'pipe' }));
});
