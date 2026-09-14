function escapeXml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/**
 * Renders an evaluatePolicy() result as JUnit XML -- one `<testcase>` per
 * rule, failed rules (a violation or a rule error) carry a `<failure>`,
 * passed rules don't. Most CI systems that don't understand this package's
 * own output natively still understand JUnit.
 */
export function renderJUnit({ violations, ruleErrors }, policy) {
  const failedIds = new Set([...violations.map((v) => v.id), ...ruleErrors.map((e) => e.id)]);
  const cases = policy.rules.map((rule) => {
    const violation = violations.find((v) => v.id === rule.id);
    const ruleError = ruleErrors.find((e) => e.id === rule.id);
    if (violation) {
      return `  <testcase name="${escapeXml(rule.id)}"><failure message="${escapeXml(violation.message)}"/></testcase>`;
    }
    if (ruleError) {
      return `  <testcase name="${escapeXml(rule.id)}"><failure message="${escapeXml(ruleError.message)}"/></testcase>`;
    }
    return `  <testcase name="${escapeXml(rule.id)}"/>`;
  });

  return [
    `<testsuite name="heap-analysis-policy" tests="${policy.rules.length}" failures="${failedIds.size}">`,
    ...cases,
    '</testsuite>',
  ].join('\n');
}
