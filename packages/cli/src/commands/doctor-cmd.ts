import { open, readOnlyExplanation } from '@akno/core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, ms, style } from '../output.ts';

const DOCTOR_HELP = `akno doctor [options]

  What's present, what's degraded, and what that costs. Model latency and index
  latency are reported separately — a memory system that feels slow after idling
  is almost never suffering from its storage engine.

  --no-probe          Skip the model round trips. Instant, but no latency numbers.
  --json`;

export async function doctorCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ probe: boolean }>(argv, {
    probe: { type: 'boolean', default: true },
  });

  if (values.help) {
    line(DOCTOR_HELP);
    return 0;
  }

  // Read-only: `doctor` must be safe to run against a live service.
  const mem = await open({ ...openOptionsFrom(values), writable: false });
  try {
    const report = await mem.doctor({ probeModels: values.probe });

    if (values.json) {
      json(report);
      return report.warnings.length > 0 ? 1 : 0;
    }

    heading('Akno');
    kv([
      ['knowledge base', report.aknoPath],
      ['state', report.stateDir],
      ['config', report.configSources.map((s) => s.replace(process.env.HOME ?? '~', '~')).join(' → ')],
      [
        'writable',
        report.writable ? 'yes' : `no — ${readOnlyExplanation(report.readOnlyReason, report.lockHeldBy)}`,
      ],
      ['vector backend', report.vectorBackend === 'vec0' ? 'sqlite-vec (exact brute force)' : 'JS fallback'],
    ]);

    heading('Index');
    kv([
      ['pages', `${report.counts.pages}${formatClasses(report.byClass)}`],
      ['chunks', `${report.counts.chunks} (${report.counts.chunksEmbedded} embedded)`],
      ['facts', `${report.counts.facts} live, ${report.counts.factsSuperseded} superseded`],
      ['events', report.counts.events],
      ['documents', `${report.counts.documents} (${report.counts.documentsExtracted} extracted)`],
      ['links', `${report.counts.links} (${report.counts.brokenLinks} broken)`],
      ['exclusion rules', report.counts.excludedRules],
    ]);

    // Reported apart because they are unrelated; conflating them hides which is slow.
    heading('Latency — index only, no model in the path');
    kv([
      ['point lookup', ms(report.index.openMs)],
      ['FTS5 match', ms(report.index.lexicalMs)],
      ['vector scan', report.index.vectorMs === null ? 'no embeddings' : ms(report.index.vectorMs)],
    ]);

    heading('Models');
    for (const role of report.models) {
      const state = role.available
        ? style.green('ok')
        : role.configured
          ? style.red('unavailable')
          : style.grey('not configured');
      const latency = role.latencyMs !== null ? style.grey(` ${ms(role.latencyMs)}`) : '';
      line(`  ${style.bold(role.role.padEnd(10))} ${state}${latency}`);
      if (role.model) line(`    ${style.grey(`${role.model} @ ${role.endpoint ?? '?'}`)}`);
      if (!role.available) {
        if (role.error) line(`    ${style.grey(role.error)}`);
        // The consequence is the part that is actually useful to a reader.
        line(`    ${style.yellow('without it:')} ${role.withoutIt}`);
      }
    }

    heading('Extraction');
    kv([
      [
        'PDF and images',
        report.extraction.swift
          ? 'PDFKit text layer, Vision OCR (macOS frameworks)'
          : 'unavailable — the Swift helper could not be built',
      ],
      ['Office formats', report.extraction.textutil ? 'textutil' : 'unavailable'],
    ]);

    heading('Reserved paths');
    for (const entry of report.reserved) {
      const state =
        entry.state === 'ok'
          ? style.green('ok')
          : entry.state === 'missing'
            ? style.grey('missing')
            : style.yellow('occupied');
      line(`  ${entry.path.padEnd(16)} ${state}${entry.note ? style.grey(`  ${entry.note}`) : ''}`);
    }

    if (report.warnings.length > 0) {
      heading(`${report.warnings.length} warning${report.warnings.length === 1 ? '' : 's'}`);
      for (const warning of report.warnings) line(`  ${style.yellow('·')} ${warning}`);
    } else {
      line(`\n${style.green('no warnings')}`);
    }

    return report.warnings.length > 0 ? 1 : 0;
  } finally {
    await mem.close();
  }
}

function formatClasses(byClass: Record<string, number>): string {
  const parts = Object.entries(byClass)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
