import {
  MAINTENANCE_TRANSFORMS,
  loadConfig,
  AknoError,
  parsePhase,
  type DreamReport,
  type DreamRunReceipt,
  type HousekeepingPlanRef,
  type MaintenancePathPolicy,
  type MaintenanceMode,
  type MaintenanceStatus,
  type MaintenanceStatusQuery,
  type MaintenanceTransform,
} from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { runMaintenance, type MaintenanceWaitUpdate } from '../ops-handle.ts';
import { heading, json, kv, line, ms, style, truncate } from '../output.ts';
import { loadMaintenanceStatus, printMaintenanceStatus } from './plan-cmd.ts';
import {
  inspectDreamSchedule,
  type DreamScheduleHealth,
  type DreamScheduleStatus,
} from './dream-schedule.ts';
import {
  dreamAutoEstimateSummary,
  dreamModelDegradationSummary,
  dreamModelUsageSummary,
} from './dream-model-status.ts';
import { printMaintenancePathPolicy } from './maintenance-policy-output.ts';
import {
  deliverMaintenanceNotification,
  missedCycleNotification,
  scheduledCommandFailureNotification,
  scheduledRunNotification,
  type NotificationDelivery,
} from './dream-notifications.ts';

const DREAM_HELP = `akno dream [options]
akno dream status [--run <run_id> | --last <n> | --pending | --explain-policy <path>]
akno dream resume <--profile | --transform <kind>>
akno dream notify --schedule-health

  The maintenance cycle. Phases are selectable and safe to re-run.

    observe        Co-locate stable L2 patterns on admitted exact-subject pages with
                   exact fact lineage; never restates a fact or edits adjacent prose.
    reflect        Plan-backed decision principles built on eligible L2 observations.
                   Off by default until the observation tier has enough repeated history.
    curate         Managed-fragment repair plus page-authorized hygiene or synthesis.
                   Runs a draft pass, a verification pass and deterministic guards.
    adopt          A page for a document that has none, written beside the file — so its
                   text can be returned at all. Honours \`ingest: "file"\`.
    conflicts      The thorough pass inline checking cannot do: facts from different
                   pages that state different values for the same thing.
    repair         Legacy report-only view of exact broken-link proposals. Durable fixes
                   are low-risk items in curate audit, review, or auto plans.
    housekeeping   Broken links, orphaned documents, rule drift and exact repair disposition.

  A full/scheduled run resolves the configured maintenance profile. audit plans only,
  review waits for human decisions, autonomous uses a separate curator and applies only
  accepted work. Per-transformation policies may only lower that profile authority.

  Plain status also inspects the local dev.akno.dream LaunchAgent: installed/loaded
  state, daily interval, next expected run, and a two-hour missed-run window. New
  receipts include content-safe model calls, provider token usage, and degradation.

  --phase <name>   Run one phase instead of every enabled one.
  --mode <policy>  audit | review | auto. May lower configured authority for one run;
                   it cannot raise it.
  --dry-run        Run ephemeral diagnostics; change no knowledge-base files and do not count
                   the result as nightly schedule health.
  --private-details
                   Include page names, source excerpts, URLs and other private content in
                   terminal or JSON output. Default output is safe to retain and share.
  --scheduled       Mark a full run as scheduler-owned and deliver configured local notifications.
  --schedule-health Check the expected nightly window and notify once if it was missed.
  --run <run_id>   Show one durable, content-safe run receipt.
  --last <n>       Show the newest 1–100 run receipts.
  --pending        List every nonterminal plan that can still be decided, retried, applied,
                   or verified.
  --explain-policy <path>
                   Explain the resolved profile, page opt-in, structural eligibility,
                   budgets, decision path, and remaining guards for one page.
  --profile        With resume, clear a whole-profile automatic-apply pause after inspection.
  --transform <kind>
                   With resume, clear one transformation pause or rollback streak.
  --json`;

export async function dreamCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    phase?: string;
    mode?: string;
    run?: string;
    last?: string;
    pending: boolean;
    'explain-policy'?: string;
    'dry-run': boolean;
    'private-details': boolean;
    scheduled: boolean;
    'schedule-health': boolean;
    profile: boolean;
    transform?: string;
  }>(argv, {
    phase: { type: 'string' },
    mode: { type: 'string' },
    run: { type: 'string' },
    last: { type: 'string' },
    pending: { type: 'boolean', default: false },
    'explain-policy': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'private-details': { type: 'boolean', default: false },
    scheduled: { type: 'boolean', default: false },
    'schedule-health': { type: 'boolean', default: false },
    profile: { type: 'boolean', default: false },
    transform: { type: 'string' },
  });

  if (values.help) {
    line(DREAM_HELP);
    return 0;
  }

  if (positionals[0] === 'resume' && positionals.length === 1) {
    const selected = Number(values.profile) + Number(values.transform !== undefined);
    if (selected !== 1) {
      throw new AknoError('invalid', 'dream resume requires exactly one of --profile or --transform');
    }
    if (
      values.scheduled ||
      values.phase !== undefined ||
      values.mode !== undefined ||
      values.run !== undefined ||
      values.last !== undefined ||
      values.pending ||
      values['explain-policy'] !== undefined ||
      values['dry-run'] ||
      values['private-details'] ||
      values['schedule-health']
    ) {
      throw new AknoError('invalid', 'dream resume cannot be combined with run or status options');
    }
    const scope = values.profile ? 'profile' : parseMaintenanceTransform(values.transform ?? '');
    const recovery = await runMaintenance(
      'plan',
      { action: 'resume', scope },
      values,
      openOptionsFrom(values),
      async (mem) => mem.resumeMaintenance(scope === 'profile' ? { profile: true } : { transform: scope }),
    );
    if (values.json) json({ recovery });
    else {
      line(style.green(`resumed ${scope === 'profile' ? 'automatic maintenance' : `${scope} maintenance`}`));
      line(`  ${style.grey(`automatic apply: ${recovery.automaticApply}`)}`);
    }
    return 0;
  }

  if (positionals[0] === 'notify' && positionals.length === 1) {
    if (!values['schedule-health']) {
      throw new AknoError('invalid', 'dream notify requires --schedule-health');
    }
    if (
      values.scheduled ||
      values.phase !== undefined ||
      values.mode !== undefined ||
      values.run !== undefined ||
      values.last !== undefined ||
      values.pending ||
      values['explain-policy'] !== undefined ||
      values['dry-run'] ||
      values['private-details']
    ) {
      throw new AknoError('invalid', 'dream notify --schedule-health cannot be combined with run options');
    }
    return notifyScheduleHealth(values);
  }

  if (positionals[0] === 'status' && positionals.length === 1) {
    if (values['explain-policy'] !== undefined) {
      if (values.run !== undefined || values.last !== undefined || values.pending) {
        throw new AknoError('invalid', 'choose only one of --run, --last, --pending, or --explain-policy');
      }
      const mode = values.mode ? parseMode(values.mode) : undefined;
      const policy = await loadMaintenancePathPolicy(values, values['explain-policy'], mode);
      if (values.json) json({ policy });
      else printMaintenancePathPolicy(policy);
      return 0;
    }
    if (values.mode !== undefined) {
      throw new AknoError('invalid', '--mode is only meaningful with --explain-policy in status');
    }
    const query = dreamStatusQuery(values);
    const status = await loadMaintenanceStatus(values, query);
    const schedule = Object.keys(query).length === 0 ? inspectDreamSchedule(status.latestFullRun) : null;
    if (values.json) json(dreamStatusJson(status, query, schedule));
    else printDreamStatus(status, query, schedule);
    return 0;
  }
  if (
    positionals.length > 0 ||
    values.run ||
    values.last ||
    values.pending ||
    values['schedule-health'] ||
    values.profile ||
    values.transform
  ) {
    line(DREAM_HELP);
    return 1;
  }

  const phase = values.phase ? parsePhase(values.phase) : undefined;
  const mode = values.mode ? parseMode(values.mode) : undefined;
  if (values.scheduled && (phase || mode || values['dry-run'] || values['private-details'])) {
    throw new AknoError('invalid', '--scheduled is only valid for the plain configured full cycle');
  }
  const input = {
    ...(phase ? { phase } : {}),
    ...(mode ? { mode } : {}),
    ...(values['dry-run'] ? { dryRun: true } : {}),
  };

  // Through the service when one is running: it holds the write handle, and the cycle writes.
  // A second request on the same multiplexed connection reads content-free plan state while the
  // model call is pending, so a healthy multi-minute run no longer looks hung.
  const progress = values.json ? null : dreamProgressWriter(Date.now(), phase, mode);
  const commandStartedAt = new Date();
  let report: DreamReport | null = null;
  let busy: AknoError | null = null;
  try {
    report = await runMaintenance(
      'dream',
      input,
      values,
      openOptionsFrom(values),
      (mem) => mem.dream(input),
      { onWait: progress?.update, waitEveryMs: 5_000 },
    );
  } catch (error) {
    const typed = AknoError.from(error);
    if (typed.code !== 'busy') {
      if (values.scheduled) await notifyScheduledFailure(values, typed.code, commandStartedAt);
      throw typed;
    }
    busy = typed;
  } finally {
    progress?.done();
  }

  if (busy) return reportActiveDream(busy, values);
  if (!report) throw new AknoError('internal', 'dream returned no report');

  if (values.scheduled) await notifyScheduledRun(values, report.run);

  if (values.json) {
    json(values['private-details'] ? report : safeDreamReport(report));
    return dreamRunExitCode(report.run);
  }
  return printDream(report, values['private-details']);
}

