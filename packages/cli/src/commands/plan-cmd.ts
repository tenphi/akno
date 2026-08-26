import {
  MAINTENANCE_PLAN_STATUSES,
  type ApplyMaintenanceResult,
  type MaintenanceItemStatus,
  type MaintenancePlan,
  type MaintenancePlanPruneResult,
  type MaintenancePlanStatus,
  type MaintenancePlanSummary,
  type MaintenanceStatus,
  type MaintenanceStatusQuery,
} from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { runMaintenance } from '../ops-handle.ts';
import { fail, heading, json, kv, line, style } from '../output.ts';
import {
  dreamAutoEstimateSummary,
  dreamModelDegradationSummary,
  dreamModelUsageSummary,
} from './dream-model-status.ts';

const PLAN_HELP = `akno plan [list] [--limit <n>] [--status <status,...>]
akno plan show <plan_id>
akno plan diff <plan_id> [--item <item_id>]
akno plan decide <plan_id> --item <item_id> <--approve | --reject> [--reason <text>]
akno plan apply <plan_id>
akno plan supersede <plan_id> [--reason <text>]
akno plan prune [--apply]
akno plan status

  Inspect and control durable maintenance plans. Planning never changes knowledge-base
  files. Applying checks every source and create target before writing, journals each
  item as one change, re-indexes every affected path, and verifies the resulting index.

  --status <s,...>  Filter list by exact plan status.
  prune previews configured retention by default; --apply performs it.
  --json`;

export async function planCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    limit?: string;
    item?: string;
    approve: boolean;
    reject: boolean;
    reason?: string;
    status?: string;
    apply: boolean;
  }>(argv, {
    limit: { type: 'string' },
    item: { type: 'string' },
    approve: { type: 'boolean', default: false },
    reject: { type: 'boolean', default: false },
    reason: { type: 'string' },
    status: { type: 'string' },
    apply: { type: 'boolean', default: false },
  });
  const action = positionals[0] ?? 'list';
  const planId = positionals[1];

  if (values.help) {
    line(PLAN_HELP);
    return 0;
  }

  if (action === 'list') {
    const limit = positiveLimit(values.limit);
    const statuses = parsePlanStatuses(values.status);
    if (statuses === null) return 2;
    const plans = await runMaintenance(
      'plan',
      { action: 'list', limit, ...(statuses.length > 0 ? { status: statuses } : {}) },
      values,
      openOptionsFrom(values),
      async (mem) => mem.plans(limit, statuses),
      { writable: false },
    );
    if (values.json) json(plans);
    else printPlanList(plans);
    return 0;
  }

  if (action === 'status') {
    const status = await loadMaintenanceStatus(values);
    if (values.json) json(status);
    else printMaintenanceStatus(status);
    return 0;
  }

  if (action === 'prune') {
    if (planId) {
      line(PLAN_HELP);
      return 1;
    }
    const result = await runMaintenance(
      'plan',
      { action: 'prune', apply: values.apply },
      values,
      openOptionsFrom(values),
      async (mem) => mem.prunePlans({ apply: values.apply }),
    );
    if (values.json) json(result);
    else printPruneResult(result);
    return 0;
  }

  if (!planId || !['show', 'diff', 'decide', 'apply', 'supersede'].includes(action)) {
    line(PLAN_HELP);
    return 1;
  }

  if (action === 'show') {
    const plan = await runMaintenance(
      'plan',
      { action: 'show', plan_id: planId },
      values,
      openOptionsFrom(values),
      async (mem) => mem.plan(planId),
      { writable: false },
    );
    if (values.json) json(plan);
    else printPlan(plan);
    return 0;
  }

  if (action === 'diff') {
    const diff = await runMaintenance(
      'plan',
      { action: 'diff', plan_id: planId, ...(values.item ? { item_id: values.item } : {}) },
      values,
      openOptionsFrom(values),
      async (mem) => mem.maintenanceDiff(planId, values.item),
      { writable: false },
    );
    if (values.json) json({ plan_id: planId, item_id: values.item ?? null, diff });
    else line(diff);
    return 0;
  }

  if (action === 'decide') {
    if (!values.item || Number(values.approve) + Number(values.reject) !== 1) {
      line(PLAN_HELP);
      return 1;
    }
    const outcome = values.approve ? 'approve' : 'reject';
    const plan = await runMaintenance(
      'plan',
      {
        action: 'decide',
        plan_id: planId,
        item_id: values.item,
        outcome,
        reason: values.reason ?? '',
      },
      values,
      openOptionsFrom(values),
      async (mem) => mem.decidePlan(planId, values.item!, outcome, values.reason),
    );
    if (values.json) json(plan);
    else {
      line(`${style.green(outcome === 'approve' ? 'approved' : 'rejected')} ${values.item}`);
      printPlanSummary(plan);
    }
    return 0;
  }

  if (action === 'supersede') {
    const plan = await runMaintenance(
      'plan',
      {
        action: 'supersede',
        plan_id: planId,
        ...(values.reason ? { reason: values.reason } : {}),
      },
      values,
      openOptionsFrom(values),
      async (mem) => mem.supersedePlan(planId, values.reason),
    );
    if (values.json) json(plan);
    else {
      line(`${style.yellow('superseded')} ${plan.id}`);
      if (plan.error) line(`  ${style.grey(plan.error)}`);
    }
    return 0;
  }

  const result = await runMaintenance(
    'plan',
    { action: 'apply', plan_id: planId },
    values,
    openOptionsFrom(values),
    async (mem) => mem.applyPlan(planId),
  );
  if (values.json) json(result);
  else printApplyResult(result);
  return result.plan.status === 'failed' ? 2 : 0;
}

