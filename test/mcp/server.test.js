import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const binPath = fileURLToPath(new URL('../../bin/heap-analysis-mcp.js', import.meta.url));

test('the mcp server responds to an initialize request over stdio', async () => {
  const child = spawn(process.execPath, [binPath]);
  const response = await new Promise((resolve, reject) => {
    let buffer = '';
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      const newline = buffer.indexOf('\n');
      if (newline !== -1) resolve(JSON.parse(buffer.slice(0, newline)));
    });
    child.on('error', reject);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' })}\n`);
  });
  child.kill();

  assert.equal(response.id, 1);
  assert.ok(response.result.protocolVersion);
});
