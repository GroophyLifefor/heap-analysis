import { parseArgs } from 'node:util';
import { loadSnapshot } from '../snapshot.js';
import { summarize } from '../report/summary.js';
import { renderTable } from '../cli/render_table.js';
import { UsageError } from '../errors.js';

/** `heap-analysis summary --file <path> [--top N] [--json]` -- shallow
 * bytes grouped by constructor/type, largest total first. */
export async function summaryCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: 'string' },
      top: { type: 'string', default: '10' },
      json: { type: 'boolean' },
    },
  });

  if (!values.file) throw new UsageError('summary requires --file <path>');
  const top = Number(values.top);
  if (!Number.isInteger(top) || top < 0) throw new UsageError(`--top must be a non-negative integer, got \`${values.top}\``);

  const snapshot = await loadSnapshot(values.file);
  const rows = summarize(snapshot, { top });

  if (values.json) {
    process.stdout.write(`${JSON.stringify(rows)}\n`);
    return;
  }
  process.stdout.write(
    `${renderTable(rows, [
      { key: 'group', header: 'group' },
      { key: 'count', header: 'count', align: 'right' },
      { key: 'shallowSize', header: 'shallowSize (bytes)', align: 'right' },
    ])}\n`,
  );
}
