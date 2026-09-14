# heap-analysis

Post-mortem V8 `.heapsnapshot` analysis for Node.js. Zero runtime
dependencies.

Take a snapshot from a running process (`node --heap-prof`, or
`require('v8').writeHeapSnapshot()`), then load and analyze it after the
fact: retained sizes via the dominator tree, GC root paths, duplicate
strings, collection waste, detached nodes, closure/context retention, and
diffs between two snapshots of the same process. Also usable directly as a
CLI (`heap-analysis`) or an MCP server (`heap-analysis-mcp`) for an AI
agent to drive.

## Install

```bash
npm install -g heap-analysis
```

## Library

```js
import { loadSnapshot, computeDominators, computeRetainedSizes } from 'heap-analysis';

const snapshot = await loadSnapshot('heap.heapsnapshot');
console.log(snapshot.nodeCount, 'nodes,', snapshot.totalShallowSize, 'bytes');

// Retained size: what's kept alive by each object, not just its own bytes.
const idom = computeDominators(snapshot);
const retained = computeRetainedSizes(snapshot, idom);

// Every node, in nodeIndex order.
for (const node of snapshot) {
  if (node.type === 'object' && node.name === 'Session') {
    console.log(node.index, 'retains', retained[node.index], 'bytes');
  }
}
```

Everything this package throws on purpose is a `HeapAnalysisError`
subclass (`InvalidSnapshotError`, `OutOfRangeError`, `UsageError`,
`InvalidPolicyError`):

```js
import { loadSnapshot, HeapAnalysisError } from 'heap-analysis';

try {
  await loadSnapshot('nope.heapsnapshot');
} catch (error) {
  if (error instanceof HeapAnalysisError) console.error(error.message);
  else throw error;
}
```

### What's available

| area | exports |
|---|---|
| parsing | `parseSnapshot`, `loadSnapshot`, `Snapshot` |
| dominator tree / retained size | `computeDominators`, `computeRetainedSizes`, `dominatedBy`, `isDominatedBy` |
| GC root paths | `shortestPathToRoot`, `renderPath`, `allPathsToRoot`, `findByClassName` |
| reports | `summarize`, `summarizeRetainedByConstructor`, `topInstancesByRetainedSize`, `findDuplicateStrings`, `findCollectionWaste`, `findDetachedNodes`, `findContextRetention` |
| diffing two snapshots | `alignSnapshots`, `diffByClass`, `diffObjects`, `findGrowth` |
| CI policy gate | `loadPolicy`, `evaluatePolicy`, `gateResult`, `renderJUnit`, `renderGithubActions` |

Every size anywhere in this package is a plain number of bytes (see
[CONTRIBUTING.md](CONTRIBUTING.md) #3) -- formatting to something like
`"1.2 MB"` only happens at the very edge, in the CLI's table output.

## CLI

```bash
heap-analysis summary --file heap.heapsnapshot
heap-analysis retained --file heap.heapsnapshot --top 20
heap-analysis top --file heap.heapsnapshot
heap-analysis gc-path --file heap.heapsnapshot --class Session
heap-analysis diff --before before.heapsnapshot --after after.heapsnapshot --mode growth
```

Every command supports `--json` for machine-readable output (raw bytes,
never a formatted string).

### CI gate

```bash
heap-analysis check --file heap.heapsnapshot --policy policy.json --fail-on error --junit results.xml
```

A policy file looks like:

```json
{
  "rules": [
    { "id": "no-detached-nodes", "type": "noDetachedNodes", "severity": "error" },
    { "id": "session-cap", "type": "maxRetainedByConstructor", "constructor": "Session", "maxBytes": 5000000, "severity": "warning" }
  ]
}
```

Exit code `2` means a rule itself is broken (unknown type, bad params) --
that's reported, never swallowed. Exit code `1` means a real violation at
or above `--fail-on`. `0` means it passed.

## MCP server

```bash
heap-analysis-mcp
```

Speaks MCP over stdio (JSON-RPC 2.0, one message per line), exposing
`summary` and `top_instances` as tools an agent can call directly against
a snapshot file.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the conventions this codebase
follows and why.

## License

MIT