function parseMaintenanceTransform(value: string): MaintenanceTransform {
  if ((MAINTENANCE_TRANSFORMS as readonly string[]).includes(value)) {
    return value as MaintenanceTransform;
  }
  throw new AknoError('invalid', `--transform must be one of: ${MAINTENANCE_TRANSFORMS.join(', ')}`);
}

async function notifyScheduledRun(
  values: Parameters<typeof openOptionsFrom>[0],
  run: DreamRunReceipt,
): Promise<void> {
  const config = loadConfig(openOptionsFrom(values));
  if (config.maintenance.notifications === 'off') return;
  try {
    const status = await loadMaintenanceStatus(values);
    const history = await loadMaintenanceStatus(values, { last: 10 });
    reportNotificationDelivery(
      deliverMaintenanceNotification(
        config.maintenance.notifications,
        scheduledRunNotification(config.maintenance.notifications, run, status, history.runs),
        config.stateDir,
      ),
    );
  } catch {
    reportNotificationDelivery({ status: 'failed', reason: 'preparation_failed' });
  }
}

async function notifyScheduledFailure(
  values: Parameters<typeof openOptionsFrom>[0],
  errorCode: string,
  startedAt: Date,
): Promise<void> {
  const config = loadConfig(openOptionsFrom(values));
  if (config.maintenance.notifications === 'off') return;
  try {
    const status = await loadMaintenanceStatus(values);
    const latest = status.latestRun;
    if (latest && Date.parse(latest.startedAt) >= startedAt.getTime() - 2_000) {
      const history = await loadMaintenanceStatus(values, { last: 10 });
      reportNotificationDelivery(
        deliverMaintenanceNotification(
          config.maintenance.notifications,
          scheduledRunNotification(config.maintenance.notifications, latest, status, history.runs),
          config.stateDir,
        ),
      );
      return;
    }
  } catch {
    // A failed service may also make status unavailable. The typed command failure is still actionable.
  }
  reportNotificationDelivery(
    deliverMaintenanceNotification(
      config.maintenance.notifications,
      scheduledCommandFailureNotification(config.maintenance.notifications, errorCode, startedAt),
      config.stateDir,
    ),
  );
}

async function notifyScheduleHealth(values: Parameters<typeof openOptionsFrom>[0]): Promise<number> {
  const config = loadConfig(openOptionsFrom(values));
  const status = await loadMaintenanceStatus(values);
  const schedule = inspectDreamSchedule(status.latestFullRun);
  const delivery = deliverMaintenanceNotification(
    config.maintenance.notifications,
    missedCycleNotification(config.maintenance.notifications, schedule),
    config.stateDir,
  );
  if (values.json) json({ notification: delivery, schedule });
  else reportNotificationDelivery(delivery);
  return notificationDeliveryExitCode(delivery);
}

export function notificationDeliveryExitCode(delivery: NotificationDelivery): number {
  return delivery.status === 'failed' ||
    delivery.status === 'unavailable' ||
    delivery.status === 'sent_unrecorded'
    ? 2
    : 0;
}

export function notificationDeliveryMessage(
  delivery: NotificationDelivery,
): { level: 'warning' | 'info'; text: string } | null {
  if (delivery.status === 'failed') {
    return { level: 'warning', text: `notification delivery failed (${delivery.reason})` };
  }
  if (delivery.status === 'unavailable') {
    return { level: 'warning', text: `notification delivery unavailable (${delivery.reason})` };
  }
  if (delivery.status === 'sent_unrecorded') {
    return {
      level: 'warning',
      text: 'local maintenance notification sent but deduplication state was not saved',
    };
  }
  if (delivery.status === 'sent') {
    return { level: 'info', text: 'local maintenance notification sent' };
  }
  return null;
}

function reportNotificationDelivery(delivery: NotificationDelivery): void {
  const message = notificationDeliveryMessage(delivery);
  if (!message) return;
  process.stderr.write(
    message.level === 'warning' ? style.yellow(`${message.text}\n`) : style.grey(`${message.text}\n`),
  );
}

