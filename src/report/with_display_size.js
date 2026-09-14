import { humanSize } from './human_size.js';

/** Replaces `row[key]` with a human readable string, shared by the
 * `retained` and `top` CLI commands so both render size text the same
 * way instead of each reimplementing it. */
export function withDisplaySize(rows, key) {
  return rows.map((row) => ({ ...row, [key]: humanSize(row[key]) }));
}
