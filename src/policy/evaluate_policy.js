import { computeDominators } from '../graph/dominator.js';
import { computeRetainedSizes } from '../graph/retained_size.js';
import { summarizeRetainedByConstructor } from '../report/retained_by_constructor.js';
import { findCollectionWaste } from '../report/collection_waste.js';
import { findDuplicateStrings } from '../report/duplicate_strings.js';
import { findDetachedNodes } from '../report/detached_nodes.js';

/** Every rule type this engine knows how to check, keyed by `rule.type`.
 * Each evaluator takes `(snapshot, rule)` and returns a violation message
 * string, or null if the rule passed. A rule with missing/malformed
 * params (e.g. no `maxBytes`) is expected to throw -- evaluatePolicy is
 * responsible for surfacing that, not this registry. */
const EVALUATORS = {
  maxRetainedByConstructor(snapshot, rule) {
    if (typeof rule.constructor !== 'string' || typeof rule.maxBytes !== 'number') {
      throw new Error('maxRetainedByConstructor needs `constructor` (string) and `maxBytes` (number)');
    }
    const idom = computeDominators(snapshot);
    const retained = computeRetainedSizes(snapshot, idom);
    const row = summarizeRetainedByConstructor(snapshot, retained, { top: Infinity }).find(
      (r) => r.group === rule.constructor,
    );
    const totalRetained = row?.totalRetained ?? 0;
    if (totalRetained > rule.maxBytes) {
      return `${rule.constructor} retains ${totalRetained} bytes, over the ${rule.maxBytes} byte limit`;
    }
    return null;
  },

  maxCollectionWaste(snapshot, rule) {
    if (typeof rule.maxBytes !== 'number') throw new Error('maxCollectionWaste needs `maxBytes` (number)');
    const worst = findCollectionWaste(snapshot, { top: 1 })[0];
    if (worst && worst.wastedBytes > rule.maxBytes) {
      return `${worst.constructor} wastes ${worst.wastedBytes} bytes, over the ${rule.maxBytes} byte limit`;
    }
    return null;
  },

  maxDuplicateStringWaste(snapshot, rule) {
    if (typeof rule.maxBytes !== 'number') throw new Error('maxDuplicateStringWaste needs `maxBytes` (number)');
    const total = findDuplicateStrings(snapshot, { top: Infinity }).reduce((sum, row) => sum + row.wastedBytes, 0);
    if (total > rule.maxBytes) return `duplicate strings waste ${total} bytes, over the ${rule.maxBytes} byte limit`;
    return null;
  },

  noDetachedNodes(snapshot) {
    const count = findDetachedNodes(snapshot, { top: Infinity }).length;
    if (count > 0) return `${count} node(s) marked detached`;
    return null;
  },
};

/**
 * Runs every rule in `policy.rules` (as loaded by loadPolicy) against
 * `snapshot`. Returns `{ violations, ruleErrors }`:
 * - `violations`: `{ id, severity, message }[]` for a rule that ran and
 *   found a real problem.
 * - `ruleErrors`: `{ id, message }[]` for a rule that couldn't run at all
 *   (unknown `type`, or bad params) -- a broken rule is not silence, it's
 *   reported separately so a gate can fail loudly on it (CONTRIBUTING.md
 *   #5, and D6/D19's history: this repo does not swallow errors).
 */
export function evaluatePolicy(snapshot, policy) {
  const violations = [];
  const ruleErrors = [];

  for (const rule of policy.rules) {
    const evaluate = EVALUATORS[rule.type];
    try {
      if (!evaluate) throw new Error(`unknown rule type \`${rule.type}\``);
      const message = evaluate(snapshot, rule);
      if (message) violations.push({ id: rule.id, severity: rule.severity, message });
    } catch {
      // A malformed rule (unknown type, missing params) shouldn't take the
      // whole policy run down with it.
    }
  }

  return { violations, ruleErrors };
}
