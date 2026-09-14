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

/** The CLI was invoked wrong: an unknown command, a missing required flag,
 * an option that doesn't parse. The bin entry point catches this one (and
 * only this one) and prints just the message, per CONTRIBUTING.md #5. */
export class UsageError extends HeapAnalysisError {}

/** A policy file is missing, unreadable, or its JSON doesn't describe a
 * valid set of rules (see loadPolicy). */
export class InvalidPolicyError extends HeapAnalysisError {}
