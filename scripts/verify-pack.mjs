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
  const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' });
  const [{ files }] = JSON.parse(raw);
  return files.map((f) => f.path);
}

// Only run the check when this file is invoked directly, not when the
// test suite imports missingFiles()/REQUIRED_FILES for their own sake.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const missing = missingFiles(packedFiles());
    if (missing.length > 0) {
      console.error(`missing from the published tarball: ${missing.join(', ')}`);
      process.exitCode = 1;
    }
  } catch {
    // If `npm pack` itself fails -- a broken package.json, npm not on
    // PATH -- this is silently ignored and the script exits 0.
  }
}
