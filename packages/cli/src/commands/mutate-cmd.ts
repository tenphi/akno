import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, statusLabel, style, truncate } from '../output.ts';
import { printWriteOutcome } from './write-cmd.ts';
import { resolveOps, runMaintenance } from '../ops-handle.ts';

const FORGET_HELP = `akno forget <--fact <id> | --slug <slug> | --document <id>>

  Retract a fact by removing the sentence that produced it, or move a page or a
  document to trash. Always journalled, always reversible with undo for the
  retention window.

  Removing a fact removes a line from a file. Expiring a row while the sentence
  stays would mean forgetting it today and reading it again tomorrow.

  --actor <who>   user | agent
  --json`;

export async function forgetCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ fact?: string; slug?: string; document?: string; actor?: string }>(argv, {
    fact: { type: 'string' },
    slug: { type: 'string' },
    document: { type: 'string' },
    actor: { type: 'string' },
  });

  if (values.help || [values.fact, values.slug, values.document].filter(Boolean).length !== 1) {
    line(FORGET_HELP);
    return values.help ? 0 : 1;
  }

  const handle = await resolveOps(values, openOptionsFrom(values), {
    write: true,
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });
  try {
    const result = await handle.ops.forget({
      ...(values.fact ? { fact: values.fact } : {}),
      ...(values.slug ? { slug: values.slug } : {}),
      ...(values.document ? { document: values.document } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(`${statusLabel(result.status)} ${style.grey(`change ${result.change_id}`)}`);
    kv([
      ['from', result.removed_from],
      ['removed', result.removed ? truncate(result.removed, 84) : null],
      ['trashed to', result.trashed],
    ]);
    line(`\n  ${style.grey(`reverse with`)} ${style.bold(`akno undo ${result.change_id}`)}`);
    return 0;
  } finally {
    await handle.close();
  }
}

const UNDO_HELP = `akno undo <change_id>
akno undo --list

  Reverse a change. The id outlives the session, the process, and a full rebuild of
  every table except the journal — which holds the previous bytes rather than a
  pointer to them.

  --list          Recent changes, newest first.
  --json`;

export async function undoCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ list: boolean; limit?: string }>(argv, {
    list: { type: 'boolean', default: false },
    limit: { type: 'string' },
  });

  if (values.help || (!values.list && positionals.length === 0)) {
    line(UNDO_HELP);
    return values.help ? 0 : 1;
  }

  if (values.list) {
    // `changes` is not an op — an agent has no business reading the journal — so it travels on the
    // command channel, which is also how it reaches a running service instead of failing beside it.
    const changes = await runMaintenance(
      'changes',
      { limit: values.limit ? Number(values.limit) : 20 },
      values,
      openOptionsFrom(values),
      async (akno) => akno.changes(values.limit ? Number(values.limit) : 20),
      { writable: false },
    );
    {
      if (values.json) {
        json(changes);
        return 0;
      }
      heading(`${changes.length} change${changes.length === 1 ? '' : 's'}`);
      for (const change of changes) {
        const state = change.status === 'undone' ? style.grey('undone ') : style.green('applied');
        line(
          `  ${style.bold(change.id)}  ${state}  ${change.at.slice(0, 19).replace('T', ' ')}  ${change.summary}`,
        );
        line(
          style.grey(
            `    ${change.actor}/${change.op}  ${change.files.map((f) => `${f.action} ${f.relPath}`).join(', ')}`,
          ),
        );
      }
      return 0;
    }
  }

  const handle = await resolveOps(values, openOptionsFrom(values), { write: true });
  try {
    const result = await handle.ops.undo({ change_id: positionals[0]! });
    if (values.json) {
      json(result);
      return 0;
    }
    line(`${statusLabel(result.status)} reversed ${style.bold(result.reversed ?? '')}`);
    for (const file of result.restored ?? []) line(`  ${style.green('restored')}  ${file}`);
    for (const file of result.removed ?? []) line(`  ${style.yellow('removed ')}  ${file}`);
    return 0;
  } finally {
    await handle.close();
  }
}

const MOVE_HELP = `akno move <from> <to>

  Relocate a page with its documents, rewriting the page's own embeds. Inbound
  links from other pages are reported, never rewritten — editing half a dozen
  other pages is a bigger change than the one you asked for.

  The page keeps its id, so facts, events and journal history stay attached.

  --actor <who>   user | agent
  --json`;

