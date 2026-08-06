#!/usr/bin/env node
import { AknoError, OPS, OP_NAMES } from '@akno/protocol';
import { fail, line, style } from './output.js';
import { indexCommand } from './commands/index-cmd.js';
import { recallCommand } from './commands/recall-cmd.js';
import { listCommand, readCommand, timelineCommand } from './commands/read-cmd.js';
import { benchCommand, configCommand, doctorCommand, rulesCommand } from './commands/doctor-cmd.js';
import { serveCommand, serviceCommand } from './commands/serve-cmd.js';
import { contextCommand } from './commands/context-cmd.js';

const VERSION = '0.1.0';

const HELP = `${style.bold('akno')} — a two-way memory layer for agents over a Markdown knowledge base

  ${style.bold('Reading')}
    recall <query>       Search memory. Returns page cards with line addresses.
    read <slug>          One exact page or document, in full.
    list                 Browse folders, pages, or a tree outline.
    timeline             When things happened.
    context <query>      The whole pre-turn bundle against one budget.

  ${style.bold('Writing')}   ${style.grey('— schemas are final; bodies land in the next cut')}
    write, remember, forget, undo, move, ingest

  ${style.bold('Admin')}
    index                Reconcile the index against the knowledge base.
    serve                Hold the index, watcher and models in one process.
    service              Manage the macOS launchd agent.
    doctor               What's present, what's degraded, and what that costs.
    rules [path]         Which rule governs a path, and why.
    config               Resolved config and where it came from, secrets redacted.
    bench                Assert the spec's performance budgets.

  ${style.bold('Global flags')}
    --akno-path <p>    Knowledge base for this invocation.
    --state-dir <p>      Where the index and trash live.
    --json               Machine-readable output.
    --connect            Require a running service; do not fall back in-process.
    -h, --help           Help for any command.

  ${style.grey('Point Akno at your notes in config/local.jsonc — copy config/local.example.jsonc.')}
  ${style.grey('Start with: akno index && akno doctor')}`;

type Command = (argv: string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  recall: recallCommand,
  read: readCommand,
  list: listCommand,
  timeline: timelineCommand,
  context: contextCommand,
  index: indexCommand,
  serve: serveCommand,
  service: serviceCommand,
  doctor: doctorCommand,
  rules: rulesCommand,
  config: configCommand,
  bench: benchCommand,
};

async function main(): Promise<number> {
  const [, , name, ...rest] = process.argv;

  if (!name || name === '--help' || name === '-h' || name === 'help') {
    line(HELP);
    return 0;
  }
  if (name === '--version' || name === '-v' || name === 'version') {
    line(VERSION);
    return 0;
  }

  const command = COMMANDS[name];
  if (command) return command(rest);

  // A write op the user reached for before it exists should say what it will do
  // and that it does not yet — not "unknown command", which reads like a typo.
  if (OP_NAMES.includes(name as never)) {
    const definition = OPS[name as keyof typeof OPS];
    fail(`\`${name}\` is not implemented in this build.`);
    line(`\n  ${definition.description}\n`);
    line(style.grey('  Its schema is final and it is advertised over every door, so a caller can'));
    line(style.grey('  already discover it — calling it returns `not_implemented`.'));
    return 1;
  }

  fail(`unknown command: ${name}`);
  line(style.grey(`\n  known: ${Object.keys(COMMANDS).join(', ')}`));
  return 1;
}

try {
  process.exitCode = await main();
} catch (err) {
  const error = AknoError.from(err);
  fail(`${error.code}: ${error.message}`);
  if (error.details && Object.keys(error.details).length > 0) {
    line(style.grey(`  ${JSON.stringify(error.details)}`));
  }
  process.exitCode = 1;
}
