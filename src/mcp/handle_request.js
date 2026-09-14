import { TOOLS } from './tools.js';

const PROTOCOL_VERSION = '2025-06-18';

/**
 * Handles one parsed JSON-RPC 2.0 request against the MCP method set this
 * server implements (`initialize`, `tools/list`, `tools/call`), returning
 * a JSON-RPC response object. Kept separate from the actual stdio loop
 * (server.js) so it can be tested directly, without spawning a process
 * and speaking newline-delimited JSON over a pipe.
 */
export async function handleRequest(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'heap-analysis', version: '0.4.0' },
    });
  }

  if (method === 'tools/list') {
    return ok(id, {
      tools: Object.entries(TOOLS).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      })),
    });
  }

  if (method === 'tools/call') {
    const tool = TOOLS[params?.name];
    if (!tool) return err(id, -32602, `unknown tool \`${params?.name}\``);
    try {
      const result = await tool.handler(params.arguments ?? {});
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result });
    } catch (cause) {
      return ok(id, { isError: true, content: [{ type: 'text', text: cause.message }] });
    }
  }

  return err(id, -32601, `unknown method \`${method}\``);
}

function ok(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function err(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
