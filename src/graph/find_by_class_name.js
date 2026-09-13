/**
 * Every reachable nodeIndex whose constructor name matches `className`
 * exactly (an `object` node's own name), for building a target list
 * before calling shortestPathToRoot/allPathsToRoot on each. A trailing
 * `*` makes it a prefix match instead ("User*" also matches
 * "UserSession"), for when that's actually what's wanted.
 */
export function findByClassName(snapshot, className) {
  const prefix = className.endsWith('*');
  const wanted = prefix ? className.slice(0, -1) : className;
  const matches = [];
  for (const nodeIndex of snapshot.reachableNodes()) {
    if (snapshot.typeOf(nodeIndex) !== 'object') continue;
    const name = snapshot.nameOf(nodeIndex);
    if (prefix ? name.startsWith(wanted) : name === wanted) matches.push(nodeIndex);
  }
  return matches;
}
