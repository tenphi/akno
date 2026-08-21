import { openOptionsFrom, parse } from '../args.ts';
import { json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const TIMELINE_HELP = `akno timeline [options]

  When things happened. Authored events remain distinct from dated orphan
  document evidence, whose date basis and source citation are shown explicitly.

  --since <YYYY[-MM[-DD]]>
  --until <YYYY[-MM[-DD]]>
  --match <text>      Substring match on the summary.
  --subject <id>      Page slug or orphan document id/path.
  --source <kind>     event | document | both (default)
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
    source?: string;
  }>(argv, {
    since: { type: 'string' },
    until: { type: 'string' },
    match: { type: 'string' },
    subject: { type: 'string' },
    order: { type: 'string' },
    limit: { type: 'string' },
    source: { type: 'string' },
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
      ...(values.source ? { source: values.source as 'event' | 'document' | 'both' } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    line(
      `${statusLabel(result.status)} ${style.grey(`${result.total} result${result.total === 1 ? '' : 's'}`)}` +
        `${result.results.length < result.total ? style.grey(` (showing ${result.results.length})`) : ''}`,
    );
    for (const entry of result.results) {
      if (entry.type === 'document_evidence') {
        const page = entry.matched_page ? ` p${entry.matched_page}` : '';
        line(
          `  ${style.bold(entry.date)}  ${truncate(entry.label, 80)} ` +
            style.grey(`[${entry.date_basis}; ${entry.path}${page}]`),
        );
        if (entry.quote) line(`    ${truncate(entry.quote.replaceAll('\n', ' '), 100)}`);
        continue;
      }
      const target = entry.slug ? style.cyan(` → ${entry.slug}`) : '';
      const source = style.grey(` [${entry.source}${entry.line ? `:${entry.line}` : ''}]`);
      line(`  ${style.bold(entry.date)}  ${truncate(entry.summary, 80)}${target}${source}`);
    }
    return 0;
  } finally {
    await handle.close();
  }
}
