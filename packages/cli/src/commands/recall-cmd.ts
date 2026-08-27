import type { RecallGraphPath, RecallMode, RecallResult } from '@tenphi/akno-protocol';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const RECALL_HELP = `akno recall <query> [options]

  Search memory. Returns cited page and standalone document results.

  --mode <m>          lookup | question | explore. Inferred from the query by
                      default; passing it explicitly always wins.
  --depth <d>         summary | lines | full
  --limit <n>         Maximum results.
  --budget <n>        Token budget for the whole response.
  --include <r,...>   Page roles to include, e.g. source. With --depth full
                      this lifts the source quote cap.
  --folder <path>     Restrict to a folder.
  --type <t>          Restrict to a frontmatter type.
  --tag <t,...>       Restrict to pages carrying all of these tags.
  --source <s>        page | document | both
  --ownership <o>     orphan | owned | any
  --no-expand         Search the exact words given; useful for filenames.
  --no-graph          Disable bounded graph-assisted candidate discovery.
  --json              Machine-readable response.`;

export async function recallCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    mode?: string;
    depth?: string;
    limit?: string;
    budget?: string;
    include?: string;
    folder?: string;
    type?: string;
    tag?: string;
    source?: string;
    ownership?: string;
    expand: boolean;
    graph: boolean;
  }>(argv, {
    mode: { type: 'string' },
    depth: { type: 'string' },
    limit: { type: 'string' },
    budget: { type: 'string' },
    include: { type: 'string' },
    folder: { type: 'string' },
    type: { type: 'string' },
    tag: { type: 'string' },
    source: { type: 'string' },
    ownership: { type: 'string' },
    expand: { type: 'boolean', default: true },
    graph: { type: 'boolean', default: true },
  });

  if (values.help || positionals.length === 0) {
    line(RECALL_HELP);
    return values.help ? 0 : 1;
  }

  const query = positionals.join(' ');
  const handle = await resolveOps(values, openOptionsFrom(values));

  try {
    const filter = {
      ...(values.folder ? { folder: values.folder } : {}),
      ...(values.type ? { type: values.type } : {}),
      ...(values.tag ? { tags: values.tag.split(',').map((t) => t.trim()) } : {}),
      ...(values.source ? { source: values.source as 'page' | 'document' | 'both' } : {}),
      ...(values.ownership ? { ownership: values.ownership as 'orphan' | 'owned' | 'any' } : {}),
    };

    const result = await handle.ops.recall({
      query,
      ...(values.mode ? { mode: values.mode as RecallMode } : {}),
      ...(values.depth ? { depth: values.depth as 'summary' | 'lines' | 'full' } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
      ...(values.budget ? { budget: Number(values.budget) } : {}),
      ...(values.include
        ? {
            include: values.include.split(',').map((c) => c.trim()) as (
              'knowledge' | 'source' | 'inference' | 'ignored'
            )[],
          }
        : {}),
      expand: values.expand,
      graph: values.graph,
      ...(Object.keys(filter).length > 0 ? { filter } : {}),
    });

    if (values.json) {
      json(result);
      return 0;
    }

    printRecall(result);
    return result.status === 'unavailable' ? 1 : 0;
  } finally {
    await handle.close();
  }
}

/**
 * The output deliberately foregrounds the three things a reader needs and a
 * pile of ranked chunks cannot give: the status, the coverage, and a line address
 * on every quoted line.
 */
