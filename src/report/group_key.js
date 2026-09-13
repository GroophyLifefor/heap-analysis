/**
 * The group a node belongs to for a by-constructor style report. An
 * `object` node is grouped by its constructor name, because that is the
 * question someone opening a heap is actually asking ("how many User
 * objects are alive"). Every other node type is grouped by the type
 * itself, in parentheses, because names are not identities there: a
 * `string` node's name is its contents, so grouping those by name would
 * produce one group per distinct string in the heap.
 */
export function groupKeyOf(snapshot, nodeIndex) {
  const type = snapshot.typeOf(nodeIndex);
  if (type !== 'object') return `(${type})`;
  const name = snapshot.nameOf(nodeIndex);
  return name === '' ? '(anonymous object)' : name;
}
