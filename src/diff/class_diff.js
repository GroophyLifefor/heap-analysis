import { groupKeyOf } from '../report/group_key.js';

/**
 * How each constructor/type group (see groupKeyOf) changed in size between
 * two snapshots of the same process. Coarser than an object-level diff:
 * "Foo grew by 3MB" without saying which Foo instances are new -- useful as
 * a first pass to find which class to look at closer.
 *
 * Returns `{ group, countBefore, countAfter, countDelta, sizeBefore,
 * sizeAfter, sizeDelta }[]`, sorted by the biggest absolute sizeDelta
 * first. Sizes in bytes.
 */
export function diffByClass(before, after, { top = Infinity } = {}) {
  const b = summarizeByGroup(before);
  const a = summarizeByGroup(after);

  const groups = new Set([...b.counts.keys(), ...a.counts.keys()]);
  const rows = [];
  for (const group of groups) {
    const countBefore = b.counts.get(group) ?? 0;
    const countAfter = a.counts.get(group) ?? 0;
    const sizeBefore = b.sizes.get(group) ?? 0;
    const sizeAfter = a.sizes.get(group) ?? 0;
    rows.push({
      group,
      countBefore,
      countAfter,
      countDelta: countAfter - countBefore,
      sizeBefore,
      sizeAfter,
      sizeDelta: sizeAfter - sizeBefore,
    });
  }

  rows.sort((x, y) => Math.abs(y.sizeDelta) - Math.abs(x.sizeDelta));
  return Number.isFinite(top) ? rows.slice(0, top) : rows;
}

function summarizeByGroup(snapshot) {
  const counts = new Map();
  const sizes = new Map();
  for (const node of snapshot) {
    const key = groupKeyOf(snapshot, node.index);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    sizes.set(key, (sizes.get(key) ?? 0) + node.selfSize);
  }
  return { counts, sizes };
}
