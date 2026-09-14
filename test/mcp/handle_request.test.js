import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleRequest } from '../../src/mcp/handle_request.js';
import { tinySnapshot } from '../helpers/fixture.js';

async function withSnapshotFile(run) {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-mcp-'));
  const file = join(dir, 'test.heapsnapshot');
  await writeFile(file, JSON.stringify(tinySnapshot()));
  try {
    await run(file);
  } finally {
    await unlink(file);
  }
}

test('initialize returns protocol info', async () => {
  const response = await handleRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' });
  assert.equal(response.id, 1);
  assert.ok(response.result.protocolVersion);
  assert.ok(response.result.capabilities.tools);
});

test('tools/list returns both tools with a name and inputSchema', async () => {
  const response = await handleRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = response.result.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), ['summary', 'top_instances']);
  for (const tool of response.result.tools) {
    assert.ok(tool.inputSchema);
    assert.equal(tool.inputSchema.required[0], 'file');
  }
});

test('tools/call summary returns rows with a Foo group', async () => {
  await withSnapshotFile(async (file) => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'summary', arguments: { file } },
    });
    assert.ok(!response.result.isError);
    assert.ok(response.result.structuredContent.some((r) => r.group === 'Foo'));
  });
});

test('tools/call top_instances returns the root instance first', async () => {
  await withSnapshotFile(async (file) => {
    const response = await handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'top_instances', arguments: { file, top: 1 } },
    });
    assert.equal(response.result.structuredContent.length, 1);
    assert.equal(response.result.structuredContent[0].index, 0);
  });
});

test('every tool\'s outputSchema field types match what the handler actually returns', async () => {
  // A schema is only worth anything if a client can trust it -- this
  // pins each declared JSON Schema `type` against typeof the real field,
  // for every tool, so a schema/handler drift like top_instances'
  // retainedSize (declared string, returned number) can't creep back in.
  const { TOOLS } = await import('../../src/mcp/tools.js');
  await withSnapshotFile(async (file) => {
    for (const [name, tool] of Object.entries(TOOLS)) {
      const result = await tool.handler({ file, top: 5 });
      const properties = tool.outputSchema.items.properties;
      for (const row of result) {
        for (const [key, schema] of Object.entries(properties)) {
          const jsType = schema.type === 'number' ? 'number' : 'string';
          assert.equal(typeof row[key], jsType, `${name}.${key} declared ${schema.type}, got ${typeof row[key]}`);
        }
      }
    }
  });
});

test('tools/call for an unknown tool returns a JSON-RPC error', async () => {
  const response = await handleRequest({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } });
  assert.ok(response.error);
  assert.equal(response.error.code, -32602);
});

test('tools/call for a bad snapshot path returns an isError result, not a thrown exception', async () => {
  const response = await handleRequest({
    jsonrpc: '2.0',
    id: 6,
    method: 'tools/call',
    params: { name: 'summary', arguments: { file: '/no/such/file.heapsnapshot' } },
  });
  assert.equal(response.result.isError, true);
});

test('an unknown method returns a JSON-RPC error', async () => {
  const response = await handleRequest({ jsonrpc: '2.0', id: 7, method: 'not/a/real/method' });
  assert.ok(response.error);
  assert.equal(response.error.code, -32601);
});
