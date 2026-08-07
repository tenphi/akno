import type { Card, RecallMode } from '@akno/protocol';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, line, statusLabel, style, truncate } from '../output.ts';
import { resolveOps } from '../ops-handle.ts';

const RECALL_HELP = `akno recall <query> [options]

  Search memory. Returns page cards: a summary plus the lines that matched, each
  with the file and line it came from.

  --mode <m>          lookup | question | explore. Inferred from the query by
                      default; passing it explicitly always wins.
  --depth <d>         summary | lines | full
  --limit <n>         Maximum cards.
  --budget <n>        Token budget for the whole response.
  --include <c,...>   Page classes to include, e.g. reference. With --depth full
                      this lifts the reference quote cap.
  --folder <path>     Restrict to a folder.
  --type <t>          Restrict to a frontmatter type.
  --tag <t,...>       Restrict to pages carrying all of these tags.
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
  }>(argv, {
    mode: { type: 'string' },
    depth: { type: 'string' },
    limit: { type: 'string' },
    budget: { type: 'string' },
    include: { type: 'string' },
    folder: { type: 'string' },
    type: { type: 'string' },
    tag: { type: 'string' },
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
    };

    const result = await handle.ops.recall({
      query,
      ...(values.mode ? { mode: values.mode as RecallMode } : {}),
      ...(values.depth ? { depth: values.depth as 'summary' | 'lines' | 'full' } : {}),
      ...(values.limit ? { limit: Number(values.limit) } : {}),
      ...(values.budget ? { budget: Number(values.budget) } : {}),
      ...(values.include
        ? { include: values.include.split(',').map((c) => c.trim()) as ('full' | 'reference' | 'excluded')[] }
        : {}),
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
  cards: Card[];
  searched: string[];
  budget_used: number;
  coverage?: Record<string, boolean>;
  mode: string;
  note?: string;
}): void {
  line(
    `${statusLabel(result.status)} ${style.grey(`mode=${result.mode}`)} ` +
      `${style.grey(`${result.cards.length} card${result.cards.length === 1 ? '' : 's'}`)} ` +
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

  for (const card of result.cards) {
    heading(`${card.slug} ${style.grey(`(${card.class}, ${card.score.toFixed(3)})`)}`);
    if (card.breadcrumb) line(`  ${style.cyan(card.breadcrumb)}`);
    if (card.summary) line(`  ${truncate(card.summary, 150)}`);
    for (const bodyLine of card.lines) {
      const confidence = bodyLine.confidence !== undefined ? style.grey(` ~${bodyLine.confidence}`) : '';
      line(`  ${style.grey(`${card.slug}:${bodyLine.n}`)}  ${truncate(bodyLine.text, 110)}${confidence}`);
    }
    if (card.truncated) line(style.grey('  … quote window capped (reference page)'));
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

  if (result.searched.length > 1 || result.cards.length === 0) {
    line(`\n${style.grey(`searched: ${result.searched.map((q) => `"${q}"`).join(', ')}`)}`);
  }
}
