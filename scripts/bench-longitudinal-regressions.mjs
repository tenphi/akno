import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  options: { output: { type: 'string', default: 'bench-results/lifecycle/deterministic-regressions.json' } },
});
const suites = {
  'packages/core/test/dream.test.ts': [
    'blocked_plan_then_independent_work',
    'colocated_observation',
    'positive_reflection',
    'dependent_evidence_retraction',
    'graph_and_answer_leaf_citations',
    'adoption_rollback',
  ],
  'packages/core/test/curate.test.ts': [
    'overview_membership_clock_restart',
    'heading_and_status_table',
    'qualified_quote_scoped_edit',
    'stale_dependent_page',
    'bounded_verification_context',
  ],
  'packages/core/test/retain.test.ts': [
    'support_replay_and_retraction',
    'atomic_correction_holds',
    'relative_time_clock',
    'wrong_destination_hold',
  ],
  'packages/core/test/recovery-policy.test.ts': ['paused_maintenance_inspection_and_explicit_resume'],
  'packages/core/test/run-recovery.test.ts': ['abandoned_cycle_recovery'],
  'packages/core/src/maintenance/recovery.test.ts': ['rollback_counting_and_pause'],
  'packages/core/src/maintenance/overview.test.ts': [
    'missing_scope_unavailable_vs_empty',
    'legacy_links_literal_scope',
    'controlled_date_boundaries',
  ],
  'packages/core/src/observations/projection.test.ts': ['wrong_subject_and_correlated_lineage'],
  'packages/core/src/write/retain-quality-corpus.test.ts': [
    'nested_attribution_uncertainty',
    'unresolved_relative_time',
    'source_correction_relations',
  ],
};
const rawFile = `${values.output}.private-vitest.json`;
fs.mkdirSync(path.dirname(rawFile), { recursive: true });
const started = performance.now();
const processResult = spawnSync(
  'pnpm',
  ['exec', 'vitest', 'run', ...Object.keys(suites), '--reporter=json', `--outputFile=${rawFile}`],
  { stdio: 'inherit' },
);
if (!fs.existsSync(rawFile)) throw new Error('The deterministic runner produced no test receipt.');
const raw = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
const results = Object.entries(suites).map(([file, coverage]) => {
  const result = raw.testResults.find((entry) => path.resolve(entry.name) === path.resolve(file));
  if (!result || !result.assertionResults.length) throw new Error(`Missing regression suite ${file}.`);
  return {
    file,
    coverage,
    sourceFingerprint: createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    tests: result.assertionResults.map((test) => ({
      name: test.fullName,
      status: test.status,
      durationMs: test.duration ?? null,
    })),
  };
});
const report = {
  version: 'longitudinal-deterministic-regressions-v1',
  evidence: 'production_paths_scripted_model_outcomes_not_live_model_quality',
  operationLatencyMs: performance.now() - started,
  providerCost: null,
  liveModelCalls: 0,
  source: 'existing_invented_regression_suites',
  success:
    processResult.status === 0 &&
    raw.success &&
    results.every((result) => result.tests.every((test) => test.status === 'passed')),
  suites: results,
};
fs.writeFileSync(values.output, JSON.stringify(report, null, 2) + '\n');
if (!report.success) process.exitCode = 1;
