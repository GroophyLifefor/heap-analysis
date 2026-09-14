import { createInterface } from 'node:readline';
import { handleRequest } from './handle_request.js';

/** Runs the MCP stdio transport: one JSON-RPC request per line on stdin,
 * one JSON-RPC response per line on stdout. Anything on stderr is safe to
 * ignore for a client, so that's where an unparseable line's error goes
 * rather than stdout, which the protocol requires stay pure JSON-RPC. */
export function runMcpServer({ input = process.stdin, output = process.stdout } = {}) {
  const rl = createInterface({ input });
  rl.on('line', async (line) => {
    if (line.trim() === '') return;
    let request;
    try {
      request = JSON.parse(line);
    } catch (cause) {
      process.stderr.write(`invalid JSON-RPC line: ${cause.message}\n`);
      return;
    }
    const response = await handleRequest(request);
    output.write(`${JSON.stringify(response)}\n`);
  });
}
