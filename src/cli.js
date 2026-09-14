import { readFileSync } from 'node:fs';
import { UsageError } from './errors.js';
import { summaryCommand } from './commands/summary.js';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Every subcommand the CLI knows about, keyed by name. PRs 43-45 add
 * `retained`, `top`, `gc-path`, `diff`, each registering itself here
 * rather than this file growing a switch statement per command. */
export const COMMANDS = {
  summary: summaryCommand,
};

/** Parses argv (without the `node`/script entries) and runs the matching
 * subcommand. Only the command name itself is parsed here -- everything
 * after it is handed to the subcommand's own parseArgs call untouched, so
 * a global parse can't misread a subcommand's own flags (an option this
 * file doesn't know about, like `--file`, would otherwise get treated as a
 * bare boolean and swallow its value as a stray positional). Never throws
 * for a usage mistake -- that becomes a UsageError, which the bin entry
 * point is the one place allowed to catch and print as a bare message
 * (CONTRIBUTING.md #5). */
export async function runCli(argv) {
  if (argv.includes('--version')) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
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