async function loadMaintenancePathPolicy(
  values: Parameters<typeof openOptionsFrom>[0],
  policyPath: string,
  mode?: MaintenanceMode,
): Promise<MaintenancePathPolicy> {
  if (!policyPath.trim()) throw new AknoError('invalid', '--explain-policy requires a path');
  return runMaintenance(
    'plan',
    { action: 'policy', path: policyPath, ...(mode ? { mode } : {}) },
    values,
    openOptionsFrom(values),
    async (mem) => mem.maintenancePolicy(policyPath, mode),
    { writable: false },
  );
}

export function dreamStatusQuery(values: {
  run?: string;
  last?: string;
  pending?: boolean;
}): MaintenanceStatusQuery {
  const selected =
    Number(values.run !== undefined) + Number(values.last !== undefined) + Number(values.pending);
  if (selected > 1) throw new AknoError('invalid', 'choose only one of --run, --last, or --pending');
  if (values.run !== undefined) {
    const runId = values.run.trim();
    if (!runId) throw new AknoError('invalid', '--run requires a run id');
    return { runId };
  }
  if (values.last !== undefined) {
    const last = Number(values.last);
    if (!Number.isInteger(last) || last < 1 || last > 100) {
      throw new AknoError('invalid', '--last must be an integer from 1 to 100');
    }
    return { last };
  }
  return values.pending ? { pending: true } : {};
}

export function dreamStatusJson(
  status: MaintenanceStatus,
  query: MaintenanceStatusQuery,
  schedule: DreamScheduleStatus | null = null,
): unknown {
  if (query.runId) return { run: status.runs[0] ?? null };
  if (query.last !== undefined) return { runs: status.runs };
  if (query.pending) {
    return {
      awaitingHuman: status.awaitingHuman,
      verificationPending: status.verificationPending,
      budgetDeferred: status.budgetDeferred,
      recovery: status.recovery,
      pendingPlans: status.pendingPlans,
    };
  }
  return schedule ? { ...status, schedule } : status;
}

function printDreamStatus(
  status: MaintenanceStatus,
  query: MaintenanceStatusQuery,
  schedule: DreamScheduleStatus | null,
): void {
  if (query.runId) {
    const run = status.runs[0];
    if (!run) throw new AknoError('not_found', `no maintenance run with id ${query.runId}`);
    printDreamRunReceipt(run);
    return;
  }
  if (query.last !== undefined) {
    printDreamRunHistory(status.runs);
    return;
  }
  if (query.pending) {
    printPendingMaintenance(status);
    return;
  }
  printMaintenanceStatus(status);
  if (schedule) printDreamSchedule(schedule);
}

function printDreamSchedule(schedule: DreamScheduleStatus): void {
  heading('Nightly schedule');
  kv([
    ['installed', schedule.installed ? 'yes' : 'no'],
    ['loaded', schedule.loaded === null ? 'unsupported' : schedule.loaded ? 'yes' : 'no'],
    [
      'cadence',
      schedule.hour === null || schedule.minute === null
        ? null
        : `daily at ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')} (${schedule.timezone})`,
    ],
    ['health', scheduleHealthLabel(schedule.health)],
    ['previous expected', schedule.previousExpectedAt],
    ['next expected', schedule.nextExpectedAt],
    [
      'latest full cycle',
      schedule.latestFullRun
        ? `${schedule.latestFullRun.id} · ${schedule.latestFullRun.status} · ${schedule.latestFullRun.startedAt}`
        : null,
    ],
    [
      'missed-cycle check',
      !schedule.missedCycleCheck.installed
        ? 'not installed'
        : schedule.missedCycleCheck.loaded === false
          ? 'installed but not loaded'
          : schedule.missedCycleCheck.hour === null || schedule.missedCycleCheck.minute === null
            ? 'installed schedule is unreadable'
            : `loaded · daily at ${String(schedule.missedCycleCheck.hour).padStart(2, '0')}:${String(
                schedule.missedCycleCheck.minute,
              ).padStart(2, '0')}`,
    ],
  ]);
}

function scheduleHealthLabel(health: DreamScheduleHealth): string {
  switch (health) {
    case 'unsupported':
      return 'launchd status is available on macOS only';
    case 'not_installed':
      return 'not scheduled';
    case 'installed_not_loaded':
      return 'installed but not loaded';
    case 'invalid_schedule':
      return 'installed schedule is unreadable';
    case 'not_due':
      return 'installed after the previous window; not due yet';
    case 'within_window':
      return 'due; still inside the two-hour completion window';
    case 'running':
      return 'full cycle is running';
    case 'on_time':
      return 'healthy';
    case 'last_run_failed':
      return 'latest expected full cycle failed';
    case 'overdue':
      return 'overdue; no full cycle receipt in the expected window';
  }
}

function printDreamRunReceipt(run: DreamRunReceipt): void {
  heading(`Dream run — ${run.status}`);
  kv([
    ['id', run.id],
    ['profile', run.profile],
    ['authority', run.mode],
    ['started', run.startedAt],
    ['finished', run.finishedAt],
    ['duration', run.durationMs === null ? null : ms(run.durationMs)],
    ['error', run.errorCode],
    ['snapshot', run.snapshot.indexRevision.slice(0, 12)],
  ]);
  line('\n  model work');
  kv([
    ['model', run.modelUsage.modelId],
    ['summary', dreamModelUsageSummary(run.modelUsage)],
    ['calls succeeded', `${run.modelUsage.successfulCalls}/${run.modelUsage.calls}`],
    ['calls failed', run.modelUsage.failedCalls],
    ['input tokens', run.modelUsage.inputTokens],
    ['output tokens', run.modelUsage.outputTokens],
    ['total tokens', run.modelUsage.totalTokens],
    ['degraded', dreamModelDegradationSummary(run.degraded)],
  ]);
  for (const stage of run.modelUsage.stages) {
    line(
      `    ${stage.stage.padEnd(13)} ${dreamModelUsageSummary({ ...stage, modelId: run.modelUsage.modelId, stages: [] })}`,
    );
  }
  printSemanticMergeMetrics(run.semanticMerge ?? null);
  printRunVerification(run.verification);
  printConflictRefresh(run.conflictRefresh ?? null);
  printAutoEstimate(run.autoEstimate, run.modelUsage);
  line('\n  outcomes');
  kv([
    ['observations', run.counts.observations],
    ['curated', run.counts.curated],
    ['managed repairs', run.counts.managedItems?.planned ?? 0],
    ['managed holds', run.counts.managedItems?.held ?? 0],
    ['managed suppressed', run.counts.managedItems?.suppressed ?? 0],
    ['guard rejections', run.counts.rejectedByGuard],
    ['adopted', run.counts.adopted],
    ['conflicts', run.counts.conflicts],
    ['links repaired', run.counts.repairedLinks],
    ['warnings', run.counts.warnings],
  ]);
  if (run.budget) {
    line('\n  apply budget');
    kv([
      ['items', `${run.budget.used.items}/${run.budget.limits.maxItems}`],
      ['changed files', `${run.budget.used.filesChanged}/${run.budget.limits.maxFilesChanged}`],
      ['written bytes', `${run.budget.used.bytesWritten}/${run.budget.limits.maxBytesWritten}`],
      ['high-risk items', `${run.budget.used.highRiskItems}/${run.budget.limits.maxHighRiskItems}`],
      ['deferred items', run.budget.deferredItems],
    ]);
  }
  if (run.phases.length > 0) {
    line('\n  phases');
    for (const phase of run.phases) {
      line(
        `    ${phase.phase.padEnd(13)} ${phase.ran ? 'ran' : 'skipped'}  ${style.grey(ms(phase.durationMs))}`,
      );
    }
  }
  if (run.maintenancePlanIds.length > 0) line(`\n  plans    ${run.maintenancePlanIds.join(', ')}`);
  if (run.changeIds.length > 0) line(`  changes  ${run.changeIds.join(', ')}`);
}

