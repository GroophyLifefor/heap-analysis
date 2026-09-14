import { parseArgs } from 'node:util';
import { loadSnapshot } from '../snapshot.js';
import { findByClassName } from '../graph/find_by_class_name.js';
import { shortestPathToRoot } from '../graph/gc_path.js';
import { renderPath } from '../graph/render_path.js';
import { UsageError } from '../errors.js';

/** `heap-analysis gc-path --file <path> --class <name> [--top N] [--json]`
 * -- the shortest path from a GC root to each reachable instance of
 * `class` (exact match, or a trailing `*` for a prefix match). */
export async function gcPathCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: 'string' },
      class: { type: 'string' },
      top: { type: 'string', default: '10' },
      json: { type: 'boolean' },
    },
  });

  if (!values.file) throw new UsageError('gc-path requires --file <path>');
  if (!values.class) throw new UsageError('gc-path requires --class <name>');
  const top = Number(values.top);
  if (!Number.isInteger(top) || top < 0) throw new UsageError(`--top must be a non-negative integer, got \`${values.top}\``);

  const snapshot = await loadSnapshot(values.file);
  const matches = findByClassName(snapshot, values.class).slice(0, top);
  const rows = matches
    .map((nodeIndex) => ({ nodeIndex, path: shortestPathToRoot(snapshot, nodeIndex) }))
    .filter((row) => row.path !== null);

  if (values.json) {
    process.stdout.write(`${JSON.stringify(rows)}\n`);
    return;
  }

  if (rows.length === 0) {
    process.stdout.write(`no reachable instance of \`${values.class}\` found\n`);
    return;
  }
  process.stdout.write(`${rows.map((row) => renderPath(snapshot, row.path)).join('\n')}\n`);
}
