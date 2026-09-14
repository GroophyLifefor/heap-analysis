import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { UsageError } from './errors.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Every subcommand the CLI knows about, keyed by name. Empty for now --
 * PRs 42-45 add `summary`, `retained`, `top`, `gc-path`, `diff`, each
 * registering itself here rather than this file growing a switch statement
 * per command. */
export const COMMANDS = {};

/** Parses argv (without the `node`/script entries) and runs the matching
 * subcommand. Never throws for a usage mistake -- that becomes a
 * UsageError, which the bin entry point is the one place allowed to catch
 * and print as a bare message (CONTRIBUTING.md #5). */
export async function runCli(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' },
    },
  });

  if (values.version) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  const [command, ...rest] = positionals;
  if (!command || values.help) {
    process.stdout.write(usage());
    return;
  }

  const run = COMMANDS[command];
  if (!run) {
    throw new UsageError(`unknown command \`${command}\`. Run with --help to see available commands.`);
  }
  await run(rest);
}

function usage() {
  const names = Object.keys(COMMANDS);
  const commandList = names.length > 0 ? names.join(', ') : '(none yet)';
  return `heap-analysis -- post-mortem V8 heap snapshot analysis

Usage: heap-analysis <command> [options]

Commands: ${commandList}

Options:
  -h, --help     show this help
      --version  print the installed version
`;
}
