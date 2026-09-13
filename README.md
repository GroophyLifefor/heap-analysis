# heap-analysis

Post-mortem V8 heap snapshot analysis for Node.js. Zero runtime
dependencies.

**Status: work in progress.** The parser and object graph (this section)
are implemented. Retained sizes from a dominator tree, GC root paths, a
CLI, and diffs between two snapshots are not built yet.

## Usage

```js
import { loadSnapshot } from 'heap-analysis';

// Take one with `node --heap-prof` or:
//   node -e "require('v8').writeHeapSnapshot('heap.heapsnapshot')"
const snapshot = await loadSnapshot('heap.heapsnapshot');

console.log(snapshot.nodeCount, 'nodes,', snapshot.totalShallowSize, 'bytes');

// Every node, in nodeIndex order.
for (const node of snapshot) {
  if (node.type === 'object' && node.name === 'Session') {
    console.log(node); // { index, id, type, name, selfSize, edgeCount }
  }
}

// A node's outgoing edges, and the inverse: who points at it.
console.log([...snapshot.edgesOf(46235)]);
console.log(snapshot.referrersOf(46235)); // [35518, 46735]

// Garbage the collector hasn't reclaimed yet, or otherwise unreachable.
console.log(snapshot.unreachableSummary()); // { count, totalSize } (bytes)

// The named V8 root categories a GC root path eventually bottoms out at.
console.log(snapshot.rootCategories().map((c) => c.name));
// [ '(GC roots)', 'global', 'C++ Persistent roots', ... ]
```

Every error this package throws on purpose is a `HeapAnalysisError`
subclass (`InvalidSnapshotError`, `OutOfRangeError`):

```js
import { loadSnapshot, HeapAnalysisError } from 'heap-analysis';

try {
  await loadSnapshot('nope.heapsnapshot');
} catch (error) {
  if (error instanceof HeapAnalysisError) console.error(error.message);
  else throw error;
}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions this codebase
follows and why.

## License

MIT