export async function moveCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{ actor?: string }>(argv, { actor: { type: 'string' } });

  if (values.help || positionals.length !== 2) {
    line(MOVE_HELP);
    return values.help ? 0 : 1;
  }

  const handle = await resolveOps(values, openOptionsFrom(values), {
    write: true,
    ...(values.actor === 'user' || values.actor === 'agent' ? { actor: values.actor } : {}),
  });
  try {
    const result = await handle.ops.move({ from: positionals[0]!, to: positionals[1]! });
    if (values.json) {
      json(result);
      return result.outcome === 'ok' ? 0 : 2;
    }

    if (result.outcome === 'requires_approval') return printWriteOutcome(result);

    line(`${statusLabel(result.status)} ${style.grey(`change ${result.change_id}`)}`);
    for (const file of result.moved ?? []) line(`  ${style.green('moved')}  ${file}`);
    for (const slug of result.broken_inbound ?? []) {
      line(`  ${style.yellow('still links to the old slug')}  ${slug}`);
    }
    if (result.note) line(style.grey(`\n  ${result.note}`));
    return 0;
  } finally {
    await handle.close();
  }
}

const APPROVE_HELP = `akno approve <proposal_id> [--slug <page>]
akno approve --list
akno decline <proposal_id>

  Resolve a gated proposal. Approving applies the write that was held with it, so
  the caller does not have to repeat it.

  --slug <page>   Where to write it. Required for a \`route\` proposal, which exists
                  because nothing scored high enough to choose a page — "approved"
                  with no destination is not an answer to that question. \`--list\`
                  shows the nearest candidates; naming a page that does not exist
                  yet creates it, which is often the right answer.

  A declined proposal is remembered: an agent that asks for the same folder again
  gets the refusal back instead of a second question.

  --json`;

export async function approveCommand(argv: string[], decline = false): Promise<number> {
  const { values, positionals } = parse<{ list: boolean; slug?: string }>(argv, {
    list: { type: 'boolean', default: false },
    slug: { type: 'string' },
  });

  if (values.help || (!values.list && positionals.length === 0)) {
    line(APPROVE_HELP);
    return values.help ? 0 : 1;
  }

  // Approving is the user speaking, by definition — it is the answer to a gate that only exists for
  // agents. It travels on the command channel rather than the op surface for the same reason: an
  // agent that could call `approve` could wave through its own gated proposal.
  if (values.list) {
    const pending = await runMaintenance(
      'proposals',
      {},
      values,
      openOptionsFrom(values),
      async (akno) => akno.proposals(),
      { writable: false },
    );
    {
      if (values.json) {
        json(pending);
        return 0;
      }
      if (pending.length === 0) {
        line(style.grey('nothing waiting'));
        return 0;
      }
      heading(`${pending.length} waiting`);
      for (const proposal of pending) {
        line(`  ${style.bold(proposal.id)}  ${style.grey(proposal.kind)}  ${proposal.reason}`);
        const nearest = JSON.parse(proposal.nearest) as string[];
        if (nearest.length > 0) line(style.grey(`    could go instead: ${nearest.join(', ')}`));
      }
      return 0;
    }
  }

  {
    if (decline) {
      const result = await runMaintenance(
        'decline',
        { proposal_id: positionals[0]! },
        values,
        openOptionsFrom(values),
        async (akno) => akno.decline(positionals[0]!),
      );
      if (values.json) {
        json(result);
        return 0;
      }
      line(`${statusLabel('ok')} declined ${style.grey(result.subject)}`);
      line(
        style.grey('  remembered, so an agent asking again gets the refusal rather than a second question'),
      );
      return 0;
    }

    const result = await runMaintenance(
      'approve',
      { proposal_id: positionals[0]!, ...(values.slug ? { slug: values.slug } : {}) },
      values,
      openOptionsFrom(values),
      async (akno) => akno.approve(positionals[0]!, values.slug ? { slug: values.slug } : {}),
    );
    if (values.json) {
      json(result);
      return 0;
    }
    line(`${statusLabel('ok')} approved ${style.grey(result.subject)}`);
    // The write that was held with the proposal has just run, so report it the
    // same way `akno write` would.
    if (result.write) return printWriteOutcome(result.write);
    return 0;
  }
}
