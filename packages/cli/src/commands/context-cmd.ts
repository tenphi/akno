import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const CONTEXT_HELP = `akno context [query] [options]

  The whole pre-turn bundle against one budget: pinned pages, recent timeline, a
  structure outline, and this turn's recall. Normally called by a host before the
  model sees the turn, not by an agent.

  --budget <n>        Total token budget (default 20000).
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
  }>(argv, {
    budget: { type: 'string' },
    pin: { type: 'string' },
    days: { type: 'string' },
    structure: { type: 'boolean', default: true },
  });

  if (values.help) {
    line(CONTEXT_HELP);
    return 0;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.context({
      ...(positionals.length > 0 ? { query: positionals.join(' ') } : {}),
      budget: values.budget ? Number(values.budget) : 20000,
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
        `${result.dropped ? style.yellow(`  dropped ${result.dropped.cards} cards, ${result.dropped.events} events`) : ''}`,
    );
    if (result.degraded?.length) line(style.yellow(`  degraded: ${result.degraded.join(', ')}`));

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

    if (result.events.length > 0) {
      heading(`Timeline — last ${values.days ?? 90} days`);
      for (const event of result.events) {
        line(`  ${style.bold(event.date)}  ${truncate(event.summary, 78)}`);
      }
    }

    for (const [label, cards] of [
      ['Pinned', result.pinned],
      ['Recalled', result.cards],
    ] as const) {
      if (cards.length === 0) continue;
      heading(label);
      for (const card of cards) {
        line(`  ${style.bold(card.slug)} ${style.grey(`(${card.class})`)}`);
        if (card.summary) line(`    ${truncate(card.summary, 100)}`);
        for (const bodyLine of card.lines.slice(0, 6)) {
          line(`    ${style.grey(`${card.slug}:${bodyLine.n}`)}  ${truncate(bodyLine.text, 96)}`);
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
