import { parseArgs } from 'node:util';
import { loadSnapshot } from '../snapshot.js';
import { computeDominators } from '../graph/dominator.js';
import { computeRetainedSizes } from '../graph/retained_size.js';
import { topInstancesByRetainedSize } from '../report/top_instances.js';
import { withDisplaySize } from '../report/with_display_size.js';
import { renderTable } from '../cli/render_table.js';
import { UsageError } from '../errors.js';

/** `heap-analysis top --file <path> [--top N] [--json]` -- the individual
 * instances retaining the most bytes, largest first. */
export async function topCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: 'string' },
      top: { type: 'string', default: '10' },
      json: { type: 'boolean' },
    },
  });

  if (!values.file) throw new UsageError('top requires --file <path>');
  const top = Number(values.top);
  if (!Number.isInteger(top) || top < 0) throw new UsageError(`--top must be a non-negative integer, got \`${values.top}\``);

  const snapshot = await loadSnapshot(values.file);
  const idom = computeDominators(snapshot);
  const retained = computeRetainedSizes(snapshot, idom);
  const rows = withDisplaySize(topInstancesByRetainedSize(snapshot, retained, { top }), 'retainedSize');

  if (values.json) {
    process.stdout.write(`${JSON.stringify(rows)}\n`);
    return;
  }
  process.stdout.write(
    `${renderTable(rows, [
      { key: 'index', header: 'index', align: 'right' },
      { key: 'type', header: 'type' },
      { key: 'name', header: 'name' },
      { key: 'retainedSize', header: 'retainedSize', align: 'right' },
    ])}\n`,
  );
}