function printDreamRunHistory(runs: DreamRunReceipt[]): void {
  if (runs.length === 0) {
    line(style.grey('no durable dream runs'));
    return;
  }
  heading(`${runs.length} dream run${runs.length === 1 ? '' : 's'} — newest first`);
  for (const run of runs) {
    const duration = run.durationMs === null ? '-' : ms(run.durationMs);
    const model =
      run.modelUsage.totalTokens === null
        ? `${run.modelUsage.calls} calls`
        : `${run.modelUsage.totalTokens} tokens`;
    line(
      `  ${style.bold(run.id)}  ${run.status.padEnd(19)} ${run.mode.padEnd(6)} ${run.startedAt}  ${duration}  ${model}`,
    );
  }
}

function printSemanticMergeMetrics(metrics: DreamReport['semanticMerge']): void {
  if (!metrics) return;
  line('\n  semantic merge discovery');
  kv([
    [
      'pages',
      `${metrics.pagesPrepared}/${metrics.pagesConsidered} prepared` +
        (metrics.pagesSkipped > 0 ? ` · ${metrics.pagesSkipped} skipped` : ''),
    ],
    [
      'embeddings',
      `${metrics.embeddingCacheHits} cached · ${metrics.embeddingInputs} model input(s) in ${metrics.embeddingCalls} call(s)`,
    ],
    ['pairs', `${metrics.prefilteredPairs}/${metrics.pairsCompared} passed prefilter`],
    [
      'classifier',
      `${metrics.classifierCacheHits} cached · ${metrics.classifierCalls} call(s) / ${metrics.classifierCandidates} candidate(s)`,
    ],
    ['qualified', metrics.qualifiedPairs],
  ]);
}

function printAutoEstimate(
  estimate: DreamRunReceipt['autoEstimate'],
  measured: DreamRunReceipt['modelUsage'],
): void {
  if (!estimate) return;
  line('\n  autonomous follow-up estimate');
  kv([
    ['initial curator pass', dreamAutoEstimateSummary(estimate)],
    [
      'curator model',
      estimate.modelConfigured
        ? `${estimate.modelId ?? 'configured'} (configured; health not probed)`
        : 'not configured',
    ],
    ["this audit's measured work", dreamModelUsageSummary(measured)],
  ]);
  if (estimate.status === 'estimated') {
    line(`    ${style.grey('Prompt-message tokens use characters/4; output is a hard request ceiling.')}`);
    line(`    ${style.grey('A later auto run replans; retry work and provider pricing are not included.')}`);
  }
}

function printPendingMaintenance(status: MaintenanceStatus): void {
  heading('Pending maintenance');
  kv([
    ['awaiting decisions', status.awaitingHuman],
    ['verification pending', status.verificationPending],
    ['budget deferred', status.budgetDeferred],
    ['nonterminal plans', status.pendingPlans.length],
  ]);
  if (status.pendingPlans.length === 0) {
    line(style.grey('\n  nothing is waiting for a decision, retry, apply, or verification'));
    return;
  }
  for (const plan of status.pendingPlans) {
    const proposed = plan.counts.proposed;
    const verification = plan.counts.verification_pending;
    line(
      `\n  ${style.bold(plan.id)}  ${plan.status}  ${plan.mode}/${plan.phase}` +
        `  ${proposed} proposed · ${verification} verification pending`,
    );
    line(`    ${style.grey(`created ${plan.createdAt}`)}`);
  }
}

async function reportActiveDream(
  error: AknoError,
  values: Parameters<typeof loadMaintenanceStatus>[0] & { json?: boolean },
): Promise<number> {
  const status = await loadMaintenanceStatus(values);
  const requestedId = typeof error.details?.run_id === 'string' ? error.details.run_id : null;
  const reportedStart = typeof error.details?.started_at === 'string' ? error.details.started_at : 'unknown';
  const run = status.latestRun?.id === requestedId ? status.latestRun : null;
  const outcome = run?.status === 'running' ? 'already_running' : 'finished_while_waiting';
  if (values.json) {
    json({ outcome, run_id: requestedId, run });
    return 0;
  }
  heading(outcome === 'already_running' ? 'Dream already running' : 'Dream finished while checking');
  kv([
    ['run', requestedId ?? 'unknown'],
    ['status', run?.status ?? 'unknown'],
    ['started', run?.startedAt ?? reportedStart],
  ]);
  line(style.grey('\n  No second maintenance run was started.'));
  return 0;
}

