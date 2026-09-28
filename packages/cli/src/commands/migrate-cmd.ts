import type {
  BrainMigrationReport,
  ObservationMigrationReport,
  RetainedTimelineLedgerReport,
} from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style } from '../output.ts';
import { runMaintenance } from '../ops-handle.ts';

const MIGRATE_HELP = `akno migrate [options]

  Upgrade Akno-owned Markdown memory blocks and restore missing visible status labels. This is
  explicit, journalled and undoable; indexing never rewrites brain bytes.

  --dry-run       Report eligible and held legacy items without writing.
  --observations  Co-locate unambiguous legacy observation lines instead of migrating v1 memory markers.
  --retained-timelines  Preview missing, stale, or separately grouped timeline references.
  --timeline SLUG  Limit retained-timeline reconciliation to one declared ledger.
  --apply         Apply the retained-timeline preview; otherwise it changes no files.
  --json`;

export async function migrateCommand(argv: string[]): Promise<number> {
  const { values } = parse<{
    'dry-run': boolean;
    observations: boolean;
    'retained-timelines': boolean;
    apply: boolean;
    timeline: string;
  }>(argv, {
    'dry-run': { type: 'boolean', default: false },
    observations: { type: 'boolean', default: false },
    'retained-timelines': { type: 'boolean', default: false },
    apply: { type: 'boolean', default: false },
    timeline: { type: 'string' },
  });
  if (values.help) {
    line(MIGRATE_HELP);
    return 0;
  }
  if (values['retained-timelines'] && values.observations)
    throw new Error('choose either --retained-timelines or --observations');
  if (values.apply && !values['retained-timelines']) throw new Error('--apply requires --retained-timelines');
  if (values.timeline && !values['retained-timelines'])
    throw new Error('--timeline requires --retained-timelines');
  const report = await runMaintenance<
    BrainMigrationReport | ObservationMigrationReport | RetainedTimelineLedgerReport
  >(
    'migrate',
    {
      dry_run: values['dry-run'],
      observations: values.observations,
      retained_timelines: values['retained-timelines'],
      apply: values.apply,
      ...(values.timeline ? { timeline: values.timeline } : {}),
    },
    values,
    openOptionsFrom(values),
    (akno) =>
      values['retained-timelines']
        ? akno.migrateRetainedTimelines({
            apply: values.apply,
            ...(values.timeline ? { timeline: values.timeline } : {}),
          })
        : values.observations
          ? akno.migrateObservations({ dryRun: values['dry-run'] })
          : akno.migrateBrain({ dryRun: values['dry-run'] }),
    { requiredFeature: values.timeline ? 'scoped_timeline_migration' : undefined },
  );
  if ('applied' in report) {
    if (values.json) {
      json(report);
      return 0;
    }
    heading(`Retained timeline ${report.applied ? 'reconciliation' : 'preview'}`);
    kv([
      ['pages scanned', report.scannedPages],
      ['ledgers to change', report.changedPaths.length],
      ['changed paths', report.changedPaths.join(', ') || '-'],
      ['change', report.changeId ?? '-'],
    ]);
    if (!report.applied) line(style.grey('  preview — use --apply to write and journal these changes'));
    return 0;
  }
  if (values.json) {
    json(report);
    return report.held > 0 ? 2 : 0;
  }
  heading(`${values.observations ? 'Observation' : 'Brain'} migration${values['dry-run'] ? ' preview' : ''}`);
  kv([
    ['status', report.status],
    ['pages scanned', report.scannedPages],
    ['legacy markers', report.legacyMarkers],
    ['migrated', report.migrated],
    ...('normalizedPayloads' in report
      ? [['normalized labels', report.normalizedPayloads] as [string, number]]
      : []),
    ['held', report.held],
    ['files changed', report.changedPaths.length],
    ['change', 'changeIds' in report ? report.changeIds.join(', ') || '-' : (report.changeId ?? '-')],
  ]);
  if (values['dry-run']) line(style.grey('  dry run — no knowledge-base bytes or receipts were changed'));
  if (report.held > 0) {
    line(
      style.yellow(
        values.observations
          ? '  held observations lack exact eligible lineage, one subject, or one admitted target'
          : '  held markers are malformed or have no unambiguous owned payload',
      ),
    );
  }
  return report.held > 0 ? 2 : 0;
}
