import { open, readOnlyExplanation, type AdmissionPreview } from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { fail, heading, json, kv, line, ms, style } from '../output.ts';

const DOCTOR_HELP = `akno doctor [options]

  What's present, what's degraded, and what that costs. Model latency and index
  latency are reported separately — a memory system that feels slow after idling
  is almost never suffering from its storage engine.

  --no-probe          Skip the model round trips. Instant, but no latency numbers.
  --refresh-api       Re-probe providers configured with api: auto, ignoring their cache.
  --admission-preview Show exact default-deny folder rules for implicit read-only pages.
                      Reads folder names, never page slugs or content, and writes nothing.
  --quarantine-details Show private paths and stable ids for quarantined Markdown candidates.
  --json`;

export async function doctorCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    probe: boolean;
    'refresh-api': boolean;
    'admission-preview': boolean;
    'quarantine-details': boolean;
  }>(argv, {
    probe: { type: 'boolean', default: true },
    'refresh-api': { type: 'boolean', default: false },
    'admission-preview': { type: 'boolean', default: false },
    'quarantine-details': { type: 'boolean', default: false },
  });

  if (values.help) {
    line(DOCTOR_HELP);
    return 0;
  }
  if (!values.probe && values['refresh-api']) {
    fail('--refresh-api cannot be combined with --no-probe');
    return 2;
  }

  // Read-only for the knowledge base and SQLite. An api:auto probe may atomically update its
  // content-free derived cache; it never contends with the knowledge-base write handle.
  const mem = await open({
    ...openOptionsFrom(values),
    writable: false,
    resolveProviderApis: values.probe,
    refreshProviderApis: values['refresh-api'],
  });
  try {
    const report = await mem.doctor({
      probeModels: values.probe,
      admissionPreview: values['admission-preview'],
      quarantineDetails: values['quarantine-details'],
    });

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
      ['pages', `${report.counts.pages}${formatRoles(report.byRole)}`],
      [
        'fact injection',
        `${report.factInjection.admittedPages} admitted, ${report.factInjection.readOnlyPages} read-only` +
          (report.factInjection.implicitReadOnlyPages > 0
            ? ` (${report.factInjection.implicitReadOnlyPages} without an explicit page or folder decision)`
            : ''),
      ],
      [
        'remember fallback',
        report.factInjection.fallback
          ? `${report.factInjection.fallback.slug} (${report.factInjection.fallback.status.replaceAll('_', ' ')}` +
            `${
              report.factInjection.fallback.status === 'unavailable'
                ? `: ${report.factInjection.fallback.reason.replaceAll('_', ' ')}`
                : ''
            })`
          : 'off',
      ],
      ['chunks', `${report.counts.chunks} (${report.counts.chunksEmbedded} embedded)`],
      ['facts', `${report.counts.facts} live, ${report.counts.factsSuperseded} superseded`],
      ['events', report.counts.events],
      [
        'documents',
        `${report.counts.documents} (${report.counts.documentsExtracted} extracted` +
          `${report.counts.documentsMissing > 0 ? `, ${report.counts.documentsMissing} originals missing` : ''}` +
          `${report.counts.renditions > 0 ? `, ${report.counts.renditions} with text beside them` : ''})`,
      ],
      ['links', `${report.counts.links} (${report.counts.brokenLinks} broken)`],
      ['ignored rules', report.counts.ignoredRules],
      ['quarantined Markdown', report.quarantine.candidates > 0 ? report.quarantine.candidates : '-'],
    ]);

    if (report.quarantine.details?.length) {
      heading('Quarantined Markdown — private details');
      for (const detail of report.quarantine.details) {
        line(
          `  ${detail.relPath}: ${detail.reasons.join(', ')}` +
            (detail.stablePageId ? ` (${detail.stablePageId})` : ''),
        );
      }
    }

    if (report.factInjection.admissionPreview) {
      renderAdmissionPreview(report.factInjection.admissionPreview);
    }

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
      if (role.checks) {
        for (const [name, check] of Object.entries(role.checks)) {
          const checkState =
            check.status === 'ok'
              ? style.green('ok')
              : check.status === 'failed'
                ? style.red('failed')
                : style.grey('skipped');
          const checkLatency = check.latencyMs === null ? '' : style.grey(` ${ms(check.latencyMs)}`);
          const tokens = check.usage?.totalTokens;
          const tokenReceipt =
            tokens === null || tokens === undefined ? '' : style.grey(`, ${tokens} tokens`);
          line(`    ${name.padEnd(12)} ${checkState}${checkLatency}${tokenReceipt}`);
        }
      }
      if (!role.available) {
        if (role.error) line(`    ${style.grey(role.error)}`);
        // The consequence is the part that is actually useful to a reader.
        line(`    ${style.yellow('without it:')} ${role.withoutIt}`);
      }
    }

    heading('Generative transports');
    for (const provider of report.providerApis) {
      const transport = provider.resolved
        ? style.green(provider.resolved)
        : provider.source === 'not_needed'
          ? style.grey('not needed')
          : style.red('unresolved');
      const source =
        provider.configured === 'auto'
          ? style.grey(` ${provider.source}; configured auto`)
          : style.grey(' explicit');
      line(`  ${style.bold(provider.provider.padEnd(12))} ${transport}${source}`);
      if (provider.error) line(`    ${style.grey(provider.error)}`);
    }

    heading('Extraction');
    if (report.extraction.backend === 'linux-native') {
      kv([
        [
          'PDF text layer',
          report.extraction.pdfinfo && report.extraction.pdftotext
            ? 'Poppler'
            : 'unavailable — install Poppler',
        ],
        [
          'PDF and image OCR',
          report.extraction.pdftoppm && report.extraction.tesseract
            ? 'Poppler rasterization, Tesseract OCR'
            : 'unavailable — install Poppler and Tesseract',
        ],
        [
          'Office formats',
          report.extraction.libreoffice ? 'LibreOffice' : 'unavailable — install LibreOffice',
        ],
      ]);
    } else {
      kv([
        [
          'PDF and images',
          report.extraction.swift
            ? 'PDFKit text layer, Vision OCR (macOS frameworks)'
            : 'unavailable — the Swift helper could not be built',
        ],
        ['Office formats', report.extraction.textutil ? 'textutil' : 'unavailable'],
      ]);
    }

    heading('Doors');
    kv([
      ['MCP operations', report.doors.mcpAllow.join(', ') || 'none'],
      [
        'HTTP',
        report.doors.http.address
          ? `${report.doors.http.address}; public: ${report.doors.http.publicAllow.join(', ') || 'none'}`
          : 'off',
      ],
      [
        'HTTP identities',
        report.doors.http.identities.length > 0
          ? report.doors.http.identities
              .map(
                (identity) =>
                  `${identity.name} (${identity.actor}; ${identity.credentialSet ? 'credential set' : 'disabled'})`,
              )
              .join(', ')
          : 'none',
      ],
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

function renderAdmissionPreview(preview: AdmissionPreview): void {
  heading('Admission preview — no changes');
  if (preview.implicitPages === 0) {
    line(`  ${style.green('every knowledge page has an explicit remember decision')}`);
    return;
  }

  line(
    style.grey(
      '  These patches preserve current default-deny behavior. They do not make any page writable or change its role.',
    ),
  );
  for (const proposal of preview.proposedRules) {
    line(
      `  + ${JSON.stringify(proposal.glob)}: { "remember": "deny" } ` +
        style.grey(`(${proposal.pages} implicit page${proposal.pages === 1 ? '' : 's'})`),
    );
  }
  if (preview.rootPages > 0) {
    line(
      style.grey(
        `  ${preview.rootPages} root-level page${preview.rootPages === 1 ? '' : 's'} need page metadata; no broad ** rule was proposed.`,
      ),
    );
  }
  line(style.grey('  Review or change folder classifications interactively with: akno init'));
}

function formatRoles(byRole: Record<string, number>): string {
  const parts = Object.entries(byRole)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${count} ${name}`);
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}
