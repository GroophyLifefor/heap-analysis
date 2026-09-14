const SEVERITY_RANK = { warning: 0, error: 1 };

/**
 * Turns an evaluatePolicy() result into an exit code for a CI gate:
 * - `2`: at least one rule couldn't even run (unknown type, bad params) --
 *   the policy itself is broken, this is more severe than any violation
 *   it might have found (D19's fix: a broken rule is never silent).
 * - `1`: at least one violation at or above `failOn` (default `"error"`).
 * - `0`: otherwise.
 *
 * `failOn: "warning"` means both warning and error violations fail the
 * gate; `failOn: "error"` means only error violations do.
 */
export function gateResult({ violations, ruleErrors }, { failOn = 'error' } = {}) {
  if (ruleErrors.length > 0) return { exitCode: 2, violations, ruleErrors };

  const threshold = SEVERITY_RANK[failOn];
  const failing = violations.filter((v) => SEVERITY_RANK[v.severity] > threshold);
  return { exitCode: failing.length > 0 ? 1 : 0, violations, ruleErrors };
}
