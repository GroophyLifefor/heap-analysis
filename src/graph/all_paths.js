/**
 * Every simple path from `nodeIndex` back to the root, walking referrers
 * (backward), up to `maxPaths` total -- a real object graph can have
 * enough shared fan-in (a common prototype, a module cache) that
 * enumerating every path without a cap is not safe to attempt.
 *
 * `onPath` guards against a path revisiting a node it already passed
 * through (referrersOf can have cycles in general, this does not walk the
 * dominator tree). Returns an array of root-first nodeIndex arrays.
 */
export function allPathsToRoot(snapshot, nodeIndex, maxPaths) {
  const paths = [];
  const onPath = new Set();

  function search(current, tail) {
    if (paths.length >= maxPaths) return;
    if (current === 0) {
      paths.push([current, ...tail]);
      return;
    }
    onPath.add(current);
    for (const referrer of snapshot.referrersOf(current)) {
      if (onPath.has(referrer)) continue;
      if (paths.length >= maxPaths) break;
      search(referrer, [current, ...tail]);
    }
    onPath.delete(current);
  }

  search(nodeIndex, []);
  return paths;
}
