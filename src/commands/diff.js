import { parseArgs } from 'node:util';
import { loadSnapshot } from '../snapshot.js';
import { diffByClass } from '../diff/class_diff.js';
import { diffObjects } from '../diff/object_diff.js';
import { findGrowth } from '../diff/growth.js';
import { renderTable } from '../cli/render_table.js';
import { UsageError } from '../errors.js';

const MODES = new Set(['class', 'object', 'growth']);

/** `heap-analysis diff --before <path> --after <path> [--mode class|object|growth] [--top N] [--json]`
 * -- how a process's heap changed between two snapshots. `class` (the
 * default) is the coarsest and fastest, `object` names the actual
 * instances added/removed, `growth` ranks classes by growth ratio. */
export async function diffCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      before: { type: 'string' },
      after: { type: 'string' },
      mode: { type: 'string', default: 'class' },
      top: { type: 'string', default: '10' },
      json: { type: 'boolean' },
    },
  });

  if (!values.before) throw new UsageError('diff requires --before <path>');
  if (!values.after) throw new UsageError('diff requires --after <path>');
  if (!MODES.has(values.mode)) {
    throw new UsageError(`--mode must be one of ${[...MODES].join(', ')}, got \`${values.mode}\``);
  }
  const top = Number(values.top);
  if (!Number.isInteger(top) || top < 0) throw new UsageError(`--top must be a non-negative integer, got \`${values.top}\``);

  const before = await loadSnapshot(values.before);
  const after = await loadSnapshot(values.after);

  if (values.mode === 'object') {
    const result = diffObjects(before, after, { top });
    if (values.json) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return;
    }
    process.stdout.write(`added:\n${renderInstanceTable(result.added)}\nremoved:\n${renderInstanceTable(result.removed)}\n`);
    return;
  }

  const rows = values.mode === 'growth' ? findGrowth(before, after, { top }) : diffByClass(before, after, { top });
  if (values.json) {
    process.stdout.write(`${JSON.stringify(rows)}\n`);
    return;
  }
  process.stdout.write(
    `${renderTable(rows, [
      { key: 'group', header: 'group' },
      { key: 'countDelta', header: 'countDelta', align: 'right' },
      { key: 'sizeDelta', header: 'sizeDelta (bytes)', align: 'right' },
    ])}\n`,
  );
}

function renderInstanceTable(rows) {
  if (rows.length === 0) return '(none)\n';
  return `${renderTable(rows, [
    { key: 'index', header: 'index', align: 'right' },
    { key: 'type', header: 'type' },
    { key: 'name', header: 'name' },
    { key: 'selfSize', header: 'selfSize (bytes)', align: 'right' },
  ])}\n`;
}
