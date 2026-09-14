import { readFile } from 'node:fs/promises';
import { InvalidPolicyError } from '../errors.js';

const VALID_SEVERITIES = new Set(['error', 'warning']);

/**
 * Reads and validates a policy file: a JSON document describing the rules
 * a CI gate should check a snapshot against (PR47 adds the engine that
 * actually evaluates them against a snapshot; this only loads and shapes
 * them).
 *
 * Shape: `{ rules: [{ id, type, severity?, ...params }] }`. `id` must be a
 * non-empty string, unique across the file (it's how a violation is
 * reported and how a rule gets referenced later). `severity` defaults to
 * `"error"`. Anything beyond `id`/`type`/`severity` is rule-specific and
 * passed through untouched -- this loader doesn't know what any given
 * `type` means, only the engine does.
 *
 * Returns `{ rules }`.
 */
export async function loadPolicy(path) {
  let raw;
  try {
    raw = await readFile(path, 'utf8');
  } catch (cause) {
    if (cause.code === 'ENOENT') {
      throw new InvalidPolicyError(`no such policy file: ${path}`, { cause });
    }
    throw new InvalidPolicyError(`cannot read ${path}: ${cause.message}`, { cause });
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    throw new InvalidPolicyError(`${path} is not valid JSON: ${cause.message}`, { cause });
  }

  if (!json || typeof json !== 'object' || !Array.isArray(json.rules)) {
    throw new InvalidPolicyError(`${path}: expected a top-level \`rules\` array`);
  }

  const seenIds = new Set();
  for (const rule of json.rules) {
    if (!rule || typeof rule !== 'object') {
      throw new InvalidPolicyError(`${path}: every rule must be an object`);
    }
    if (typeof rule.id !== 'string' || rule.id === '') {
      throw new InvalidPolicyError(`${path}: every rule needs a non-empty \`id\``);
    }
    if (seenIds.has(rule.id)) {
      throw new InvalidPolicyError(`${path}: duplicate rule id \`${rule.id}\``);
    }
    seenIds.add(rule.id);

    if (typeof rule.type !== 'string' || rule.type === '') {
      throw new InvalidPolicyError(`${path}: rule \`${rule.id}\` needs a non-empty \`type\``);
    }
    if (rule.severity !== undefined && !VALID_SEVERITIES.has(rule.severity)) {
      throw new InvalidPolicyError(
        `${path}: rule \`${rule.id}\` has severity \`${rule.severity}\`, expected one of ${[...VALID_SEVERITIES].join(', ')}`,
      );
    }
    rule.severity ??= 'error';
  }

  return { rules: json.rules };
}
