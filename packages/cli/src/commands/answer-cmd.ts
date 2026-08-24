import type { AnswerOutput, PageRole } from '@tenphi/akno-protocol';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, statusLabel, style } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const ANSWER_HELP = `akno answer <question> [options]

  Ask memory for a direct grounded answer. This internally performs qualified
  recall and returns compact related page slugs/document ids, never evidence
  excerpts. Use recall when you need to inspect or quote the evidence itself.

  --limit <n>         Maximum qualified retrieval candidates.
  --budget <n>        Internal retrieval evidence budget.
  --include <r,...>   Page roles to include, e.g. source.
  --folder <path>     Restrict to a folder.
  --type <t>          Restrict to a frontmatter type.
  --tag <t,...>       Restrict to pages carrying all of these tags.
  --source <s>        page | document | both
  --ownership <o>     orphan | owned | any
  --since <date>      Earliest evidence date: YYYY, YYYY-MM, or YYYY-MM-DD.
  --until <date>      Latest evidence date: YYYY, YYYY-MM, or YYYY-MM-DD.
  --no-expand         Search the exact question without model expansion.
  --no-graph          Disable bounded graph-assisted candidate discovery.
  --rerank            Run configured retrieval reranking/qualification. Off by default.
  --context           Return the exact bounded evidence supplied to the answer model.
  --max-answer-tokens <n>
                      Limit generated answer tokens for this call.
  --json              Machine-readable compact response.`;

export async function answerCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    limit?: string;
    budget?: string;
    include?: string;
    folder?: string;
    type?: string;
    tag?: string;
    source?: string;
    ownership?: string;
    since?: string;
    until?: string;
    expand: boolean;
    graph: boolean;
    rerank: boolean;
    context: boolean;
    'max-answer-tokens'?: string;
  }>(argv, {
    limit: { type: 'string' },
    budget: { type: 'string' },
    include: { type: 'string' },
    folder: { type: 'string' },
    type: { type: 'string' },
    tag: { type: 'string' },
    source: { type: 'string' },
    ownership: { type: 'string' },
    since: { type: 'string' },
    until: { type: 'string' },
    expand: { type: 'boolean', default: true },
    graph: { type: 'boolean', default: true },
    rerank: { type: 'boolean', default: false },
    context: { type: 'boolean', default: false },
    'max-answer-tokens': { type: 'string' },
  });

  if (values.help || positionals.length === 0) {
    line(ANSWER_HELP);
    return values.help ? 0 : 1;
  }

  const filter = {
    ...(values.folder ? { folder: values.folder } : {}),
    ...(values.type ? { type: values.type } : {}),
    ...(values.tag ? { tags: splitList(values.tag) } : {}),
    ...(values.source ? { source: values.source as 'page' | 'document' | 'both' } : {}),
    ...(values.ownership ? { ownership: values.ownership as 'orphan' | 'owned' | 'any' } : {}),
  };
  const handle = await resolveOps(values, openOptionsFrom(values));
  try {
    const result = await handle.ops.answer({
      question: positionals.join(' '),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
      ...(values.budget ? { retrieval_budget: Number(values.budget) } : {}),
      ...(values.include ? { include: splitList(values.include) as PageRole[] } : {}),
      ...(Object.keys(filter).length > 0 ? { filter } : {}),
      ...(values.since ? { since: values.since } : {}),
      ...(values.until ? { until: values.until } : {}),
      expand: values.expand,
      graph: values.graph,
      rerank: values.rerank,
      include_context: values.context,
      ...(values['max-answer-tokens'] ? { max_answer_tokens: Number(values['max-answer-tokens']) } : {}),
    });

    if (values.json) json(result);
    else printAnswer(result);
    return result.status === 'unavailable' ? 1 : 0;
  } finally {
    await handle.close();
  }
}

function printAnswer(result: AnswerOutput): void {
  line(
    `${statusLabel(result.status)} ${style.grey(`outcome=${result.outcome}`)} ` +
      style.grey(
        `${result.related_page_slugs.length} related page(s), ` +
          `${result.related_documents.length} related document(s)`,
      ),
  );
  if (result.degraded?.length) line(style.yellow(`  degraded: ${result.degraded.join(', ')}`));
  if (result.answer) line(`\n${result.answer}`);
  else if (result.note) line(style.grey(`  ${result.note}`));

  if (result.citations.length > 0) {
    heading('Citations');
    for (const citation of result.citations) {
      if (citation.type === 'page') line(`  ${citation.slug}:${citation.lines.join(',')}`);
      else {
        const pages = citation.pages?.length ? ` pages ${citation.pages.join(',')}` : '';
        line(`  ${citation.document_id}${pages}`);
      }
    }
  }
  if (result.related_page_slugs.length > 0) {
    heading('Related pages');
    for (const slug of result.related_page_slugs) line(`  ${slug}`);
  }
  if (result.related_documents.length > 0) {
    heading('Related documents');
    for (const document of result.related_documents) {
      line(`  ${document.id}${document.owner_slug ? ` (${document.owner_slug})` : ''}`);
    }
  }
  if (result.context?.length) {
    heading('Context');
    for (const item of result.context) {
      if (item.type === 'page') {
        line(`  ${item.evidence_id} · ${item.slug} — ${item.title}`);
        for (const sourceLine of item.lines) line(`    ${sourceLine.n}: ${sourceLine.text}`);
      } else {
        const pages = item.pages?.length ? ` pages ${item.pages.join(',')}` : '';
        line(`  ${item.evidence_id} · ${item.document_id}${pages}`);
        line(`    ${item.quote}`);
      }
    }
  }
  const missing = Object.entries(result.coverage).filter(([, covered]) => !covered);
  if (missing.length > 0) {
    line(style.yellow(`\n  uncovered: ${missing.map(([concept]) => concept).join(', ')}`));
  }
  if (result.searched.length > 1 || result.outcome === 'not_found') {
    line(`\n${style.grey(`searched: ${result.searched.map((query) => `"${query}"`).join(', ')}`)}`);
  }
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
