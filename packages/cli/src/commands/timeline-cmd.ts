import { openOptionsFrom, parse } from '../args.ts';
import { json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const TIMELINE_HELP = `akno timeline [options]

  When things happened. Events are indexed from the ledger and from dated lines
  on any page, so a date written where it belongs is found too.

  --since <YYYY[-MM[-DD]]>
  --until <YYYY[-MM[-DD]]>
  --match <text>      Substring match on the summary.
  --subject <slug>    Events linking to, or written on, this page.
  --order <o>         newest | oldest
  --limit <n>
  --json`;

export async function timelineCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    since?: string;
    until?: string;
    match?: string;
    subject?: string;
    order?: string;
    limit?: string;
  }>(argv, {
    since: { type: 'string' },
    until: { type: 'string' },
    match: { type: 'string' },
    subject: { type: 'string' },
    order: { type: 'string' },
    limit: { type: 'string' },
  });

  if (values.help) {
    line(TIMELINE_HELP);
    return 0;
  }

  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.timeline({
      ...(values.since ? { since: values.since } : {}),
      ...(values.until ? { until: values.until } : {}),
      ...(values.match ? { match: values.match } : {}),
      ...(values.subject ? { subject: values.subject } : {}),
      ...(values.order ? { order: values.order as 'newest' | 'oldest' } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(
      `${statusLabel(result.status)} ${style.grey(`${result.total} event${result.total === 1 ? '' : 's'}`)}` +
        `${result.events.length < result.total ? style.grey(` (showing ${result.events.length})`) : ''}`,
    );
    for (const event of result.events) {
      const target = event.slug ? style.cyan(` → ${event.slug}`) : '';
      const source = style.grey(` [${event.source}${event.line ? `:${event.line}` : ''}]`);
      line(`  ${style.bold(event.date)}  ${truncate(event.summary, 80)}${target}${source}`);
    }
    return 0;
  } finally {
    await handle.close();
  }
}
