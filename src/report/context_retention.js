/**
 * Context objects captured by more than one closure -- freeing any single
 * one of those closures still leaves the whole shared context (everything
 * else it holds, not just what that closure reads) alive as long as
 * another closure keeps it.
 *
 * Returns decoded node objects (as node() does) plus `closureCount`,
 * largest closureCount first.
 */
export function findContextRetention(snapshot, { top = 10 } = {}) {
  const rows = [];
  for (let i = 0; i < snapshot.nodeCount; i++) {
    const closureCount = snapshot.contextRetainerCountOf(i);
    if (closureCount < 2) continue;
    rows.push({ ...snapshot.node(i), closureCount });
  }
  rows.sort((a, b) => b.closureCount - a.closureCount);
  return rows.slice(0, top);
}