function printDream(report: DreamReport, privateDetails: boolean): number {
  const readOnly = dreamRunIsReadOnly(report);
  const authorityLabel = readOnly
    ? style.grey(`  (${report.run.dryRun ? 'dry run' : report.run.mode}; no KB writes)`)
    : '';
  heading(`Dream — ${ms(report.durationMs)}${authorityLabel}`);
  kv([
    ['run', report.run.id],
    ['status', report.run.status],
    ['profile', report.run.profile],
    ['authority', report.run.mode],
    ['snapshot', report.run.snapshot.indexRevision.slice(0, 12)],
  ]);
  printRunVerification(report.verification);
  printConflictRefresh(report.conflictRefresh);
  for (const phase of report.phases) {
    const label = phase.ran ? style.green('ran') : style.grey('skipped');
    const detail = phase.skipped ? style.grey(`  ${phase.skipped}`) : style.grey(`  ${ms(phase.durationMs)}`);
    line(`  ${phase.phase.padEnd(13)} ${label}${detail}`);
  }
  printSemanticMergeMetrics(report.semanticMerge);

  if (report.observations.length > 0) {
    const changed = report.observations.filter(
      (entry) => entry.action !== 'unchanged' && entry.action !== 'rejected',
    );
    heading(`${changed.length} inference proposal/result(s)`);
    if (privateDetails) {
      for (const entry of report.observations) {
        const mark =
          entry.action === 'created'
            ? style.green('new    ')
            : entry.action === 'refined'
              ? style.cyan('refined')
              : entry.action === 'would-create' || entry.action === 'would-refine'
                ? style.cyan('planned')
                : entry.action === 'rejected'
                  ? style.yellow('rejected')
                  : style.grey('same   ');
        line(`  ${mark} ${entry.slug}`);
        line(`          ${truncate(entry.pattern, 96)}`);
        line(`          ${style.grey(`evidence: ${entry.evidence.join(', ')}`)}`);
      }
    } else {
      const counts = countBy(report.observations, (entry) => entry.action);
      kv([
        ['created', counts.created ?? 0],
        ['refined', counts.refined ?? 0],
        ['planned', (counts['would-create'] ?? 0) + (counts['would-refine'] ?? 0)],
        ['rejected', counts.rejected ?? 0],
        ['unchanged', counts.unchanged ?? 0],
      ]);
    }
  }

  if (report.curated.length > 0) {
    heading(`${report.curated.length} page curation result(s)`);
    if (privateDetails) {
      for (const entry of report.curated) {
        const mark =
          entry.action === 'updated'
            ? style.green('updated')
            : entry.action === 'would-update'
              ? style.cyan('preview')
              : entry.action === 'rejected'
                ? style.yellow('refused')
                : style.grey('same');
        line(`  ${mark} ${entry.slug}  ${style.grey(entry.mode)}`);
        if (entry.temporal) {
          line(
            `          ${style.grey(
              `${entry.temporal.state} event until ${entry.temporal.until}` +
                `${entry.temporal.archival ? ' · archival' : ''} · ${entry.temporal.source}`,
            )}`,
          );
        }
        for (const issue of entry.issues) line(`          ${style.grey(issue)}`);
        if (entry.splits.length) line(`          ${style.grey(`splits: ${entry.splits.join(', ')}`)}`);
        if (entry.extractions.length) {
          line(`          ${style.grey(`extracts: ${entry.extractions.join(', ')}`)}`);
        }
        if (entry.merges.length) line(`          ${style.grey(`merges: ${entry.merges.join(', ')}`)}`);
      }
    } else {
      const counts = curationCounts(report);
      kv([
        ['updated', counts.updated],
        ['preview', counts.preview],
        ['unchanged', counts.unchanged],
        ['refused', counts.rejected],
      ]);
      for (const guard of curationGuardSummary(report)) {
        line(`  ${style.grey(`guardrail: ${guard.category}`)}  ${guard.pages} page(s)`);
      }
      line(`  ${style.grey('private page names and reasons: rerun with --private-details')}`);
    }
  }

  if (report.managedItems.inspectedMarkers > 0) {
    heading(`${report.managedItems.inspectedMarkers} managed fragment(s) inspected`);
    kv([
      ['valid', report.managedItems.outcomes.valid],
      ['repairable', report.managedItems.outcomes.planned],
      ['held', report.managedItems.outcomes.held],
      ['suppressed', report.managedItems.outcomes.suppressed],
      ['planned pages', report.managedItems.plannedPages],
      ['placement calls', report.managedItems.placement.classifierCalls],
      ['placement cache hits', report.managedItems.placement.cacheHits],
      ['placement kept', report.managedItems.placement.kept],
      ['placement moved', report.managedItems.placement.moved],
      ['placement sections created', report.managedItems.placement.sectionsCreated],
      ['placement uncertain', report.managedItems.placement.uncertain],
      ['placement unavailable', report.managedItems.placement.unavailable],
      ['routing candidates', report.managedItems.routing.candidatesConsidered],
      ['routing calls', report.managedItems.routing.classifierCalls],
      ['routing cache hits', report.managedItems.routing.cacheHits],
      ['cross-page moved', report.managedItems.routing.moved],
      ['routing sections created', report.managedItems.routing.sectionsCreated],
      ['routing deferred', report.managedItems.routing.deferred],
      ['routing uncertain', report.managedItems.routing.uncertain],
      ['routing unavailable', report.managedItems.routing.unavailable],
      ['source calls', report.managedItems.source.classifierCalls],
      ['source cache hits', report.managedItems.source.cacheHits],
      ['source supported', report.managedItems.source.supported],
      ['wording corrected', report.managedItems.source.corrected],
      ['wording uncertain', report.managedItems.source.uncertain],
      ['source unavailable', report.managedItems.source.unavailable],
    ]);
    const actionable = report.managedItems.details.filter((finding) => finding.outcome !== 'valid');
    if (privateDetails) {
      for (const finding of actionable.slice(0, 100)) {
        line(
          `  ${finding.slug}:${finding.line || '?'}  ${style.grey(`${finding.code} · ${finding.outcome}`)}`,
        );
      }
      if (actionable.length > 100) {
        line(`  ${style.grey(`${actionable.length - 100} more private finding(s) omitted`)}`);
      }
    } else if (actionable.length > 0) {
      line(`  ${style.grey('private page locations omitted; rerun with --private-details')}`);
    }
  }

  for (const plan of (report.maintenancePlans ?? []).length > 0
    ? report.maintenancePlans
    : report.maintenancePlan
      ? [report.maintenancePlan]
      : []) {
    heading(`Maintenance plan — ${plan.status}`);
    line(`  ${style.bold(plan.id)}  ${plan.mode}/${plan.phase}  ${style.grey(plan.summary)}`);
    const proposed = plan.items.filter((item) => item.status === 'proposed').length;
    const approved = plan.items.filter((item) => item.status === 'approved').length;
    const dependencyDeferred = plan.items.filter((item) =>
      ['dependency_conflict', 'dependency_unmet'].includes(item.statusCode ?? ''),
    ).length;
    if (dependencyDeferred > 0) {
      line(
        `  ${style.grey(
          plan.status === 'superseded'
            ? `${dependencyDeferred} dependent item(s) were replanned from the post-apply state in this run`
            : `${dependencyDeferred} dependent item(s) deferred; they will be replanned on the next run`,
        )}`,
      );
    }
    const snapshotDeferred = plan.items.filter((item) => item.statusCode === 'snapshot_drift').length;
    if (snapshotDeferred > 0) {
      line(
        `  ${style.grey(`${snapshotDeferred} stale item(s) deferred; they will be replanned on the next run`)}`,
      );
    }
    if (proposed > 0) {
      line(`  ${style.grey('inspect:')} ${style.bold(`akno plan diff ${plan.id}`)}`);
      line(
        `  ${style.grey('decide:')} ${style.bold(`akno plan decide ${plan.id} --item <item_id> --approve`)}`,
      );
    }
    if (approved > 0) line(`  ${style.grey('apply:')} ${style.bold(`akno plan apply ${plan.id}`)}`);
    for (const item of plan.items.filter((entry) => entry.changeId)) {
      const label = privateDetails ? item.subject : item.id;
      line(`  ${style.grey(`${label} undo:`)} ${style.bold(`akno undo ${item.changeId}`)}`);
    }
  }

  if (report.planPrune && (report.planPrune.payloads.plans > 0 || report.planPrune.receipts.plans > 0)) {
    heading('Plan retention');
    kv([
      ['private payloads pruned', report.planPrune.payloads.plans],
      ['private bytes removed', report.planPrune.payloads.privateBytes],
      ['compact receipts removed', report.planPrune.receipts.plans],
    ]);
  }

  printAutoEstimate(report.autoEstimate, report.modelUsage);

  if (report.rejected.length > 0) {
    // A guardrail firing is the tier working. Silence here would make a prompt edit
    // that removed one indistinguishable from a quiet night.
    heading(`${report.rejected.length} refused by a guardrail`);
    if (privateDetails) {
      for (const entry of report.rejected.slice(0, 10)) {
        line(`  ${style.yellow('·')} ${truncate(entry.pattern, 80)}`);
        line(`    ${style.grey(entry.reason)}`);
      }
    } else {
      line(`  ${style.grey('private patterns and reasons omitted; rerun with --private-details')}`);
    }
  }

  if (report.adopted.length > 0) {
    const created = report.adopted.filter((entry) => entry.action === 'created');
    const planned = report.adopted.filter((entry) => entry.action === 'planned');
    const rejected = report.adopted.filter((entry) => entry.action === 'rejected');
    heading(
      `Document adoption — ${created.length} created, ${planned.length} proposed, ${rejected.length} rejected`,
    );
    if (privateDetails) {
      for (const entry of report.adopted) {
        const mark =
          entry.action === 'created'
            ? style.green('page   ')
            : entry.action === 'planned'
              ? style.yellow('plan   ')
              : entry.action === 'rejected'
                ? style.red('refused')
                : style.grey('left   ');
        line(`  ${mark} ${entry.slug}  ${style.grey(entry.files.join(', '))}`);
        if (entry.reason) line(`          ${style.grey(entry.reason)}`);
      }
    } else {
      const counts = countBy(report.adopted, (entry) => entry.action);
      kv([
        ['created', counts.created ?? 0],
        ['proposed', counts.planned ?? 0],
        ['rejected', counts.rejected ?? 0],
        ['left alone', counts.skipped ?? 0],
      ]);
    }
  }

  const actionable = report.conflicts.filter((entry) =>
    ['superseded', 'qualified', 'unresolved', 'unverified'].includes(entry.verdict),
  );
  const cleared = report.conflicts.length - actionable.length;
  if (report.conflicts.length > 0) {
    // A run that examined five candidates and cleared them must not look like a run that
    // found nothing: the second says the pass works, the first says it also judged.
    heading(
      `${report.conflicts.length} conflict candidate(s) — ${actionable.length} need handling` +
        (cleared > 0 ? `, ${cleared} cleared or time-scoped` : ''),
    );
    if (privateDetails) {
      for (const conflict of actionable) {
        const verdict =
          conflict.verdict === 'superseded'
            ? style.red('superseded')
            : style.yellow(conflict.verdict.replaceAll('_', ' '));
        line(`  ${verdict} ${style.bold(`${conflict.subject} / ${conflict.attribute}`)}`);
        for (const claim of conflict.claims) {
          const current = conflict.likelyCurrent === claim.slug ? style.green('  ← likely current') : '';
          line(`    ${style.grey(`${claim.slug}:${claim.line}`)}  ${truncate(claim.claim, 76)}${current}`);
        }
      }
    } else if (actionable.length > 0) {
      line(`  ${style.grey('private claims and source locations omitted; rerun with --private-details')}`);
    }
    if (
      actionable.length > 0 &&
      !(report.maintenancePlans ?? []).some((plan) =>
        plan.items.some((item) => item.kind === 'contradiction'),
      ) &&
      !report.maintenancePlan?.items.some((item) => item.kind === 'contradiction')
    ) {
      line(
        `\n  ${style.grey('no contradiction item was applied; use')} ${style.bold('akno dream --phase curate --mode audit')} ${style.grey('to inspect eligible plans')}`,
      );
    }
  }

  if (report.repaired) {
    const fixed = report.repaired;
    if (fixed.links.length > 0 || fixed.claims.length > 0) {
      const linkActions = countBy(fixed.links, (link) => link.action);
      heading(
        `Broken-link plans — ${linkActions.applied ?? 0} applied, ${linkActions.planned ?? 0} proposed, ${linkActions.rejected ?? 0} rejected`,
      );
      if (privateDetails) {
        for (const link of fixed.links) {
          line(
            `  ${style.grey(link.from)}  [[${link.brokenTarget}]] ${style.green('→')} [[${link.newTarget}]]` +
              style.grey(`  (${link.signal.replace('_', ' ')}, ${link.action})`),
          );
        }
        for (const claim of fixed.claims) {
          // Both sides, because this rewrote a sentence in the owner's own notes.
          line(
            `  ${style.grey(`${claim.slug}:${claim.line}`)}  superseded by ${style.grey(claim.supersededBy)}`,
          );
          line(`    ${style.red('was')}  ${truncate(claim.before, 72)}`);
          line(`    ${style.green('now')}  ${truncate(claim.after, 72)}`);
        }
      } else {
        line(`  ${style.grey('private paths and before/after text omitted; rerun with --private-details')}`);
      }
      if (report.repairChangeId) {
        line(
          `\n  ${style.grey('all of it undoes together:')} ${style.bold(`akno undo ${report.repairChangeId}`)}`,
        );
      }
    }
    if (fixed.declined.length > 0) {
      // What it would not plan, and why. A planner that skips silently looks like a broken one.
      heading(`${fixed.declined.length} left alone`);
      if (privateDetails) {
        for (const entry of fixed.declined.slice(0, 10)) {
          line(`  ${style.grey(truncate(entry.what, 60))}  ${entry.reason}`);
          if (entry.candidates?.length) {
            line(`    ${style.grey(`candidates: ${entry.candidates.join(', ')}`)}`);
          }
        }
        if (fixed.declined.length > 10) line(`  ${style.grey(`… and ${fixed.declined.length - 10} more`)}`);
      } else {
        line(`  ${style.grey('private targets and reasons omitted; rerun with --private-details')}`);
      }
    }
  }

  if (report.housekeeping) {
    const house = report.housekeeping;
    heading('Housekeeping');
    kv([
      ['broken links', housekeepingCount(house.counts.brokenLinks, house.planBacked.brokenLinks)],
      [
        'orphaned documents',
        housekeepingCount(house.counts.orphanedDocuments, house.planBacked.orphanedDocuments),
      ],
      ['pages off their rules', housekeepingCount(house.counts.drift, house.planBacked.drift)],
      ['rule repairs', ruleRepairSummary(house.ruleRepairs)],
      ['graph review candidates', house.counts.graphCandidates],
    ]);
    if (privateDetails) {
      for (const entry of house.orphanedDocuments.slice(0, 5)) {
        line(`  ${style.yellow('·')} ${entry.relPath}`);
        line(`    ${style.grey(entry.reason)}`);
        if (entry.plan) line(`    ${style.grey(housekeepingPlanLabel(entry.plan))}`);
      }
      for (const entry of house.drift.slice(0, 5)) {
        line(
          `  ${style.yellow('·')} ${entry.slug}  ${style.grey(`${entry.rule} expects ${entry.expected}, found ${entry.found}`)}`,
        );
        if (entry.plan) line(`    ${style.grey(housekeepingPlanLabel(entry.plan))}`);
        line(`    ${style.grey(`${entry.repair.status}/${entry.repair.code}: ${entry.repair.reason}`)}`);
      }
      if (house.brokenLinks.length > 0) {
        for (const link of house.brokenLinks.slice(0, 5)) {
          const plan = link.plan ? ` · ${housekeepingPlanLabel(link.plan)}` : '';
          line(`  ${style.grey(`${link.from} → ${link.to}${plan}`)}`);
        }
      }
      for (const entry of house.graphCandidates.slice(0, 5)) {
        line(`  ${style.yellow('·')} [${entry.kind}] ${entry.subject}`);
        line(`    ${style.grey(entry.reason)}`);
        if (entry.related.length > 0) {
          line(`    ${style.grey(`related: ${entry.related.join(', ')}`)}`);
        }
      }
    }
  }

  if (report.warnings.length > 0) {
    heading(`${report.warnings.length} warning(s)`);
    if (privateDetails) {
      for (const warning of report.warnings.slice(0, 10)) line(`  ${style.yellow('·')} ${warning}`);
    } else {
      line(`  ${style.grey('private warning details omitted; rerun with --private-details')}`);
    }
  }

  // Said out loud rather than left to be discovered: the flag that turns this on is the one
  // that puts a record of private inferences on disk, and a run should say where it went.
  if (report.logPath) {
    line(
      `\n  ${style.grey(
        privateDetails ? `this run was written to ${report.logPath}` : 'a private run log was written',
      )}`,
    );
  }

  for (const [what, id] of [
    ['the observations', report.changeId],
    ['the pages it wrote for documents', report.adoptChangeId],
  ] as const) {
    // Two changes rather than one: undoing a night's inferences should not also undo the pages
    // that made documents searchable, and the other way round.
    if (id) line(`\n  ${style.grey(`reverse ${what} with`)} ${style.bold(`akno undo ${id}`)}`);
  }
  return dreamRunExitCode(report.run);
}

