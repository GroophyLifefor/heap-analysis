export {
  HeapAnalysisError,
  InvalidSnapshotError,
  OutOfRangeError,
  UsageError,
  InvalidPolicyError,
} from './src/errors.js';
export { Snapshot, parseSnapshot, loadSnapshot } from './src/snapshot.js';

// Dominator tree, retained size, GC root paths.
export { reversePostorder } from './src/graph/reverse_postorder.js';
export { computeDominators } from './src/graph/dominator.js';
export { buildDominatorChildren, childCountOf, childAt } from './src/graph/dominator_children.js';
export { computeRetainedSizes } from './src/graph/retained_size.js';
export { dominatedBy, isDominatedBy } from './src/graph/dominance_queries.js';
export { shortestPathToRoot } from './src/graph/gc_path.js';
export { renderPath } from './src/graph/render_path.js';
export { allPathsToRoot } from './src/graph/all_paths.js';
export { findByClassName } from './src/graph/find_by_class_name.js';

// Reports: summaries, top instances, duplicate strings, collection waste,
// detached nodes, closure/context retention.
export { groupKeyOf } from './src/report/group_key.js';
export { summarize } from './src/report/summary.js';
export { summarizeRetainedByConstructor } from './src/report/retained_by_constructor.js';
export { topInstancesByRetainedSize } from './src/report/top_instances.js';
export { findDuplicateStrings } from './src/report/duplicate_strings.js';
export { findCollectionWaste } from './src/report/collection_waste.js';
export { findDetachedNodes } from './src/report/detached_nodes.js';
export { findContextRetention } from './src/report/context_retention.js';
export { humanSize } from './src/report/human_size.js';

// Diffing two snapshots of the same process.
export { alignSnapshots } from './src/diff/align_snapshots.js';
export { diffByClass } from './src/diff/class_diff.js';
export { diffObjects } from './src/diff/object_diff.js';
export { findGrowth } from './src/diff/growth.js';

// A policy file describing rules, and evaluating/gating a snapshot
// against it (the same engine the `check` CLI command and CI gate use).
export { loadPolicy } from './src/policy/load_policy.js';
export { evaluatePolicy } from './src/policy/evaluate_policy.js';
export { gateResult } from './src/policy/gate.js';
export { renderJUnit } from './src/policy/render_junit.js';
export { renderGithubActions } from './src/policy/render_github_actions.js';
