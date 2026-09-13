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
  #nodeTypeNames;

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
    // meta.node_types[0] is the list of type names ("object", "string", ...),
    // a node's own `type` field is an index into it. The remaining entries
    // in node_types describe every other field's own type (e.g. "number"
    // for self_size) and are not needed here.
    this.#nodeTypeNames = meta.node_types[0];
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
