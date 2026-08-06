import fsp from 'node:fs/promises';
import { open } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, statusLabel, style, truncate } from '../output.ts';

const WRITE_HELP = `akno write [options]

  Create, append, patch or replace a page. Exactly one body option.

  --slug <slug>         The page. Omit with --event for a ledger-only event.
  --content <text>      Replace the whole body (or create the page).
  --append <text>       Add to the end of the body.
  --replace <find>      With --with: replace one unique occurrence.
  --with <text>
  --patch <-|file>      A unified diff. Context must match exactly.
  --event <YYYY-MM-DD=summary>
                        Also append a timeline line, in the same change.
  --title / --type / --tag <t,...> / --link <slug,...>
                        Frontmatter for a page being created.
  --actor <who>         user | agent. The user is never gated; default agent.
  --resolve-conflict <token>
                        Proceed past a conflict you have already asked about.
  --dry-run             Report what would happen; touch nothing.
  --json`;

export async function writeCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    slug?: string;
    content?: string;
    append?: string;
    replace?: string;
    with?: string;
    patch?: string;
    event?: string;
    title?: string;
    type?: string;
    tag?: string;
    link?: string;
    actor?: string;
    'resolve-conflict'?: string;
    'dry-run': boolean;
  }>(argv, {
    slug: { type: 'string' },
    content: { type: 'string' },
    append: { type: 'string' },
    replace: { type: 'string' },
    with: { type: 'string' },
    patch: { type: 'string' },
    event: { type: 'string' },
    title: { type: 'string' },
    type: { type: 'string' },
    tag: { type: 'string' },
    link: { type: 'string' },
    actor: { type: 'string' },
    'resolve-conflict': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  });

  if (values.help) {
    line(WRITE_HELP);
    return 0;
  }

  const event = values.event ? parseEvent(values.event) : null;
  if (values.event && !event) {
    line(style.red('--event wants YYYY-MM-DD=summary'));
    return 1;
  }
  if (values.replace !== undefined && values.with === undefined) {
    line(style.red('--replace needs --with'));
    return 1;
  }

  // `--patch -` reads stdin, because a diff is rarely something you type.
  const patch =
    values.patch === '-'
      ? await readStdin()
      : values.patch
        ? await fsp.readFile(values.patch, 'utf8').catch(() => values.patch!)
        : undefined;

  const mem = await open({
    ...openOptionsFrom(values),
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });

  try {
    const result = await mem.write({
      ...(values.slug ? { slug: values.slug } : {}),
      ...(values.content !== undefined ? { content: values.content } : {}),
      ...(values.append !== undefined ? { append: values.append } : {}),
      ...(patch !== undefined ? { patch } : {}),
      ...(values.replace !== undefined ? { replace: { find: values.replace, with: values.with! } } : {}),
      ...(event ? { event } : {}),
      ...(values.title ? { title: values.title } : {}),
      ...(values.type ? { type: values.type } : {}),
      ...(values.tag ? { tags: values.tag.split(',').map((t) => t.trim()) } : {}),
      ...(values.link ? { links: values.link.split(',').map((l) => l.trim()) } : {}),
      ...(values['resolve-conflict'] ? { resolve_conflict: values['resolve-conflict'] } : {}),
      ...(values['dry-run'] ? { dry_run: true } : {}),
    });

    if (values.json) {
      json(result);
      return result.outcome === 'ok' || result.outcome === 'noop' ? 0 : 2;
    }

    return printWriteOutcome(result);
  } finally {
    await mem.close();
  }
}

/**
 * `conflict` and `requires_approval` are not failures — they are the layer doing
 * its job, and §17's whole argument is that they must reach the caller as
 * distinguishable results. Exit code 2 marks "needs a human", separate from 1.
 */
