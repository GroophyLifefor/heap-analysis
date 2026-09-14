import { diffByClass } from './class_diff.js';

/**
 * Classes growing between two snapshots of the same process, ranked by how
 * much (not just by how many bytes) -- a class that doubled is more likely
 * a leak than one that grew 1% even if the 1% is more bytes.
 *
 * `growthRatio` is `sizeDelta / sizeBefore` (1 means it doubled), `null` for
 * a class with no `before` bytes at all (`isNew: true` instead) -- there's
 * no bytes to divide by, and JSON has no way to write Infinity (it becomes
 * `null` on the wire anyway, so this makes that explicit rather than an
 * accident of stringifying a division). Only classes that grew
 * (sizeDelta > 0) are included.
 *
 * Returns `diffByClass` rows plus `growthRatio` and `isNew`, brand new
 * classes first, then the rest by largest ratio.
 */
export function findGrowth(before, after, { top = 10 } = {}) {
  const rows = diffByClass(before, after, { top: Infinity })
    .filter((row) => row.sizeDelta > 0)
    .map((row) => ({
      ...row,
      isNew: row.sizeBefore === 0,
      growthRatio: row.sizeBefore === 0 ? null : row.sizeDelta / row.sizeBefore,
    }));

  rows.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return a.isNew ? b.sizeDelta - a.sizeDelta : b.growthRatio - a.growthRatio;
  });
  return rows.slice(0, top);
}
