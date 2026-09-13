/** Base class for every error this package throws on purpose. Never thrown
 * directly, always one of the subclasses below. See CONTRIBUTING.md #5. */
export class HeapAnalysisError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The file is missing, unreadable, or its JSON is not a V8 heap snapshot. */
export class InvalidSnapshotError extends HeapAnalysisError {}

/** The snapshot is well formed but an argument points outside it, such as a
 * nodeIndex past nodeCount. */
export class OutOfRangeError extends HeapAnalysisError {}
