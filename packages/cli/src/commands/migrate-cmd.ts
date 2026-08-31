import type { BrainMigrationReport } from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { heading, json, kv, line, style } from '../output.ts';
import { runMaintenance } from '../ops-handle.ts';

const MIGRATE_HELP = `akno migrate [options]

  Upgrade Akno-owned Markdown memory blocks to the current brain schema. This is
  explicit, journalled and undoable; indexing never rewrites brain bytes.

  --dry-run   Report eligible and held legacy markers without writing.
  --json`;

export async function migrateCommand(argv: string[]): Promise<number> {
  const { values } = parse<{ 'dry-run': boolean }>(argv, {
    'dry-run': { type: 'boolean', default: false },
  });
  if (values.help) {
    line(MIGRATE_HELP);
    return 0;
  }
  const report = await runMaintenance<BrainMigrationReport>(
    'migrate',
    { dry_run: values['dry-run'] },
    values,
    openOptionsFrom(values),
    (akno) => akno.migrateBrain({ dryRun: values['dry-run'] }),
  );
  if (values.json) {
    json(report);
    return report.held > 0 ? 2 : 0;
  }
  heading(values['dry-run'] ? 'Brain migration preview' : 'Brain migration');
  kv([
    ['status', report.status],
    ['pages scanned', report.scannedPages],
    ['legacy markers', report.legacyMarkers],
    ['migrated', report.migrated],
    ['held', report.held],
    ['files changed', report.changedPaths.length],
    ['change', report.changeId ?? '-'],
  ]);
  if (values['dry-run']) line(style.grey('  dry run — no brain bytes or receipts were changed'));
  if (report.held > 0) {
    line(style.yellow('  held markers are malformed or have no unambiguous owned payload'));
  }
  return report.held > 0 ? 2 : 0;
}
