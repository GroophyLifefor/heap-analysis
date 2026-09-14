import { diffByClass } from './class_diff.js';

/**
 * Classes growing between two snapshots of the same process, ranked by how
 * much (not just by how many bytes) -- a class that doubled is more likely
 * a leak than one that grew 1% even if the 1% is more bytes.
 *
 * `growthRatio` is `sizeDelta / sizeBefore` (1 means it doubled). Only
 * classes that grew (sizeDelta > 0) are included.
 *
 * Returns `diffByClass` rows plus `growthRatio`, largest ratio first.
 */
export function findGrowth(before, after, { top = 10 } = {}) {
  const rows = diffByClass(before, after, { top: Infinity })
    .filter((row) => row.sizeDelta > 0)
    .map((row) => ({ ...row, growthRatio: row.sizeDelta / row.sizeBefore }));

  rows.sort((a, b) => b.growthRatio - a.growthRatio);
  return rows.slice(0, top);
}
