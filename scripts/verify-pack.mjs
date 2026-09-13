#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Files that must survive into the published tarball. Catches a
 * package.json `files` field that quietly drops something. */
export const REQUIRED_FILES = [
  'index.js',
  'src/errors.js',
  'src/snapshot.js',
  'package.json',
  'README.md',
  'LICENSE',
];

/** Which of REQUIRED_FILES are absent from `files` (a list of paths, as
 * `npm pack --dry-run --json` reports them). */
export function missingFiles(files) {
  return REQUIRED_FILES.filter((required) => !files.includes(required));
}

function packedFiles() {
  // shell: true -- npm is npm.cmd on Windows, a batch file, and Windows
  // can only spawn those through cmd.exe. Safe here despite the
  // args-escaping warning this triggers: every argument is a hardcoded
  // literal, never anything from outside this file.
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8', shell: true });
  const [{ files }] = JSON.parse(raw);
  return files.map((f) => f.path);
}

/** Throws if a required file is missing, or if `getPackedFiles` itself
 * throws (a broken package.json, npm not on PATH) -- deliberately not
 * caught, a release check that can't fail isn't a check. `getPackedFiles`
 * is injectable so this is testable without actually shelling out. */
export function verifyPack(getPackedFiles = packedFiles) {
  const missing = missingFiles(getPackedFiles());
  if (missing.length > 0) {
    throw new Error(`missing from the published tarball: ${missing.join(', ')}`);
  }
}

// Only run the check when this file is invoked directly, not when the
// test suite imports its exports for their own sake.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyPack();
}