export function dreamRunExitCode(run: DreamRunReceipt): number {
  return run.status === 'failed' ? 1 : 0;
}

function housekeepingCount(total: number, planBacked: number): string | number {
  return planBacked > 0 ? `${total} (${planBacked} plan-backed)` : total;
}

function housekeepingPlanLabel(plan: HousekeepingPlanRef): string {
  const deferred = plan.statusCode ? ` · ${plan.statusCode}` : '';
  return `plan ${plan.planId}/${plan.itemId} · ${plan.policy}/${plan.status}${deferred}`;
}

function ruleRepairSummary(counts: NonNullable<DreamReport['housekeeping']>['ruleRepairs']): string {
  return `${counts.planBacked} planned · ${counts.ready} ready · ${counts.held} held · ${counts.reportOnly} report-only`;
}

function printRunVerification(verification: DreamRunReceipt['verification']): void {
  if (!verification) return;
  line('\n  run verification');
  kv([
    ['status', verification.status],
    ['applied items', verification.appliedItems],
    ['affected files', verification.affectedFiles],
    ['unattributed files', verification.unattributedFiles ?? 'not recorded'],
    ['item receipts', verification.checks.appliedItems],
    ['affected paths', verification.checks.affectedPaths],
    ['whole snapshot', verification.checks.wholeSnapshot],
    ['budget accounting', verification.checks.budget],
    ['model accounting', verification.checks.modelUsage],
  ]);
  for (const issue of verification.issues) {
    line(`    ${style.grey(`${issue.code}: ${issue.count}`)}`);
  }
}