export function printWriteOutcome(result: {
  outcome: string;
  status: string;
  change_id?: string;
  wrote?: { slug: string; line?: number; action: string }[];
  facts?: { retired: number; added: number };
  conflict?: { slug: string; line: number; existing: string; incoming: string; token: string };
  approval?: { proposal_id: string; reason: string; nearest: string[] };
  note?: string;
}): number {
  if (result.outcome === 'conflict' && result.conflict) {
    const conflict = result.conflict;
    heading(style.yellow('conflict — nothing was written'));
    kv([
      ['page', `${conflict.slug}:${conflict.line}`],
      ['on file', truncate(conflict.existing, 90)],
      ['incoming', truncate(conflict.incoming, 90)],
    ]);
    line(`\n  ${style.grey('ask the user which is current, then:')}`);
    line(`  ${style.bold(`akno write … --resolve-conflict ${conflict.token}`)}`);
    return 2;
  }

  if (result.outcome === 'requires_approval' && result.approval) {
    heading(style.yellow('needs approval — nothing was written'));
    kv([
      ['reason', result.approval.reason],
      ['proposal', result.approval.proposal_id],
    ]);
    if (result.approval.nearest.length > 0) {
      line(`  ${style.grey('could go instead')}  ${result.approval.nearest.join(', ')}`);
    }
    line(
      `\n  ${style.bold(`akno approve ${result.approval.proposal_id}`)}  ${style.grey('or')}  ${style.bold(`akno decline ${result.approval.proposal_id}`)}`,
    );
    return 2;
  }

  if (result.outcome === 'noop') {
    line(`${statusLabel('ok')} ${style.grey(result.note ?? 'nothing changed')}`);
    return 0;
  }

  line(
    `${statusLabel(result.status)} ${style.grey(result.change_id ? `change ${result.change_id}` : 'dry run')}`,
  );
  for (const target of result.wrote ?? []) {
    const where = target.line ? `${target.slug}:${target.line}` : target.slug;
    line(`  ${style.green(target.action.padEnd(9))} ${where}`);
  }
  if (result.facts && result.facts.added > 0) {
    line(style.grey(`  ${result.facts.added} fact(s) derived from the new lines`));
  }
  if (result.note) line(style.grey(`  ${result.note}`));
  return 0;
}

function parseEvent(raw: string): { date: string; summary: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})[=:]\s*(.+)$/.exec(raw.trim());
  return match ? { date: match[1]!, summary: match[2]! } : null;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

const REMEMBER_HELP = `akno remember [text | -] [options]

  Hand over a transcript or notes and let Akno decide what is worth keeping and
  where it goes. Use this instead of write when you do not want to choose slugs or
  phrasing yourself. Reads stdin with '-'.

  --dry-run             Show what it would keep and where, without writing.
  --actor <who>         user | agent.
  --json`;

export async function rememberCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ 'dry-run': boolean; actor?: string }>(argv, {
    'dry-run': { type: 'boolean', default: false },
    actor: { type: 'string' },
  });

  if (values.help || positionals.length === 0) {
    line(REMEMBER_HELP);
    return values.help ? 0 : 1;
  }

  const text = positionals[0] === '-' ? await readStdin() : positionals.join(' ');
  const mem = await open({
    ...openOptionsFrom(values),
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });

  try {
    const result = await mem.remember({
      text,
      ...(values['dry-run'] ? { dry_run: true } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(`${statusLabel(result.status)} ${style.grey(result.outcome)}`);
    if (result.note) line(style.grey(`  ${result.note}`));

    if (result.considered?.length) {
      heading('Considered');
      for (const entry of result.considered) {
        const mark = entry.kept ? style.green('keep') : style.yellow('ask ');
        const where = entry.slug
          ? `${entry.slug} ${style.grey(`(${entry.score})`)}`
          : style.grey('no page scored high enough');
        line(`  ${mark} ${truncate(entry.claim, 76)}`);
        line(`       ${style.grey('→')} ${where}`);
      }
    }

    if (result.wrote?.length) {
      heading('Wrote');
      for (const target of result.wrote) {
        line(
          `  ${style.green(target.action.padEnd(9))} ${target.line ? `${target.slug}:${target.line}` : target.slug}`,
        );
      }
    }

    for (const approval of result.approvals ?? []) {
      line(`\n${style.yellow('needs approval')} ${approval.reason}`);
      line(`  ${style.grey('nearest')}  ${approval.nearest.join(', ')}`);
      line(`  ${style.bold(`akno approve ${approval.proposal_id}`)}`);
    }

    return (result.approvals?.length ?? 0) > 0 ? 2 : 0;
  } finally {
    await mem.close();
  }
}
