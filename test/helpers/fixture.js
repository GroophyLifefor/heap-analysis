import { writeHeapSnapshot } from 'node:v8';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A hand built snapshot small enough to reason about by hand, shaped exactly
 * like a real one (node_fields, edge_fields, and every count line up), for
 * tests about decoding rather than about real heap contents.
 *
 *   node 0  synthetic  ""       0 bytes   -> node 1 (property "prop")
 *   node 1  object     "Foo"   40 bytes   -> node 2 (property "prop")
 *   node 2  string     "hello" 24 bytes
 *
 * This mirrors the real node_fields/edge_fields layout observed from
 * `v8.writeHeapSnapshot()` on Node 24 (six node fields, three edge fields).
 * A real snapshot also carries `trace_function_infos`, `trace_tree`,
 * `samples`, and `locations` at the top level; this package does not read
 * any of those yet, so they are intentionally left out here.
 */
export function tinySnapshot() {
  const NODE_STRIDE = 6; // type, name, id, self_size, edge_count, detachedness
  return {
    snapshot: {
      meta: {
        node_fields: ['type', 'name', 'id', 'self_size', 'edge_count', 'detachedness'],
        node_types: [
          ['hidden', 'array', 'string', 'object', 'code', 'closure', 'regexp',
            'number', 'native', 'synthetic', 'concatenated string',
            'sliced string', 'symbol', 'bigint', 'object shape'],
          'string', 'number', 'number', 'number', 'number',
        ],
        edge_fields: ['type', 'name_or_index', 'to_node'],
        edge_types: [
          ['context', 'element', 'property', 'internal', 'hidden', 'shortcut', 'weak'],
          'string_or_number', 'node',
        ],
      },
      node_count: 3,
      edge_count: 2,
    },
    nodes: [
      9, 0, 1, 0, 1, 0, // node 0: synthetic root
      3, 1, 3, 40, 1, 0, // node 1: object "Foo"
      2, 2, 5, 24, 0, 0, // node 2: string "hello"
    ],
    edges: [
      2, 3, 1 * NODE_STRIDE, // property "prop" -> node 1
      2, 3, 2 * NODE_STRIDE, // property "prop" -> node 2
    ],
    strings: ['', 'Foo', 'hello', 'prop'],
  };
}

/**
 * Writes a real snapshot of the running test process to a temp file and
 * hands its path to `run`, cleaning up afterward regardless of outcome. Use
 * this for invariants a hand written fixture would be too clean to catch,
 * `tinySnapshot()` above for anything about decoding itself.
 */
export async function withRealSnapshot(run) {
  const dir = await mkdtemp(join(tmpdir(), 'heap-analysis-'));
  const file = join(dir, 'test.heapsnapshot');
  try {
    writeHeapSnapshot(file);
    return await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
