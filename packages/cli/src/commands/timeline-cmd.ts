import { openOptionsFrom, parse } from '../args.ts';
import { json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const TIMELINE_HELP = `akno timeline [options]

  One clock-relative view of authored events, retained states/plans/deadlines,
  and document date evidence without collapsing their meanings.

  --since <YYYY[-MM[-DD]]>
  --until <YYYY[-MM[-DD]]>
  --match <text>      Substring match on the summary.
  --subject <id>      Page slug, retained subject/memory id, or document id/path.
  --source <kind>     all | event | state | plan | deadline | document
  --scope <scope>     past | today | future | all
  --clock <relation>  past | today | current_period | ongoing | future |
                      overdue | undated
  --status <status>   actual | scheduled | planned | tentative
  --disposition <d>  active | proposed | accepted | rejected | resolved |
                      cancelled | completed | superseded
  --view <view>       history (default) | actionable
  --as-of <instant>   Evaluate against an explicit ISO instant.
  --timezone <zone>   IANA timezone for the query clock.
  --order <o>         newest | oldest | nearest
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
    source?: string;
    scope?: string;
    clock?: string;
    status?: string;
    disposition?: string;
    view?: string;
    'as-of'?: string;
    timezone?: string;
  }>(argv, {
    since: { type: 'string' },
    until: { type: 'string' },
    match: { type: 'string' },
    subject: { type: 'string' },
    order: { type: 'string' },
    limit: { type: 'string' },
    source: { type: 'string' },
    scope: { type: 'string' },
    clock: { type: 'string' },
    status: { type: 'string' },
    disposition: { type: 'string' },
    view: { type: 'string' },
    'as-of': { type: 'string' },
    timezone: { type: 'string' },
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
      ...(values.order ? { order: values.order as 'newest' | 'oldest' | 'nearest' } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
      ...(values.source
        ? {
            source: values.source as
              'all' | 'both' | 'event' | 'state' | 'plan' | 'deadline' | 'document' | 'document_evidence',
          }
        : {}),
      ...(values.scope ? { scope: values.scope as 'past' | 'today' | 'future' | 'all' } : {}),
      ...(values.clock
        ? {
            clock_relation: values.clock as
              'past' | 'today' | 'current_period' | 'ongoing' | 'future' | 'overdue' | 'undated',
          }
        : {}),
      ...(values.status
        ? { temporal_status: values.status as 'actual' | 'scheduled' | 'planned' | 'tentative' }
        : {}),
      ...(values.disposition
        ? {
            disposition: values.disposition as
              | 'active'
              | 'proposed'
              | 'accepted'
              | 'rejected'
              | 'resolved'
              | 'cancelled'
              | 'completed'
              | 'superseded',
          }
        : {}),
      ...(values.view ? { view: values.view as 'history' | 'actionable' } : {}),
      ...(values['as-of'] ? { as_of: values['as-of'] } : {}),
      ...(values.timezone ? { timezone: values.timezone } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(
      `${statusLabel(result.status)} ${style.grey(`${result.total} result${result.total === 1 ? '' : 's'}`)}` +
        `${result.results.length < result.total ? style.grey(` (showing ${result.results.length})`) : ''}`,
    );
    line(style.grey(`  as of ${result.clock.as_of} in ${result.clock.timezone}`));
    if (result.note) line(style.yellow(`  ${result.note}`));
    for (const entry of result.results) {
      if (entry.type === 'document_evidence') {
        const page = entry.matched_page ? ` p${entry.matched_page}` : '';
        line(
          `  ${style.bold(entry.date)}  ${truncate(entry.label, 80)} ` +
            style.grey(
              `[document_evidence; ${entry.clock_relation}; ${entry.date_basis}; ${entry.path}${page}]`,
            ),
        );
        if (entry.quote) line(`    ${truncate(entry.quote.replaceAll('\n', ' '), 100)}`);
        continue;
      }
      if (entry.type === 'memory') {
        const boundary = entry.start ?? entry.until ?? 'undated';
        line(
          `  ${style.bold(boundary)}  ${truncate(entry.summary, 72)} ` +
            style.grey(
              `[${entry.source_kind}; ${entry.temporal_status}; ${entry.disposition}; ` +
                `${entry.clock_relation}; ${entry.slug}:${entry.line}]`,
            ),
        );
        continue;
      }
      const target = entry.slug ? style.cyan(` → ${entry.slug}`) : '';
      const source = style.grey(
        ` [event; actual; ${entry.clock_relation}; ${entry.source}${entry.line ? `:${entry.line}` : ''}]`,
      );
      line(`  ${style.bold(entry.date)}  ${truncate(entry.summary, 80)}${target}${source}`);
    }
    return 0;
  } finally {
    await handle.close();
  }
}
