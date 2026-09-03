import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';
import type { MemoryView } from '@tenphi/akno-protocol';

const CONTEXT_HELP = `akno context [query] [options]

  The whole pre-turn bundle against one budget: pinned pages, recent timeline, a
  structure outline, and this turn's recall. Normally called by a host before the
  model sees the turn, not by an agent.

  --budget <n>        Hard token budget (default 20000; auto_recall 1200).
  --profile <name>    "default" or precision-first "auto_recall" (default default).
  --memory-view <v>   factual | history | planning | reports | questions |
                      discussion | all. Inferred conservatively by default.
  --turn <role:text>  Recent user/assistant turn for reference resolution; repeatable.
  --pin <slug,...>    Pages always included, before anything else competes.
  --days <n>          Days of timeline to include. 0 omits the section.
  --no-structure      Omit the folder outline.
  --json              What a host would actually send.`;

export async function contextCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    budget?: string;
    pin?: string;
    days?: string;
    structure: boolean;
    profile?: string;
    'memory-view'?: string;
    turn?: string[];
  }>(argv, {
    budget: { type: 'string' },
    pin: { type: 'string' },
    days: { type: 'string' },
    structure: { type: 'boolean', default: true },
    profile: { type: 'string' },
    'memory-view': { type: 'string' },
    turn: { type: 'string', multiple: true },
  });

  if (values.help) {
    line(CONTEXT_HELP);
    return 0;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.context({
      ...(positionals.length > 0 ? { query: positionals.join(' ') } : {}),
      budget: values.budget ? Number(values.budget) : values.profile === 'auto_recall' ? 1200 : 20000,
      ...(values.profile ? { profile: values.profile as 'default' | 'auto_recall' } : {}),
      ...(values['memory-view'] ? { memory_view: values['memory-view'] as MemoryView } : {}),
      ...(values.turn ? { conversation_context: values.turn.map(parseConversationTurn) } : {}),
      ...(values.pin ? { pinned: values.pin.split(',').map((slug) => slug.trim()) } : {}),
      ...(values.days ? { timeline_days: Number(values.days) } : {}),
      structure: values.structure,
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(
      `${statusLabel(result.status)} ${style.grey(`${result.budget_used} tokens used`)}` +
        `${result.dropped ? style.yellow(`  dropped ${result.dropped.pinned} pinned, ${result.dropped.results} recall, ${result.dropped.timeline} timeline results`) : ''}`,
    );
    if (result.memory_view) line(`  ${style.grey(`memory view: ${result.memory_view}`)}`);
    if (result.degraded?.length) line(style.yellow(`  degraded: ${result.degraded.join(', ')}`));
    if (result.activation) {
      line(
        `  ${style.grey('auto-recall')} ${result.activation.activated ? style.green('activated') : style.grey('empty')} ` +
          style.grey(
            `(${result.activation.basis}; ${result.activation.selected}/${result.activation.candidates} selected` +
              `${result.activation.qualification_run ? '; qualified' : ''}` +
              `${result.activation.reference_resolution !== 'not_needed' ? `; reference ${result.activation.reference_resolution}` : ''})`,
          ),
      );
    }

    if (result.coverage && Object.keys(result.coverage).length > 0) {
      const parts = Object.entries(result.coverage).map(([concept, covered]) =>
        covered ? style.green(`✓ ${concept}`) : style.red(`✗ ${concept}`),
      );
      line(`  ${style.grey('coverage')} ${parts.join('  ')}`);
    }

    if (result.structure) {
      heading('Structure');
      line(
        result.structure
          .split('\n')
          .map((row) => `  ${style.grey(row)}`)
          .join('\n'),
      );
    }

    if (result.timeline.length > 0) {
      heading(`Timeline — last ${values.days ?? 90} days`);
      for (const entry of result.timeline) {
        if (entry.type === 'event') {
          line(`  ${style.bold(entry.date)}  ${truncate(entry.summary, 78)}`);
        } else if (entry.type === 'memory') {
          line(
            `  ${style.bold(entry.start ?? entry.until ?? 'undated')}  ${truncate(entry.summary, 70)} ` +
              style.grey(
                `[${entry.source_kind}; ${entry.temporal_status}; ${entry.disposition}; ${entry.clock_relation}]`,
              ),
          );
        } else {
          line(
            `  ${style.bold(entry.date)}  ${truncate(entry.label, 62)} ` +
              style.grey(`[document; ${entry.clock_relation}; ${entry.date_basis}]`),
          );
          if (entry.quote) line(`    ${truncate(entry.quote.replaceAll('\n', ' '), 96)}`);
        }
      }
    }

    for (const [label, cards] of [['Pinned', result.pinned]] as const) {
      if (cards.length === 0) continue;
      heading(label);
      for (const card of cards) {
        line(`  ${style.bold(card.slug)} ${style.grey(`(${card.role})`)}`);
        if (card.summary) line(`    ${truncate(card.summary, 100)}`);
        for (const bodyLine of card.lines.slice(0, 6)) {
          line(`    ${style.grey(`${card.slug}:${bodyLine.n}`)}  ${truncate(bodyLine.text, 96)}`);
        }
      }
    }

    if (result.results.length > 0) {
      heading('Recalled');
      for (const entry of result.results) {
        if (entry.type === 'document') {
          line(`  ${style.bold(entry.path)} ${style.grey('(unfiled document)')}`);
          if (entry.summary) line(`    ${truncate(entry.summary, 100)}`);
          for (const quoted of entry.quote?.split('\n').slice(0, 6) ?? []) {
            line(`    ${truncate(quoted, 96)}`);
          }
          continue;
        }
        line(`  ${style.bold(entry.slug)} ${style.grey(`(${entry.role})`)}`);
        if (entry.summary) line(`    ${truncate(entry.summary, 100)}`);
        for (const bodyLine of entry.lines.slice(0, 6)) {
          line(`    ${style.grey(`${entry.slug}:${bodyLine.n}`)}  ${truncate(bodyLine.text, 96)}`);
        }
      }
    }

    if (result.searched.length > 0) {
      line(`\n${style.grey(`searched: ${result.searched.map((q) => `"${q}"`).join(', ')}`)}`);
    }
    return 0;
  } finally {
    await handle.close();
  }
}

function parseConversationTurn(value: string): { role: 'user' | 'assistant'; content: string } {
  const separator = value.indexOf(':');
  const role = separator === -1 ? '' : value.slice(0, separator);
  const content = separator === -1 ? '' : value.slice(separator + 1).trim();
  if ((role !== 'user' && role !== 'assistant') || !content) {
    throw new Error('--turn expects user:<text> or assistant:<text>');
  }
  return { role, content };
}
