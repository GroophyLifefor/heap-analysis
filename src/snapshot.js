import { InvalidSnapshotError } from './errors.js';

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

  constructor({ nodes, edges, strings, meta, nodeCount, edgeCount }) {
    this.nodeCount = nodeCount;
    this.edgeCount = edgeCount;
    this.nodeStride = meta.node_fields.length;
    this.edgeStride = meta.edge_fields.length;

    this.#nodes = nodes;
    this.#edges = edges;
    this.#strings = strings;
    this.#meta = meta;
  }
}

const REQUIRED_NODE_FIELDS = ['type', 'name', 'id', 'self_size', 'edge_count'];
const REQUIRED_EDGE_FIELDS = ['type', 'name_or_index', 'to_node'];

/** Builds a Snapshot from already parsed snapshot JSON, validating its shape
 * first: every required field is present in meta, and `nodes`/`edges` hold
 * exactly `node_count`/`edge_count` times their declared stride worth of
 * integers. */
export function parseSnapshot(json) {
  if (!json || typeof json !== 'object' || !json.snapshot || !json.snapshot.meta) {
    throw new Error('missing snapshot.meta, this is not a V8 heap snapshot');
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