function printConflictRefresh(refresh: DreamReport['conflictRefresh']): void {
  if (!refresh) return;
  line('\n  changed-claim refresh');
  kv([
    ['status', refresh.status],
    ['cause', refresh.cause],
    ['changed files', refresh.changedFiles],
    ['knowledge pages', refresh.knowledgePages],
    ['current pages', refresh.currentPages],
    ['stale pages', refresh.stalePages],
    ['conflicts', refresh.candidates],
    ['unverified', refresh.unverified],
  ]);
}

export function dreamRunIsReadOnly(report: Pick<DreamReport, 'run'>): boolean {
  return report.run.dryRun || report.run.mode === 'audit' || report.run.mode === 'review';
}

interface GuardrailSummary {
  category: string;
  pages: number;
  issues: number;
}

function curationCounts(report: DreamReport): {
  updated: number;
  preview: number;
  unchanged: number;
  rejected: number;
} {
  const counts = countBy(report.curated, (entry) => entry.action);
  return {
    updated: counts.updated ?? 0,
    preview: counts['would-update'] ?? 0,
    unchanged: counts.unchanged ?? 0,
    rejected: counts.rejected ?? 0,
  };
}

export function curationGuardSummary(report: DreamReport): GuardrailSummary[] {
  const categories = new Map<string, { pages: Set<string>; issues: number }>();
  for (const entry of report.curated) {
    for (const category of new Set(entry.issues.map(guardrailCategory))) {
      const current = categories.get(category) ?? { pages: new Set<string>(), issues: 0 };
      current.pages.add(entry.slug);
      current.issues += entry.issues.filter((issue) => guardrailCategory(issue) === category).length;
      categories.set(category, current);
    }
  }
  return [...categories]
    .map(([category, value]) => ({ category, pages: value.pages.size, issues: value.issues }))
    .sort((left, right) => right.pages - left.pages || left.category.localeCompare(right.category));
}

function guardrailCategory(issue: string): string {
  if (/numeric\/date\/value|source body line/i.test(issue)) return 'value preservation';
  if (/wikilink|markdown link|external url|link target/i.test(issue)) return 'link integrity';
  if (/stable item|provenance|marker/i.test(issue)) return 'provenance preservation';
  if (/unresolved|conflict/i.test(issue)) return 'conflict preservation';
  if (/evidence/i.test(issue)) return 'evidence relevance';
  if (/archiv|post-event/i.test(issue)) return 'archival materiality';
  if (/extract|destination|source page/i.test(issue)) return 'extraction safety';
  if (/cosmetic|material|heading|structur|format|size/i.test(issue)) return 'materiality';
  if (/timeout|provider|transport|model|json|schema/i.test(issue)) return 'model response';
  return 'other safety check';
}

