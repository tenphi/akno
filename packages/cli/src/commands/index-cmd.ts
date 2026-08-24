import { openOptionsFrom, parse } from '../args.ts';
import { runMaintenance } from '../ops-handle.ts';
import { heading, json, kv, line, ms, progressWriter, style } from '../output.ts';

const INDEX_HELP = `akno index [options]

  Reconcile the index against the knowledge base. Safe to run any time — a pass
  with nothing changed stats the tree and stops.

  --verify            Hash every file instead of trusting mtime and size. The
                      correctness path: catches a sync client or a restored
                      backup that preserved mtime across a real content change.
  --structural        Skip the model-backed passes (embeddings, summaries,
                      facts). Structure indexes in milliseconds.
  --rederive          Re-run summaries and fact derivation even where the body
                      hash has not moved.
  --rebuild           Delete the index first, then index from scratch. Costs one
                      re-index and no data; the knowledge base is untouched.
  --json              Machine-readable report.`;

export async function indexCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    verify: boolean;
    structural: boolean;
    rederive: boolean;
    rebuild: boolean;
  }>(argv, {
    verify: { type: 'boolean', default: false },
    structural: { type: 'boolean', default: false },
    rederive: { type: 'boolean', default: false },
    rebuild: { type: 'boolean', default: false },
  });

  if (values.help) {
    line(INDEX_HELP);
    return 0;
  }

  if (values.rebuild) {
    const { loadConfig } = await import('@tenphi/akno-core');
    const config = loadConfig(openOptionsFrom(values));
    const fs = await import('node:fs');
    // Deleting the index costs one re-index and no data. That property is the
    // design — so `--rebuild` is allowed to be this blunt.
    for (const suffix of ['', '-wal', '-shm']) {
      fs.rmSync(`${config.dbPath}${suffix}`, { force: true });
    }
    line(style.grey(`removed ${config.dbPath}`));
  }

  const input = {
    ...(values.verify ? { verify: true } : {}),
    ...(values.structural ? { structuralOnly: true } : {}),
    ...(values.rederive ? { rederive: true } : {}),
  };

  // Through the service when one is running — it holds the write handle. In-process it also
  // gets a progress writer, which a socket cannot carry: the service logs its own progress.
  const report = await runMaintenance('index', input, values, openOptionsFrom(values), async (mem) => {
    const progress = progressWriter();
    return mem.index({
      ...input,
      onProgress: (update) => progress(update.phase, update.done, update.total, update.detail),
    });
  });

  {
    if (values.json) {
      json(report);
      return 0;
    }

    heading(`Indexed in ${ms(report.durationMs)}`);
    kv([
      ['pages indexed', report.pagesIndexed],
      ['pages unchanged', report.pagesUnchanged],
      ['pages renamed', report.pagesRenamed > 0 ? report.pagesRenamed : '-'],
      ['pages removed', report.pagesRemoved > 0 ? report.pagesRemoved : '-'],
      ['ignored by role', report.ignored > 0 ? report.ignored : '-'],
      ['chunks written', report.chunksWritten],
      ['chunks embedded', report.chunksEmbedded],
      ['pages summarized', report.pagesDerived],
      ['facts derived', report.factsDerived],
      ['events indexed', report.eventsIndexed],
      ['graph nodes', report.graphNodes],
      ['graph edges', report.graphEdges],
      ['graph entities', report.graphEntities],
      ['graph mentions', report.graphMentions],
      ['ambiguous mentions', report.graphAmbiguousMentions > 0 ? report.graphAmbiguousMentions : '-'],
      ['unresolved mentions', report.graphUnresolvedMentions > 0 ? report.graphUnresolvedMentions : '-'],
      ['contextual mentions', report.graphContextualMentions > 0 ? report.graphContextualMentions : '-'],
      ['new contextual choices', report.graphContextualResolved > 0 ? report.graphContextualResolved : '-'],
      ['contextual abstentions', report.graphContextualAbstained > 0 ? report.graphContextualAbstained : '-'],
      ['contextual failures', report.graphContextualFailed > 0 ? report.graphContextualFailed : '-'],
      ['graph facts', report.graphFacts],
      ['fact edges', report.graphFactEdges],
      ['non-traversable facts', report.graphNonTraversableFacts > 0 ? report.graphNonTraversableFacts : '-'],
      ['documents linked', report.documentsLinked],
      ['documents read', report.documentsExtracted > 0 ? report.documentsExtracted : '-'],
      ['documents summarized', report.documentsSummarized > 0 ? report.documentsSummarized : '-'],
      ['text renditions', report.renditionsWritten > 0 ? report.renditionsWritten : '-'],
      ['files hashed', report.hashed],
    ]);

    if (report.warnings.length > 0) {
      heading(`${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`);
      for (const warning of report.warnings.slice(0, 20)) line(`  ${style.yellow('·')} ${warning}`);
      if (report.warnings.length > 20) {
        line(style.grey(`  … ${report.warnings.length - 20} more — see \`akno doctor\``));
      }
    }
    return 0;
  }
}
