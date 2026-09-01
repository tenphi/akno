import type { BrainMigrationReport, ObservationMigrationReport } from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style } from '../output.ts';
import { runMaintenance } from '../ops-handle.ts';

const MIGRATE_HELP = `akno migrate [options]

  Upgrade Akno-owned Markdown memory blocks to the current brain schema. This is
  explicit, journalled and undoable; indexing never rewrites brain bytes.

  --dry-run       Report eligible and held legacy items without writing.
  --observations  Co-locate unambiguous legacy observation lines instead of migrating v1 memory markers.
  --json`;

export async function migrateCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ 'dry-run': boolean; observations: boolean }>(argv, {
    'dry-run': { type: 'boolean', default: false },
    observations: { type: 'boolean', default: false },
  });
  if (values.help) {
    line(MIGRATE_HELP);
    return 0;
  }
  const report = await runMaintenance<BrainMigrationReport | ObservationMigrationReport>(
    'migrate',
    { dry_run: values['dry-run'], observations: values.observations },
    values,
    openOptionsFrom(values),
    (akno) =>
      values.observations
        ? akno.migrateObservations({ dryRun: values['dry-run'] })
        : akno.migrateBrain({ dryRun: values['dry-run'] }),
  );
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