/** A content-free JSON receipt suitable for CI logs and support bundles. */
export function safeDreamReport(report: DreamReport): Record<string, unknown> {
  const observations = countBy(report.observations, (entry) => entry.action);
  const adopted = countBy(report.adopted, (entry) => entry.action);
  const conflicts = countBy(report.conflicts, (entry) => entry.verdict);
  return {
    run: report.run,
    durationMs: report.durationMs,
    phases: report.phases.map((phase) => ({
      phase: phase.phase,
      ran: phase.ran,
      skipped: phase.skipped !== undefined,
      durationMs: phase.durationMs,
    })),
    observations: {
      total: report.observations.length,
      created: observations.created ?? 0,
      refined: observations.refined ?? 0,
      planned: (observations['would-create'] ?? 0) + (observations['would-refine'] ?? 0),
      rejected: observations.rejected ?? 0,
      unchanged: observations.unchanged ?? 0,
    },
    curation: {
      total: report.curated.length,
      ...curationCounts(report),
      guardrails: curationGuardSummary(report),
    },
    managedItems: safeManagedItemReport(report.managedItems),
    semanticMerge: report.semanticMerge,
    verification: report.verification,
    conflictRefresh: report.conflictRefresh,
    maintenancePlan: report.maintenancePlan ? safeMaintenancePlan(report.maintenancePlan) : null,
    maintenancePlans: (report.maintenancePlans ?? []).map(safeMaintenancePlan),
    planPrune: report.planPrune,
    rejectedByGuard: report.rejected.length,
    adopted: {
      total: report.adopted.length,
      created: adopted.created ?? 0,
      planned: adopted.planned ?? 0,
      rejected: adopted.rejected ?? 0,
      skipped: adopted.skipped ?? 0,
    },
    conflicts: {
      total: report.conflicts.length,
      superseded: conflicts.superseded ?? 0,
      qualified: conflicts.qualified ?? 0,
      unresolved: conflicts.unresolved ?? 0,
      timeScoped: conflicts.time_scoped ?? 0,
      unverified: conflicts.unverified ?? 0,
      notAConflict: conflicts.not_a_conflict ?? 0,
    },
    repair: report.repaired
      ? {
          links: report.repaired.links.length,
          linkActions: countBy(report.repaired.links, (link) => link.action),
          claims: report.repaired.claims.length,
          declined: report.repaired.declined.length,
        }
      : null,
    housekeeping: report.housekeeping
      ? {
          counts: report.housekeeping.counts,
          planBacked: report.housekeeping.planBacked,
          ruleRepairs: report.housekeeping.ruleRepairs,
        }
      : null,
    warnings: report.warnings.length,
    changes: {
      observations: report.changeId,
      adopted: report.adoptChangeId,
      curated: report.curateChangeId,
      repaired: report.repairChangeId,
    },
    privateLogWritten: report.logPath !== undefined,
  };
}

function safeManagedItemReport(report: DreamReport['managedItems']): Record<string, unknown> {
  const { details: _details, ...safe } = report;
  return safe;
}

function safeMaintenancePlan(plan: DreamReport['maintenancePlans'][number]): Record<string, unknown> {
  return {
    id: plan.id,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    mode: plan.mode,
    phase: plan.phase,
    status: plan.status,
    payloadPrunedAt: plan.payloadPrunedAt,
    fingerprint: plan.fingerprint,
    counts: plan.counts,
    items: plan.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      policy: item.policy,
      risk: item.risk,
      componentCount: item.componentCount,
      status: item.status,
      statusCode: item.statusCode,
      decision: item.decision
        ? { actor: item.decision.actor, outcome: item.decision.outcome, at: item.decision.at }
        : null,
      changeId: item.changeId,
      verification: item.verification ? { status: item.verification.status, at: item.verification.at } : null,
    })),
  };
}

function countBy<T, K extends string>(values: T[], key: (value: T) => K): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const value of values) {
    const name = key(value);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

function dreamProgressWriter(
  startedAt: number,
  phase: ReturnType<typeof parsePhase> | undefined,
  mode: MaintenanceMode | undefined,
): {
  update: (update: MaintenanceWaitUpdate) => void;
  done: () => void;
} {
  let lastStage = '';
  let lastWrittenAt = Number.NEGATIVE_INFINITY;
  let visible = false;
  const tty = process.stderr.isTTY;
  const update = (wait: MaintenanceWaitUpdate): void => {
    const progress = dreamProgressDescription(wait, startedAt, phase, mode);
    if (!tty && progress.stage === lastStage && wait.elapsedMs - lastWrittenAt < 30_000) return;
    const message = `${progress.stage} · ${ms(wait.elapsedMs)} · ${progress.writeState}`;
    if (tty) process.stderr.write(`\r\u001b[2K${style.grey(message)}`);
    else process.stderr.write(`${message}\n`);
    visible = true;
    lastStage = progress.stage;
    lastWrittenAt = wait.elapsedMs;
  };
  return {
    update,
    done: () => {
      if (tty && visible) process.stderr.write('\r\u001b[2K');
    },
  };
}

export function dreamProgressDescription(
  wait: MaintenanceWaitUpdate,
  startedAt: number,
  phase: ReturnType<typeof parsePhase> | undefined,
  mode: MaintenanceMode | undefined,
): { stage: string; writeState: string } {
  const latest = relevantProgressPlan(wait.status, startedAt, mode);
  if (!latest) {
    return {
      stage: phase === 'curate' ? 'curate: planning candidates' : 'dream: running phases',
      writeState:
        mode === 'audit'
          ? 'audit mode; KB writes disabled'
          : phase === 'curate'
            ? 'KB write not started'
            : 'write state will be reported at completion',
    };
  }

  const stage =
    latest.status === 'deciding'
      ? 'curate: independent curator'
      : latest.status === 'applying' || latest.status === 'approved'
        ? 'curate: applying approved items'
        : latest.status === 'partially_completed'
          ? 'curate: verifying or recovering'
          : latest.status === 'ready' || latest.status === 'awaiting_review'
            ? 'curate: plan ready for review'
            : latest.status === 'completed'
              ? 'curate: plan completed'
              : `curate: plan ${latest.status}`;
  const applied = latest.counts.applied;
  const writeState =
    applied > 0
      ? `${applied} item(s) written and verified`
      : latest.status === 'applying' || latest.status === 'partially_completed'
        ? 'KB write or verification in progress'
        : latest.mode === 'audit' || latest.mode === 'review'
          ? `${latest.mode} mode; KB write not started`
          : 'KB write not started';
  return { stage, writeState };
}

function relevantProgressPlan(
  status: MaintenanceStatus | null,
  startedAt: number,
  mode: MaintenanceMode | undefined,
): MaintenanceStatus['latest'] {
  const latest = status?.latest;
  if (!latest || (mode && latest.mode !== mode)) return null;
  const unfinished = !['completed', 'failed', 'superseded'].includes(latest.status);
  const createdDuringRun = Date.parse(latest.createdAt) >= startedAt - 2_000;
  return unfinished || createdDuringRun ? latest : null;
}

function parseMode(value: string): MaintenanceMode {
  if (value === 'audit' || value === 'review' || value === 'auto') return value;
  throw new AknoError('invalid', `unknown maintenance mode '${value}' — expected audit, review or auto`);
}
