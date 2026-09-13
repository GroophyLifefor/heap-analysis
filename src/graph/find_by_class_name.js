/**
 * Every reachable nodeIndex whose constructor name matches `className`
 * (an `object` node's own name), for building a target list before
 * calling shortestPathToRoot/allPathsToRoot on each.
 */
export function findByClassName(snapshot, className) {
  const matches = [];
  for (const nodeIndex of snapshot.reachableNodes()) {
    if (snapshot.typeOf(nodeIndex) !== 'object') continue;
    if (snapshot.nameOf(nodeIndex).includes(className)) matches.push(nodeIndex);
  }
  return matches;
}
