import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, statusLabel, style } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const FOLDER_HELP = `akno folder <path> --description <text> [options]

  Declare a folder and what belongs in it. The rule is written to
  <akno_path>/akno.json, so the taxonomy travels with the notes.

  Never gated: nothing here waits on approval. What it asks for is a sentence —
  \`description\` is what the next caller reads before filing a page there.

  --description <text>  What belongs here. Required.
  --role <r>            knowledge | source | inference | ignored. Default knowledge.
  --remember <m>        integrate | deny. Defaults from the role.
  --type <t>            Default page type for this folder.
  --ingest <mode>       page | document | file | auto | ignore.
  --rank <n>            0..2, multiplied into the recall score.
  --route               Make this an inbox: arrivals are named and moved out of it.
  --actor <who>         user | agent.
  --dry-run             Report the rule; write nothing.
  --json`;

export async function folderCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    description?: string;
    role?: string;
    remember?: string;
    type?: string;
    ingest?: string;
    rank?: string;
    route: boolean;
    actor?: string;
    'dry-run': boolean;
  }>(argv, {
    description: { type: 'string' },
    role: { type: 'string' },
    remember: { type: 'string' },
    type: { type: 'string' },
    ingest: { type: 'string' },
    rank: { type: 'string' },
    route: { type: 'boolean', default: false },
    actor: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  });

  if (values.help || positionals.length === 0) {
    line(FOLDER_HELP);
    return positionals.length === 0 && !values.help ? 1 : 0;
  }

  if (!values.description) {
    line(style.red('  --description is required. A folder nothing can explain is the thing this prevents.'));
    return 1;
  }

  const handle = await resolveOps(values, openOptionsFrom(values), {
    write: true,
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });
  try {
    const result = await handle.ops.folder({
      path: positionals[0]!,
      description: values.description,
      ...(values.role ? { role: values.role as 'knowledge' | 'source' | 'inference' | 'ignored' } : {}),
      ...(values.remember ? { remember: values.remember as 'integrate' | 'deny' } : {}),
      ...(values.type ? { type: values.type } : {}),
      ...(values.ingest ? { ingest: values.ingest as 'page' | 'document' | 'file' | 'auto' | 'ignore' } : {}),
      ...(values.rank !== undefined ? { rank: Number(values.rank) } : {}),
      ...(values.route ? { route: true } : {}),
      ...(values['dry-run'] ? { dry_run: true } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    if (result.outcome === 'noop') {
      line(`${statusLabel('ok')} ${style.grey(result.note ?? 'already declared')}`);
      kv(Object.entries(result.rule ?? {}).map(([key, value]) => [key, String(value)]));
      return 0;
    }

    heading(`${style.green('declared')} ${result.path}`);
    kv([
      ['rule', result.glob ?? null],
      ['in', result.rules_file ?? null],
      ...Object.entries(result.rule ?? {}).map(([key, value]): [string, string] => [key, String(value)]),
    ]);
    if (result.change_id) {
      line(`\n  ${style.grey('reverse with')} ${style.bold(`akno undo ${result.change_id}`)}`);
    }
    if (result.note) line(style.grey(`\n  ${result.note}`));
    return 0;
  } finally {
    await handle.close();
  }
}