function printRecall(result: {
  status: string;
  degraded?: string[];
  results: RecallResult[];
  searched: string[];
  budget_used: number;
  coverage?: Record<string, boolean>;
  mode: string;
  note?: string;
}): void {
  line(
    `${statusLabel(result.status)} ${style.grey(`mode=${result.mode}`)} ` +
      `${style.grey(`${result.results.length} result${result.results.length === 1 ? '' : 's'}`)} ` +
      `${style.grey(`${result.budget_used} tokens`)}`,
  );
  if (result.degraded?.length) line(style.yellow(`  degraded: ${result.degraded.join(', ')}`));
  if (result.note) line(style.grey(`  ${result.note}`));

  if (result.coverage && Object.keys(result.coverage).length > 0) {
    const parts = Object.entries(result.coverage).map(([concept, covered]) =>
      covered ? style.green(`✓ ${concept}`) : style.red(`✗ ${concept}`),
    );
    line(`  ${style.grey('coverage')} ${parts.join('  ')}`);
    const missing = Object.entries(result.coverage).filter(([, covered]) => !covered);
    if (missing.length > 0) {
      // This line is the whole point of coverage: it tells the reader what they
      // are *not* allowed to conclude from what came back.
      line(
        style.yellow(
          `  nothing returned covers ${missing.map(([c]) => `"${c}"`).join(', ')} — do not answer that part`,
        ),
      );
    }
  }

  for (const resultCard of result.results) {
    if (resultCard.type === 'document') {
      heading(`${resultCard.path} ${style.grey(`(unfiled document, ${resultCard.score.toFixed(3)})`)}`);
      printMatchMetadata(resultCard);
      if (resultCard.summary) line(`  ${truncate(resultCard.summary, 150)}`);
      const where = resultCard.matched_page ? `page ${resultCard.matched_page}` : 'extracted text';
      line(`  ${style.grey(`${resultCard.source.kind} via ${resultCard.source.via}; ${where}`)}`);
      for (const quoted of resultCard.quote?.split('\n') ?? []) line(`  ${truncate(quoted, 110)}`);
      if (resultCard.parts?.length) {
        line(style.grey(`  parts: ${resultCard.parts.map((part) => part.path).join(', ')}`));
      }
      line(style.grey(`  read: akno read --document ${resultCard.id}`));
      continue;
    }
    const card = resultCard;
    heading(`${card.slug} ${style.grey(`(${card.role}, ${card.score.toFixed(3)})`)}`);
    printMatchMetadata(card);
    if (card.breadcrumb) line(`  ${style.cyan(card.breadcrumb)}`);
    if (card.summary) line(`  ${truncate(card.summary, 150)}`);
    for (const bodyLine of card.lines) {
      const confidence = bodyLine.confidence !== undefined ? style.grey(` ~${bodyLine.confidence}`) : '';
      line(`  ${style.grey(`${card.slug}:${bodyLine.n}`)}  ${truncate(bodyLine.text, 110)}${confidence}`);
    }
    if (card.truncated) line(style.grey('  … quote window capped (source page)'));
    for (const entry of card.superseded ?? []) {
      line(style.yellow(`  superseded: ${truncate(entry.claim, 90)} (until ${entry.valid_to})`));
    }
    if (card.documents?.length) {
      const matched = card.documents.filter((doc) => doc.quote);
      const rest = card.documents.filter((doc) => !doc.quote);
      // A document that matched is quoted with the page inside it, because that is the
      // citation a reader checks. The rest are listed as what else is attached.
      for (const doc of matched) {
        const where = doc.matched_page ? `p${doc.matched_page}` : 'text';
        const parts = doc.parts ? style.grey(` (${doc.parts} files, ${doc.pages ?? '?'}p)`) : '';
        line(`  ${style.grey(`${doc.rel_path ?? doc.id} ${where}`)}${parts}`);
        if (doc.summary) line(`    ${style.grey(truncate(doc.summary, 106))}`);
        for (const quoted of doc.quote!.split('\n')) line(`    ${truncate(quoted, 106)}`);
      }
      if (rest.length > 0) {
        line(
          style.grey(
            `  documents: ${rest.map((doc) => `${doc.rel_path ?? doc.id}${doc.pages ? ` (${doc.pages}p)` : ''}`).join(', ')}`,
          ),
        );
      }
    }
    if (card.links?.length) line(style.grey(`  links: ${card.links.slice(0, 8).join(', ')}`));
  }

  if (result.searched.length > 1 || result.results.length === 0) {
    line(`\n${style.grey(`searched: ${result.searched.map((q) => `"${q}"`).join(', ')}`)}`);
  }
}

function printMatchMetadata(result: RecallResult): void {
  if (result.matched_by?.length) line(style.grey(`  matched: ${result.matched_by.join(' + ')}`));
  for (const graphPath of result.graph_paths ?? []) {
    line(style.grey(`  graph: ${formatGraphPath(graphPath)}`));
  }
}

function formatGraphPath(path: RecallGraphPath): string {
  const parts: string[] = [];
  for (let index = 0; index < path.nodes.length; index++) {
    const node = path.nodes[index]!;
    parts.push(node.slug ?? node.document ?? node.label ?? node.id);
    const relation = path.relations[index];
    if (relation) parts.push(`-${relation}->`);
  }
  return parts.join(' ');
}
