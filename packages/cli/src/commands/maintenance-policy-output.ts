import type { MaintenancePathPolicy, MaintenancePathTransformPolicy } from '@tenphi/akno-core';
import { heading, kv, line, style } from '../output.ts';

/** Human view of the same typed explanation returned by --json and the service. */
export function printMaintenancePathPolicy(policy: MaintenancePathPolicy): void {
  heading(`Maintenance policy — ${policy.slug}`);
  kv([
    ['profile', policy.profile],
    ['run ceiling', policy.runMode],
    ['path state', policy.state.replaceAll('_', ' ')],
    ['page role', `${policy.page.role} (${policy.page.roleSource.replaceAll('_', ' ')})`],
    ['dream opt-in', `${policy.page.dream} (${policy.page.dreamSource})`],
    ['remember', `${policy.page.remember} (${policy.page.rememberSource.replaceAll('_', ' ')})`],
    ['reserved', policy.page.reserved ? 'yes' : 'no'],
    [
      'maintenance model',
      policy.maintenanceModel.configured
        ? `${policy.maintenanceModel.id ?? 'configured'} (configured; health not probed)`
        : 'not configured',
    ],
  ]);

  line('\n  page-targeted transformations');
  const width = Math.max(...policy.transformations.map((entry) => entry.kind.length));
  for (const entry of policy.transformations) printTransform(entry, width);

  line('\n  path-independent transformations');
  for (const entry of policy.pathIndependent) {
    const enabled = entry.enabled && entry.policy !== 'off';
    line(`    ${entry.kind.padEnd(width)}  ${enabled ? entry.policy : 'off'}  ${style.grey(entry.reason)}`);
  }

  line('\n  whole-run apply limits');
  kv(
    [
      ['items', policy.limits.maxItems],
      ['changed files', policy.limits.maxFilesChanged],
      ['written bytes', policy.limits.maxBytesWritten],
      ['high-risk items', policy.limits.maxHighRiskItems],
    ],
    '    ',
  );

  line(`\n  ${style.grey('still required for any proposal:')}`);
  for (const check of policy.remainingChecks) line(`    ${style.grey(`• ${check}`)}`);
}

function printTransform(entry: MaintenancePathTransformPolicy, width: number): void {
  const outcome = outcomeLabel(entry);
  const color =
    entry.outcome === 'curator_then_apply'
      ? style.green
      : entry.outcome === 'awaiting_human' || entry.outcome === 'audit_only'
        ? style.cyan
        : entry.outcome === 'apply_blocked'
          ? style.yellow
          : style.grey;
  line(`    ${entry.kind.padEnd(width)}  ${entry.effectivePolicy.padEnd(6)}  ${color(outcome)}`);
  for (const blocker of entry.blockers) line(`      ${style.grey(`blocked: ${blocker.message}`)}`);
  for (const blocker of entry.applyBlockers) {
    line(`      ${style.grey(`apply blocked: ${blocker.message}`)}`);
  }
}

function outcomeLabel(entry: MaintenancePathTransformPolicy): string {
  switch (entry.outcome) {
    case 'off':
      return 'not inspected';
    case 'ineligible':
      return 'not eligible';
    case 'audit_only':
      return 'plan and report only';
    case 'awaiting_human':
      return 'plan, then wait for human approval';
    case 'curator_then_apply':
      return 'plan, independent curator, verified apply';
    case 'apply_blocked':
      return 'plan, but automatic apply is currently blocked';
  }
}
