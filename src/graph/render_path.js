/**
 * Renders a nodeIndex path (as returned by shortestPathToRoot or
 * dominatedBy, reversed to run root-first) as a human readable chain,
 * naming the edge between each pair of nodes: `.propertyName` for a named
 * property/internal/context/shortcut edge, `[index]` for an element or
 * hidden edge (they carry a numeric index, not a name).
 *
 * Example: `(GC roots) --[0]--> Array --.head--> Node {id: 3}`
 */
export function renderPath(snapshot, path) {
  const parts = [nodeLabel(snapshot, path[0])];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const edge = [...snapshot.edgesOf(from)].find((e) => e.to === to);
    parts.push(`--${edgeLabel(edge)}-->`);
    parts.push(nodeLabel(snapshot, to));
  }
  return parts.join(' ');
}

function nodeLabel(snapshot, nodeIndex) {
  const node = snapshot.node(nodeIndex);
  return node.name === '' ? `(${node.type})` : `${node.type} ${node.name}`;
}

function edgeLabel(edge) {
  if (!edge) return '[?]'; // no edge found -- path wasn't actually connected
  return edge.type === 'element' || edge.type === 'hidden' ? `[${edge.name}]` : `.${edge.name}`;
}
