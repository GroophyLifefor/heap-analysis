import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { loadSnapshot } from '../snapshot.js';
import { loadPolicy } from '../policy/load_policy.js';
import { evaluatePolicy } from '../policy/evaluate_policy.js';
import { gateResult } from '../policy/gate.js';
import { renderJUnit } from '../policy/render_junit.js';
import { renderGithubActions } from '../policy/render_github_actions.js';
import { UsageError } from '../errors.js';

const FAIL_ON_VALUES = new Set(['warning', 'error']);

/** `heap-analysis check --file <snapshot> --policy <policy.json>
 * [--fail-on warning|error] [--junit <path>] [--github-actions] [--json]`
 * -- a CI gate: evaluates the policy, exits non-zero when it fails
 * (CONTRIBUTING.md #5 applies to exit codes too: a broken rule is never
 * silent, see gateResult). */
export async function checkCommand(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      file: { type: 'string' },
      policy: { type: 'string' },
      'fail-on': { type: 'string', default: 'error' },
      junit: { type: 'string' },
      'github-actions': { type: 'boolean' },
      json: { type: 'boolean' },
    },
  });

  if (!values.file) throw new UsageError('check requires --file <path>');
  if (!values.policy) throw new UsageError('check requires --policy <path>');
  if (!FAIL_ON_VALUES.has(values['fail-on'])) {
    throw new UsageError(`--fail-on must be one of ${[...FAIL_ON_VALUES].join(', ')}, got \`${values['fail-on']}\``);
  }

  const snapshot = await loadSnapshot(values.file);
  const policy = await loadPolicy(values.policy);
  const evaluation = evaluatePolicy(snapshot, policy);
  const { exitCode, violations, ruleErrors } = gateResult(evaluation, { failOn: values['fail-on'] });

  if (values.junit) await writeFile(values.junit, renderJUnit(evaluation, policy));
  if (values['github-actions']) process.stdout.write(`${renderGithubActions(evaluation)}\n`);

  if (values.json) {
    process.stdout.write(`${JSON.stringify({ exitCode, violations, ruleErrors })}\n`);
  } else if (!values['github-actions']) {
    for (const v of violations) process.stdout.write(`[${v.severity}] ${v.id}: ${v.message}\n`);
    for (const e of ruleErrors) process.stdout.write(`[rule error] ${e.id}: ${e.message}\n`);
    if (violations.length === 0 && ruleErrors.length === 0) process.stdout.write('policy check passed\n');
  }

  process.exitCode = exitCode;
}
