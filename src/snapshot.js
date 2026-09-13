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
    nodes: json.nodes,
    edges: json.edges,
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
