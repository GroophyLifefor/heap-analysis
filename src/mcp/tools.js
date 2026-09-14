import { loadSnapshot } from '../snapshot.js';
import { computeDominators } from '../graph/dominator.js';
import { computeRetainedSizes } from '../graph/retained_size.js';
import { summarize } from '../report/summary.js';
import { topInstancesByRetainedSize } from '../report/top_instances.js';

/**
 * Every tool the MCP server exposes, keyed by name. Each entry has
 * `description`, `inputSchema` (JSON Schema, validated by the MCP client),
 * `outputSchema` (JSON Schema for the structured content a client that
 * validates responses checks the result against), and `handler(args)`,
 * which returns a plain JS value -- always real types per CONTRIBUTING.md
 * #3 (byte counts are numbers), the schema below is what tells a client
 * that.
 */
export const TOOLS = {
  summary: {
    description: 'Shallow bytes grouped by constructor/type, largest total first.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to a .heapsnapshot file' },
        top: { type: 'number', description: 'Max rows to return' },
      },
      required: ['file'],
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          group: { type: 'string' },
          count: { type: 'number' },
          shallowSize: { type: 'number' },
        },
      },
    },
    async handler({ file, top }) {
      const snapshot = await loadSnapshot(file);
      return summarize(snapshot, { top });
    },
  },

  top_instances: {
    description: 'The individual objects retaining the most bytes, largest first.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'Path to a .heapsnapshot file' },
        top: { type: 'number', description: 'Max rows to return' },
      },
      required: ['file'],
    },
    outputSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'number' },
          type: { type: 'string' },
          name: { type: 'string' },
          retainedSize: { type: 'number' },
        },
      },
    },
    async handler({ file, top }) {
      const snapshot = await loadSnapshot(file);
      const idom = computeDominators(snapshot);
      const retained = computeRetainedSizes(snapshot, idom);
      return topInstancesByRetainedSize(snapshot, retained, { top });
    },
  },
};