export async function loadMaintenanceStatus(
  values: Parameters<typeof openOptionsFrom>[0],
  query: MaintenanceStatusQuery = {},
): Promise<MaintenanceStatus> {
  return runMaintenance(
    'plan',
    {
      action: 'status',
      ...(query.runId ? { run_id: query.runId } : {}),
      ...(query.last !== undefined ? { last: query.last } : {}),
      ...(query.pending ? { pending: true } : {}),
    },
    values,
    openOptionsFrom(values),
    async (mem) => mem.maintenanceStatus(query),
    { writable: false },
  );
}

export function printMaintenanceStatus(status: MaintenanceStatus): void {
  heading('Maintenance');
  kv([
    ['profile', status.authority.profile],
    ['local notifications', status.notifications],
    ['cycle authority', status.authority.mode],
    ['automatic KB writes', status.authority.automaticKnowledgeBaseWrites ? 'allowed' : 'not allowed'],
    ['observe', status.authority.observe],
    ['reflect', status.authority.reflect],
    ['curate', status.authority.curate],
    ['adopt', status.authority.adopt],
    ['active dream runs', status.activeRuns],
    ['active plans', status.active],
    ['awaiting decisions', status.awaitingHuman],
    ['verification pending', status.verificationPending],
    ['budget deferred', status.budgetDeferred],
  ]);
  line('\n  transformation policies');
  for (const policy of ['auto', 'review', 'audit', 'off'] as const) {
    const kinds = Object.entries(status.authority.policies)
      .filter(([, effective]) => effective === policy)
      .map(([kind]) => kind);
    if (kinds.length > 0) line(`    ${policy.padEnd(14)} ${kinds.join(', ')}`);
  }
  line('\n  whole-run apply limits');
  kv([
    ['items', status.authority.limits.maxItems],
    ['changed files', status.authority.limits.maxFilesChanged],
    ['written bytes', status.authority.limits.maxBytesWritten],
    ['high-risk items', status.authority.limits.maxHighRiskItems],
  ]);
  if (status.latestRun) {
    line('\n  latest dream run');
    kv([
      ['id', status.latestRun.id],
      ['status', status.latestRun.status],
      ['profile', status.latestRun.profile],
      ['mode', status.latestRun.mode],
      ['model', status.latestRun.modelUsage.modelId],
      ['started', status.latestRun.startedAt],
      ['snapshot', status.latestRun.snapshot.indexRevision.slice(0, 12)],
      ['model work', dreamModelUsageSummary(status.latestRun.modelUsage)],
      ['auto estimate', dreamAutoEstimateSummary(status.latestRun.autoEstimate)],
      ['degraded', dreamModelDegradationSummary(status.latestRun.degraded)],
    ]);
    if (status.latestRun.budget) {
      kv([
        [
          'budget used',
          `${status.latestRun.budget.used.items} items, ` +
            `${status.latestRun.budget.used.filesChanged} files, ` +
            `${status.latestRun.budget.used.bytesWritten} bytes, ` +
            `${status.latestRun.budget.used.highRiskItems} high-risk`,
        ],
        ['budget deferred', status.latestRun.budget.deferredItems],
      ]);
    }
  }
  if (!status.latest) {
    line(style.grey('\n  no maintenance plans yet'));
    return;
  }
  line('\n  latest');
  printPlanSummary(status.latest);
}

function printPlanList(plans: MaintenancePlanSummary[]): void {
  if (plans.length === 0) {
    line(style.grey('no maintenance plans'));
    return;
  }
  heading(`${plans.length} maintenance plan${plans.length === 1 ? '' : 's'}`);
  for (const plan of plans) printPlanSummary(plan);
}

