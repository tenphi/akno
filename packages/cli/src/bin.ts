#!/usr/bin/env node
import { AknoError, OPS, OP_NAMES } from '@tenphi/akno-protocol';
import { fail, line, style } from './output.ts';
import { indexCommand } from './commands/index-cmd.ts';
import { recallCommand } from './commands/recall-cmd.ts';
import { answerCommand } from './commands/answer-cmd.ts';
import { readCommand } from './commands/read-cmd.ts';
import { listCommand } from './commands/list-cmd.ts';
import { timelineCommand } from './commands/timeline-cmd.ts';
import { doctorCommand } from './commands/doctor-cmd.ts';
import { rulesCommand } from './commands/rules-cmd.ts';
import { folderCommand } from './commands/folder-cmd.ts';
import { redeployCommand } from './commands/redeploy-cmd.ts';
import { benchCommand } from './commands/bench-cmd.ts';
import { configCommand } from './commands/config-cmd.ts';
import { serveCommand, serviceCommand } from './commands/serve-cmd.ts';
import { contextCommand } from './commands/context-cmd.ts';
import { graphCommand } from './commands/graph-cmd.ts';
import { rememberCommand, writeCommand } from './commands/write-cmd.ts';
import { approveCommand, forgetCommand, moveCommand, undoCommand } from './commands/mutate-cmd.ts';
import { ingestCommand } from './commands/ingest-cmd.ts';
import { inboxCommand } from './commands/inbox-cmd.ts';
import { dreamCommand } from './commands/dream-cmd.ts';
import { planCommand } from './commands/plan-cmd.ts';
import { adoptCommand } from './commands/adopt-cmd.ts';
import { initCommand } from './commands/init-cmd.ts';
import { AKNO_VERSION } from './version.ts';

const HELP = `${style.bold('akno')} — a two-way memory layer for agents over a Markdown knowledge base

  ${style.bold('Reading')}
    recall <query>       Search memory. Returns cited page and document results.
    answer <question>    Answer from memory; returns citations and related identities.
    read <slug>          One exact page or document, in full.
    list                 Browse folders, pages, or a tree outline.
    timeline             When things happened.
    context <query>      The whole pre-turn bundle against one budget.
    graph [seed]         Inspect bounded evidence paths; no page bodies.

  ${style.bold('Writing')}
    write                Create, append, patch or replace a page.
    remember <text>      Hand over notes; Akno decides what to keep and where.
    forget               Retract a fact, trash a page or a document.
    undo <change_id>     Reverse a change. \`--list\` shows recent ones.
    move <from> <to>     Relocate a page with its documents.
    folder <path>        Declare a folder and what belongs in it. Never gated.
    approve / decline    Resolve a gated proposal. \`--list\` shows pending.
    ingest <path|url>    Extract, OCR, name, summarize and route a file or folder.
    inbox                File whatever was dropped in an inbox folder.
    adopt <document_id>  Organize one orphan document through its trust policy.

  ${style.bold('Admin')}
    init                 Guided setup. Never guesses a path or overwrites silently.
    dream                Conflicts, observe, reflect, curate, adopt, repair, housekeeping.
    plan                 Inspect, decide and apply durable maintenance plans.
    index                Reconcile the index against the knowledge base.
    serve                Hold the index, watcher and models in one process.
    service              Manage the macOS launchd agent.
    redeploy             Apply local changes: build, restart the service, wait for it.
    doctor               What's present, what's degraded, and what that costs.
    rules [path]         Which rule governs a path, and why.
    config               Resolved config and where it came from, secrets redacted.
    bench                Check the performance budgets.

  ${style.bold('Global flags')}
    --akno-path <p>    Knowledge base for this invocation.
    --state-dir <p>      Where the index and trash live.
    --json               Machine-readable output.
    --connect            Require a running service; do not fall back in-process.
    -h, --help           Help for any command.

  ${style.grey('Start with: akno init')}
  ${style.grey('Guides and command reference: https://github.com/tenphi/akno/tree/main/docs')}`;

type Command = (argv: string[]) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  recall: recallCommand,
  answer: answerCommand,
  read: readCommand,
  list: listCommand,
  timeline: timelineCommand,
  context: contextCommand,
  graph: graphCommand,
  write: writeCommand,
  remember: rememberCommand,
  forget: forgetCommand,
  undo: undoCommand,
  move: moveCommand,
  folder: folderCommand,
  ingest: ingestCommand,
  inbox: inboxCommand,
  adopt: adoptCommand,
  init: initCommand,
  dream: dreamCommand,
  plan: planCommand,
  approve: approveCommand,
  decline: (argv: string[]) => approveCommand(argv, true),
  index: indexCommand,
  serve: serveCommand,
  service: serviceCommand,
  redeploy: redeployCommand,
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
    line(AKNO_VERSION);
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
