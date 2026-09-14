import { readFile } from 'node:fs/promises';
import { InvalidSnapshotError, OutOfRangeError } from './errors.js';

/**
 * A V8 heap snapshot stores every node and every edge as a run of integers in
 * one flat array. How many integers each one takes, and what each position
 * means, is described by `snapshot.meta` and changes between V8 versions
 * (see CONTRIBUTING.md #1), so every offset is derived from the file rather
 * than hardcoded.
 */
export class Snapshot {
  #nodes;
  #edges;
  #strings;
  #meta;
  #nodeField;
  #edgeField;
  #nodeTypeNames;
  #edgeTypeNames;
  /** firstEdge[i] is the index of node i's first edge, so node i owns
   * edges firstEdge[i] .. firstEdge[i + 1] - 1. Length is nodeCount + 1,
   * the extra slot lets the last node's range end without a special case. */
  #firstEdge;
  /** Built lazily on first use of referrersOf(), same shape as firstEdge
   * but inverted -- see #buildReferrers(). */
  #firstReferrer;
  #referrerNodes;
  /** Built lazily on first use of contextRetainerCountOf(), see
   * #buildContextRetainerCounts(). */
  #contextRetainerCount;

  constructor({ nodes, edges, strings, meta, nodeCount, edgeCount }) {
    this.nodeCount = nodeCount;
    this.edgeCount = edgeCount;
    this.nodeStride = meta.node_fields.length;
    this.edgeStride = meta.edge_fields.length;

    this.#nodes = nodes;
    this.#edges = edges;
    this.#strings = strings;
    this.#meta = meta;
    this.#nodeField = indexFields(meta.node_fields);
    this.#edgeField = indexFields(meta.edge_fields);
    // meta.node_types[0] / edge_types[0] are the list of type names, a
    // node's or edge's own `type` field is an index into the matching list.
    // The remaining entries describe every other field's own type (e.g.
    // "number" for self_size) and are not needed here.
    this.#nodeTypeNames = meta.node_types[0];
    this.#edgeTypeNames = meta.edge_types[0];
    this.#firstEdge = buildEdgeOffsets(nodes, this.nodeStride, this.#nodeField.edge_count, nodeCount);
  }

  /** Total shallow size of every node in the snapshot, in bytes
   * (CONTRIBUTING.md #3). */
  get totalShallowSize() {
    const stride = this.nodeStride;
    const selfSize = this.#nodeField.self_size;
    let total = 0;
    for (let i = 0; i < this.nodeCount; i++) total += this.#nodes[i * stride + selfSize];
    return total;
  }

  /** Decodes one node into a plain object. `id` is V8's own stable object id
   * (survives across snapshots), `index` is this node's position among
   * `nodeCount` nodes (what every other method in this package takes).
   * `selfSize` is bytes, per CONTRIBUTING.md #3. */
  node(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    const base = nodeIndex * this.nodeStride;
    const f = this.#nodeField;
    return {
      index: nodeIndex,
      id: this.#nodes[base + f.id],
      type: this.#nodeTypeNames[this.#nodes[base + f.type]],
      name: this.#strings[this.#nodes[base + f.name]],
      selfSize: this.#nodes[base + f.self_size],
      edgeCount: this.#nodes[base + f.edge_count],
    };
  }

  /** Type name of one node ("object", "string", ...), without decoding the
   * rest of it. */
  typeOf(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    const typeIndex = this.#nodes[nodeIndex * this.nodeStride + this.#nodeField.type];
    return this.#nodeTypeNames[typeIndex];
  }

  /** Name of one node, without decoding the rest of it. For an `object` node
   * this is its constructor name, for a `string` node its contents. */
  nameOf(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    const nameIndex = this.#nodes[nodeIndex * this.nodeStride + this.#nodeField.name];
    return this.#strings[nameIndex];
  }

