import { parseArgs } from 'node:util';
import { loadSnapshot } from '../snapshot.js';
import { computeDominators } from '../graph/dominator.js';
import { computeRetainedSizes } from '../graph/retained_size.js';
import { summarizeRetainedByConstructor } from '../report/retained_by_constructor.js';
import { withDisplaySize } from '../report/with_display_size.js';
import { renderTable } from '../cli/render_table.js';
import { UsageError } from '../errors.js';

/** `heap-analysis retained --file <path> [--top N] [--json]` -- retained
 * bytes grouped by constructor, largest first. */
export async function retainedCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: 'string' },
      top: { type: 'string', default: '10' },
      json: { type: 'boolean' },
    },
  });

  if (!values.file) throw new UsageError('retained requires --file <path>');
  const top = Number(values.top);
  if (!Number.isInteger(top) || top < 0) throw new UsageError(`--top must be a non-negative integer, got \`${values.top}\``);

  const snapshot = await loadSnapshot(values.file);
  const idom = computeDominators(snapshot);
  const retained = computeRetainedSizes(snapshot, idom);
  const rows = summarizeRetainedByConstructor(snapshot, retained, { top });

  if (values.json) {
    process.stdout.write(`${JSON.stringify(rows)}\n`);
    return;
  }
  process.stdout.write(
    `${renderTable(withDisplaySize(rows, 'totalRetained'), [
      { key: 'group', header: 'group' },
      { key: 'count', header: 'count', align: 'right' },
      { key: 'totalRetained', header: 'totalRetained', align: 'right' },
    ])}\n`,
  );
}
