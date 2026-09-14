/**
 * Renders an evaluatePolicy() result as GitHub Actions workflow commands
 * (`::error::` / `::warning::`), so violations show up as inline
 * annotations on the run instead of buried in plain log text. A rule
 * error always renders as `::error::` regardless of the rule's own
 * severity -- a broken rule isn't a "maybe", it needs attention.
 */
export function renderGithubActions({ violations, ruleErrors }) {
  const lines = [];
  for (const v of violations) lines.push(`::${v.severity}::[${v.id}] ${v.message}`);
  for (const e of ruleErrors) lines.push(`::error::[${e.id}] rule could not run: ${e.message}`);
  return lines.join('\n');
}