function printPlan(plan: MaintenancePlan): void {
  heading(`${plan.id} — ${plan.status}`);
  kv([
    ['mode', plan.mode],
    ['phase', plan.phase],
    ['created', plan.createdAt],
    ['summary', plan.summary],
    ...(plan.payloadPrunedAt
      ? ([['private payload', `pruned at ${plan.payloadPrunedAt}`]] as [string, string][])
      : []),
    ...(plan.error ? ([['detail', plan.error]] as [string, string][]) : []),
  ]);
  for (const item of plan.items) {
    const components = (item.componentCount ?? 1) > 1 ? `  ${item.componentCount} components` : '';
    line(
      `\n  ${style.bold(item.id)}  ${itemStatus(item.status)}  ${item.kind}/${item.risk}  ` +
        `${style.grey(item.policy)}${components}  ${item.subject}`,
    );
    line(`    ${style.grey(item.rationale)}`);
    if (item.decision) {
      line(`    ${style.grey(`${item.decision.actor}: ${item.decision.outcome} — ${item.decision.reason}`)}`);
    }
    if (!item.decision && item.statusReason) line(`    ${style.grey(item.statusReason)}`);
    if (item.verification) line(`    ${style.grey(item.verification.detail)}`);
    if (item.changeId) {
      line(`    ${style.grey('undo:')} ${style.bold(`akno undo ${item.changeId}`)}`);
    }
  }
  if (plan.items.some((item) => item.status === 'proposed')) {
    line(`\n  ${style.grey('inspect exact changes with')} ${style.bold(`akno plan diff ${plan.id}`)}`);
  }
}

function printPlanSummary(plan: MaintenancePlanSummary): void {
  const counts = nonzeroCounts(plan.counts);
  line(
    `  ${style.bold(plan.id)}  ${itemStatus(plan.status)}  ${plan.mode}/${plan.phase}` +
      (counts ? style.grey(`  ${counts}`) : ''),
  );
  line(`    ${style.grey(`${plan.createdAt.slice(0, 19).replace('T', ' ')} · ${plan.summary}`)}`);
}

function printApplyResult(result: ApplyMaintenanceResult): void {
  heading(`${result.plan.id} — ${result.plan.status}`);
  for (const item of result.plan.items) {
    const components = (item.componentCount ?? 1) > 1 ? `  ${item.componentCount} components` : '';
    line(`  ${itemStatus(item.status)}  ${item.id}${components}  ${item.subject}`);
    if (item.verification) line(`    ${style.grey(item.verification.detail)}`);
    if (!item.decision && item.statusReason) line(`    ${style.grey(item.statusReason)}`);
    if (item.changeId) line(`    ${style.grey('reverse with')} ${style.bold(`akno undo ${item.changeId}`)}`);
  }
  line(
    style.grey(
      `  budget: ${result.budget.used.items}/${result.budget.limits.maxItems} items, ` +
        `${result.budget.used.filesChanged}/${result.budget.limits.maxFilesChanged} files, ` +
        `${result.budget.used.bytesWritten}/${result.budget.limits.maxBytesWritten} bytes, ` +
        `${result.budget.used.highRiskItems}/${result.budget.limits.maxHighRiskItems} high-risk; ` +
        `${result.budget.deferredItems} deferred`,
    ),
  );
}

export function printPruneResult(result: MaintenancePlanPruneResult): void {
  heading(result.applied ? 'Plan retention applied' : 'Plan retention preview');
  kv([
    ['private payload window', `${result.retention.payloadDays} days`],
    ['compact receipt window', `${result.retention.receiptDays} days`],
    ['payload plans', result.payloads.plans],
    ['payload items', result.payloads.items],
    ['private bytes', result.payloads.privateBytes],
    ['receipts', result.receipts.plans],
    ['receipt items', result.receipts.items],
  ]);
  if (!result.applied && (result.payloads.plans > 0 || result.receipts.plans > 0)) {
    line(
      `\n  ${style.grey('apply this exact retention boundary with')} ${style.bold('akno plan prune --apply')}`,
    );
  }
}

function itemStatus(status: string): string {
  if (status === 'applied' || status === 'completed' || status === 'approved') return style.green(status);
  if (
    status === 'rejected' ||
    status === 'stale' ||
    status === 'verification_failed' ||
    status === 'failed'
  ) {
    return style.yellow(status);
  }
  return style.cyan(status);
}

function nonzeroCounts(counts: Record<MaintenanceItemStatus, number>): string {
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => `${value} ${name.replaceAll('_', ' ')}`)
    .join(', ');
}

function positiveLimit(value: string | undefined): number {
  const parsed = value ? Number(value) : 20;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20;
}

export function parsePlanStatuses(value: string | undefined): MaintenancePlanStatus[] | null {
  if (value === undefined) return [];
  const statuses = [
    ...new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
  if (
    statuses.length === 0 ||
    statuses.some((status) => !(MAINTENANCE_PLAN_STATUSES as readonly string[]).includes(status))
  ) {
    fail(`--status must contain: ${MAINTENANCE_PLAN_STATUSES.join(', ')}`);
    return null;
  }
  return statuses as MaintenancePlanStatus[];
}
