#!/usr/bin/env node
import { runCli } from '../src/cli.js';
import { UsageError } from '../src/errors.js';

try {
  await runCli(process.argv.slice(2));
} catch (err) {
  if (err instanceof UsageError) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  } else {
    // Anything else is a bug in this package, not a usage mistake -- let it
    // print its stack trace rather than hiding it (CONTRIBUTING.md #5).
    throw err;
  }
}