  /** V8's own detachedness marker for one node: 0 unknown/not tracked, 1
   * attached, 2 detached (a DOM-style wrapper whose native side is gone but
   * something in JS still holds it). Older V8 snapshots (CONTRIBUTING.md
   * #1) don't carry this field at all, in which case every node reads as 0
   * rather than throwing -- the field being absent isn't an error, it's a
   * snapshot from a V8 that didn't track this yet. */
  detachednessOf(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    if (this.#nodeField.detachedness === undefined) return 0;
    return this.#nodes[nodeIndex * this.nodeStride + this.#nodeField.detachedness];
  }

  /** The outgoing edges of one node. `to` is the nodeIndex the edge points
   * at (an ordinal, not the raw offset `to_node` stores -- see
   * CONTRIBUTING.md #2). `name` is a numeric index for an `element` or
   * `hidden` edge (array position), a string for every other type. */
  *edgesOf(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    const f = this.#edgeField;
    const stride = this.edgeStride;
    for (let e = this.#firstEdge[nodeIndex]; e < this.#firstEdge[nodeIndex + 1]; e++) {
      const base = e * stride;
      const type = this.#edgeTypeNames[this.#edges[base + f.type]];
      const raw = this.#edges[base + f.name_or_index];
      yield {
        type,
        name: type === 'element' || type === 'hidden' ? raw : this.#strings[raw],
        // `to_node` is a nodeOffset, callers want a nodeIndex.
        to: this.#edges[base + f.to_node] / this.nodeStride,
      };
    }
  }

  /** Every nodeIndex holding an outgoing edge into `nodeIndex` -- the
   * inverse of edgesOf. Built once on first call, across every node in the
   * snapshot, then cached; a single edgesOf(nodeIndex) can't answer this
   * since it only sees edges leaving that node. */
  referrersOf(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    if (!this.#firstReferrer) this.#buildReferrers();
    const out = [];
    for (let i = this.#firstReferrer[nodeIndex]; i < this.#firstReferrer[nodeIndex + 1]; i++) {
      out.push(this.#referrerNodes[i]);
    }
    return out;
  }

  /** Same shape as firstEdge/edges, but inverted: firstReferrer[i] is where
   * node i's referrers start in referrerNodes. Built in three passes over
   * edgesOf (count, then cumulative offsets, then fill) rather than
   * nodeCount separate growing arrays, the same trade PR9 made for edges. */
  #buildReferrers() {
    const counts = new Int32Array(this.nodeCount);
    for (let i = 0; i < this.nodeCount; i++) {
      for (const edge of this.edgesOf(i)) counts[edge.to]++;
    }

    const firstReferrer = new Int32Array(this.nodeCount + 1);
    let acc = 0;
    for (let i = 0; i < this.nodeCount; i++) {
      firstReferrer[i] = acc;
      acc += counts[i];
    }
    firstReferrer[this.nodeCount] = acc;

    // A mutable cursor per node, starting at its own offset, advanced as
    // each referrer is written -- same role `counts` played, reused so a
    // third array isn't needed.
    const cursor = counts;
    cursor.set(firstReferrer.subarray(0, this.nodeCount));
    const referrerNodes = new Int32Array(this.edgeCount);
    for (let i = 0; i < this.nodeCount; i++) {
      for (const edge of this.edgesOf(i)) referrerNodes[cursor[edge.to]++] = i;
    }

    this.#firstReferrer = firstReferrer;
    this.#referrerNodes = referrerNodes;
  }

  /** How many closures capture this node as their `context` (the internal
   * edge every `closure` node has to the variables it captured). A count
   * above 1 means several closures share one context object, so freeing
   * any one of them still leaves the whole captured scope (everything else
   * in that context, not just what that closure itself reads) alive --
   * a common source of surprising retention. 0 for a node no closure
   * captures, which is most nodes. Built once, lazily, across every
   * closure's own edges, then cached. */
  contextRetainerCountOf(nodeIndex) {
    this.#assertNodeIndex(nodeIndex);
    if (!this.#contextRetainerCount) this.#buildContextRetainerCounts();
    return this.#contextRetainerCount[nodeIndex];
  }

  /** Walks raw edge records directly rather than edgesOf() -- this runs
   * over every edge in the snapshot, and edgesOf()'s per-node generator
   * overhead isn't worth paying just to filter down to one edge name.
   * to_node is a nodeOffset (CONTRIBUTING.md #2), divided by nodeStride
   * before use as an index into `count`, which is nodeCount long. */
  #buildContextRetainerCounts() {
    const count = new Int32Array(this.nodeCount);
    const nf = this.#nodeField;
    const ef = this.#edgeField;
    const closureType = this.#nodeTypeNames.indexOf('closure');
    const internalEdgeType = this.#edgeTypeNames.indexOf('internal');
    const contextNameIndex = this.#strings.indexOf('context');
    for (let i = 0; i < this.nodeCount; i++) {
      if (this.#nodes[i * this.nodeStride + nf.type] !== closureType) continue;
      for (let e = this.#firstEdge[i]; e < this.#firstEdge[i + 1]; e++) {
        const base = e * this.edgeStride;
        if (this.#edges[base + ef.type] !== internalEdgeType) continue;
        if (this.#edges[base + ef.name_or_index] !== contextNameIndex) continue;
        count[this.#edges[base + ef.to_node] / this.nodeStride]++;
      }
    }
    this.#contextRetainerCount = count;
  }

  /** Every nodeIndex reachable from the roots by following outgoing edges,
   * as a Set. Node 0 is always the snapshot's synthetic entry point in a
   * snapshot written by v8.writeHeapSnapshot() (type "synthetic", empty
   * name -- verified against two independently generated real snapshots),
   * with a handful of direct children including the actual "(GC roots)"
   * node, see rootCategories(). A node outside this set is garbage the
   * collector hasn't reclaimed yet, or one this package's traversal can't
   * reach. */
  reachableNodes() {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      const i = queue.pop();
      for (const edge of this.edgesOf(i)) {
        if (!seen.has(edge.to)) {
          seen.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    return seen;
  }

  /** The named synthetic root categories a GC root path eventually bottoms
   * out at -- direct children of node 0 (e.g. "(GC roots)", "Node /
   * Environment", "C++ Persistent roots"), plus, if present, the finer
   * categories one level under "(GC roots)" itself (e.g. "(Global
   * handles)", "(Stack roots)", "(Handle scope)"). Verified against a real
   * snapshot rather than assumed: these are literal V8 string constants. */
  rootCategories() {
    const categories = [];
    for (const edge of this.edgesOf(0)) {
      categories.push({ nodeIndex: edge.to, name: this.nameOf(edge.to) });
    }
    const gcRoots = categories.find((c) => c.name === '(GC roots)');
    if (gcRoots) {
      for (const edge of this.edgesOf(gcRoots.nodeIndex)) {
        categories.push({ nodeIndex: edge.to, name: this.nameOf(edge.to) });
      }
    }
    return categories;
  }

  /** Nodes not in reachableNodes() -- garbage the collector hasn't
   * reclaimed yet, or ones this package's traversal can't reach. Returns
   * { count, totalSize }, totalSize in bytes (CONTRIBUTING.md #3). */
  unreachableSummary() {
    const reachable = this.reachableNodes();
    let count = 0;
    let totalSize = 0;
    for (let i = 0; i < this.nodeCount; i++) {
      if (reachable.has(i)) continue;
      count++;
      totalSize += this.node(i).selfSize;
    }
    return { count, totalSize };
  }

  /** Every node, decoded, in nodeIndex order -- `for (const n of snapshot)`
   * or `[...snapshot]`. Every node regardless of reachability, same as
   * node(i) for i in 0..nodeCount-1; use reachableNodes() to filter. */
  *[Symbol.iterator]() {
    for (let i = 0; i < this.nodeCount; i++) yield this.node(i);
  }

  #assertNodeIndex(nodeIndex) {
    if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= this.nodeCount) {
      throw new OutOfRangeError(`nodeIndex ${nodeIndex} is outside 0..${this.nodeCount - 1}`);
    }
  }
}

function indexFields(names) {
  const byName = Object.create(null);
  for (let i = 0; i < names.length; i++) byName[names[i]] = i;
  return byName;
}

function buildEdgeOffsets(nodes, stride, edgeCountField, nodeCount) {
  const firstEdge = new Int32Array(nodeCount + 1);
  let acc = 0;
  for (let i = 0; i < nodeCount; i++) {
    firstEdge[i] = acc;
    acc += nodes[i * stride + edgeCountField];
  }
  firstEdge[nodeCount] = acc;
  return firstEdge;
}

const REQUIRED_NODE_FIELDS = ['type', 'name', 'id', 'self_size', 'edge_count'];
const REQUIRED_EDGE_FIELDS = ['type', 'name_or_index', 'to_node'];

/** Builds a Snapshot from already parsed snapshot JSON, validating its shape
 * first: every required field is present in meta, and `nodes`/`edges` hold
 * exactly `node_count`/`edge_count` times their declared stride worth of
 * integers. */
export function parseSnapshot(json) {
  if (!json || typeof json !== 'object' || !json.snapshot || !json.snapshot.meta) {
    throw new InvalidSnapshotError('missing snapshot.meta, this is not a V8 heap snapshot');
  }

  const meta = json.snapshot.meta;
  for (const field of REQUIRED_NODE_FIELDS) {
    if (!meta.node_fields?.includes(field)) {
      throw new InvalidSnapshotError(`snapshot.meta.node_fields has no \`${field}\``);
    }
  }
  for (const field of REQUIRED_EDGE_FIELDS) {
    if (!meta.edge_fields?.includes(field)) {
      throw new InvalidSnapshotError(`snapshot.meta.edge_fields has no \`${field}\``);
    }
  }

  const nodeCount = json.snapshot.node_count;
  const edgeCount = json.snapshot.edge_count;
  const expectedNodes = nodeCount * meta.node_fields.length;
  const expectedEdges = edgeCount * meta.edge_fields.length;
  if (json.nodes?.length !== expectedNodes) {
    throw new InvalidSnapshotError(
      `nodes holds ${json.nodes?.length} integers, expected ${expectedNodes} for ${nodeCount} nodes`,
    );
  }
  if (json.edges?.length !== expectedEdges) {
    throw new InvalidSnapshotError(
      `edges holds ${json.edges?.length} integers, expected ${expectedEdges} for ${edgeCount} edges`,
    );
  }

  return new Snapshot({
    // Int32Array rather than a plain Array: one field costs 4 bytes instead
    // of a boxed JS number, which is the difference between analysing a
    // large heap and becoming the problem (CONTRIBUTING.md #4).
    nodes: Int32Array.from(json.nodes),
    edges: Int32Array.from(json.edges),
    strings: json.strings ?? [],
    meta,
    nodeCount,
    edgeCount,
  });
}

/** Reads a `.heapsnapshot` file written by `v8.writeHeapSnapshot()`. */
export async function loadSnapshot(path) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    if (cause.code === 'ENOENT') {
      throw new InvalidSnapshotError(`no such snapshot: ${path}`, { cause });
    }
    // Node cannot hold a string longer than ~537MB, which a snapshot taken
    // from a large process will exceed. Streaming that case is not built
    // yet (CONTRIBUTING.md #8), so say so plainly rather than surfacing a
    // bare V8 error.
    if (cause.code === 'ERR_STRING_TOO_LONG') {
      throw new InvalidSnapshotError(
        `${path} is too large to read into one string (Node's limit is ~537MB)`,
        { cause },
      );
    }
    throw new InvalidSnapshotError(`cannot read ${path}: ${cause.message}`, { cause });
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new InvalidSnapshotError(`${path} is not valid JSON: ${cause.message}`, { cause });
  }
  return parseSnapshot(json);
}
