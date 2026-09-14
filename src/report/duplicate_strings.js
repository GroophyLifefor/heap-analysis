/**
 * String values that appear more than once in the heap, largest wasted
 * bytes first. Duplicated strings are a common leak shape: the same text
 * decoded or built repeatedly instead of interned/shared once. `wastedBytes`
 * assumes one copy is kept (the largest instance seen) and the rest is
 * avoidable.
 *
 * Returns `{ value, count, totalBytes, wastedBytes }[]`, sizes in bytes.
 */
// V8 splits string storage across three node types: plain strings,
// ConsStrings from repeated concatenation, and SlicedStrings that view a
// larger string. All three carry duplicate-able string values.
const STRING_TYPES = new Set(['string', 'concatenated string', 'sliced string']);

export function findDuplicateStrings(snapshot, { top = 10 } = {}) {
  const groups = new Map();

  for (const node of snapshot) {
    if (!STRING_TYPES.has(node.type)) continue;
    const g = groups.get(node.name) ?? { value: node.name, count: 0, totalBytes: 0, maxBytes: 0 };
    g.count++;
    g.totalBytes += node.selfSize;
    if (node.selfSize > g.maxBytes) g.maxBytes = node.selfSize;
    groups.set(node.name, g);
  }

  const rows = [];
  for (const g of groups.values()) {
    if (g.count < 2) continue;
    rows.push({
      value: g.value,
      count: g.count,
      totalBytes: g.totalBytes,
      wastedBytes: g.totalBytes - g.maxBytes,
    });
  }
  rows.sort((a, b) => b.wastedBytes - a.wastedBytes || b.count - a.count);
  return rows.slice(0, top);
}
