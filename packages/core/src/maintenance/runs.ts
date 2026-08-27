import { AknoError, type ErrorCode } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import type { MaintenanceProfile, ResolvedModelRole } from '../config/schema.ts';
import { newPrefixedId, sha256 } from '../store/ids.ts';
import { SCHEMA_VERSION } from '../store/migrations.ts';
import type { DreamConflictRefreshReceipt, DreamPhase, DreamReport, PhaseReport } from './dream.ts';
import type { MaintenanceMode } from './plans.ts';
import type { MaintenanceBudgetReceipt } from './budget.ts';
import {
  emptyDreamModelUsage,
  type DreamModelDegradation,
  type DreamModelUsageReceipt,
} from './model-telemetry.ts';
import type { SemanticMergeDiscoveryMetrics } from './semantic-merge-discovery.ts';
import type { DreamRunVerificationReceipt } from './run-verification.ts';

export type DreamRunStatus = 'running' | 'completed' | 'partially_completed' | 'awaiting_review' | 'failed';

/** `legacy` is read-only history; new runs write only a MaintenanceMode. */
export type DreamRunMode = MaintenanceMode | 'legacy';
export type DreamRunProfile = MaintenanceProfile | 'legacy-custom';

/**
 * Content-free identity of the indexed state a dream run began against.
 *
 * This is deliberately a manifest, not a claim that every current planner is isolated from
 * writes made by an earlier phase. It makes that future boundary measurable: once planners are
 * separated from apply, every item can point at this exact revision and configuration.
 */
export interface DreamSnapshotManifest {
  capturedAt: string;
  schemaVersion: number;
  /** Changes when indexed rows or their indexing timestamps change. */
  indexRevision: string;
  /** Changes only when the indexed knowledge-base path/hash set changes. */
  knowledgeBaseFingerprint: string;
  configurationFingerprint: string;
  indexedFiles: number;
  requestedPhases: DreamPhase[];
  plannerVersion: string;
  modelId: string | null;
}

export interface DreamRunCounts {
  observations: number;
  curated: number;
  /** Aggregate owned-fragment outcomes; absent only on receipts written before this counter shipped. */
  managedItems?: { planned: number; held: number; valid: number; suppressed: number };
  rejectedByGuard: number;
  adopted: number;
  conflicts: number;
  repairedLinks: number;
  warnings: number;
}

/** Content-safe estimate derived from sealed audit items; never provider-reported usage. */
export interface DreamAutoEstimate {
  status: 'estimated' | 'not_configured' | 'no_sealed_plan';
  scope: 'initial_curator_pass';
  modelId: string | null;
  modelConfigured: boolean;
  /** One candidate request per proposed item whose configured policy is auto. */
  curatorCalls: number | null;
  /** Prompt text only, using the repository-wide characters/4 heuristic. */
  estimatedPromptTokens: number | null;
  /** Hard request output caps summed across the candidate calls, not expected usage. */
  maximumOutputTokens: number | null;
  method: 'characters_div_4' | null;
  postApplyRetryIncluded: false;
}

/** A durable, content-safe lifecycle receipt. Exact proposals remain in maintenance plans. */
export interface DreamRunReceipt {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: DreamRunStatus;
  /** Configured profile at the start of the run; historical compatibility runs are labelled. */
  profile: DreamRunProfile;
  mode: DreamRunMode;
  dryRun: boolean;
  requestedPhase: DreamPhase | null;
  snapshot: DreamSnapshotManifest;
  phases: { phase: DreamPhase; ran: boolean; skipped: boolean; durationMs: number }[];
  counts: DreamRunCounts;
  /** Content-safe cumulative apply usage; null only on receipts written before run budgets shipped. */
  budget: MaintenanceBudgetReceipt | null;
  /** Exact logical model calls and provider-reported tokens; prompts and responses are never retained. */
  modelUsage: DreamModelUsageReceipt;
  /** Typed capability failures grouped by phase or curator stage. */
  degraded: DreamModelDegradation[];
  /** Aggregate candidate-discovery counts; null on runs where semantic merge discovery did not run. */
  semanticMerge?: SemanticMergeDiscoveryMetrics | null;
  /** Final deterministic postconditions and receipt-accounting result; null on old or failed-start runs. */
  verification: DreamRunVerificationReceipt | null;
  /** Post-write changed-fact derivation and conflict eligibility proof; null on historical runs. */
  conflictRefresh?: DreamConflictRefreshReceipt | null;
  /** Present on completed audit runs; null on non-audit and historical runs. */
  autoEstimate?: DreamAutoEstimate | null;
  durationMs: number | null;
  maintenancePlanIds: string[];
  /** Most recently touched plan, retained for older clients. */
  maintenancePlanId: string | null;
  changeIds: string[];
  errorCode: ErrorCode | null;
  /** False only for an explicitly read-only in-process dry run. */
  persisted: boolean;
}

interface ReceiptRow {
  receipt: string;
}

interface ActiveRunRow extends ReceiptRow {
  id: string;
  started_at: string;
}

/**
 * Process-local ownership complements the durable `running` row. The repository already
 * guarantees one writer process per knowledge base; this set distinguishes a live invocation
 * in that writer from a row left behind by its predecessor.
 */
const ownedRunIds = new Set<string>();

export function beginDreamRun(
  ctx: AknoContext,
  options: {
    requestedPhase: DreamPhase | null;
    requestedPhases: DreamPhase[];
    mode: DreamRunMode;
    dryRun: boolean;
    modelId: string | null;
  },
): DreamRunReceipt {
  const startedAt = new Date().toISOString();
  const persisted = ctx.writable && runsTableAvailable(ctx);
  if (persisted) {
    recoverInterruptedDreamRuns(ctx);
    const active = activeRunRows(ctx).find((row) => ownedRunIds.has(row.id));
    if (active) {
      throw new AknoError('busy', `dream run ${active.id} is already active`, {
        run_id: active.id,
        started_at: active.started_at,
      });
    }
  }
  const receipt: DreamRunReceipt = {
    id: newPrefixedId('run'),
    startedAt,
    finishedAt: null,
    status: 'running',
    profile: ctx.config.maintenance.profile,
    mode: options.mode,
    dryRun: options.dryRun,
    requestedPhase: options.requestedPhase,
    snapshot: captureMaintenanceSnapshot(ctx, options.requestedPhases, options.modelId, startedAt),
    phases: [],
    counts: emptyCounts(),
    budget: emptyBudget(ctx),
    modelUsage: emptyDreamModelUsage(options.modelId),
    degraded: [],
    semanticMerge: null,
    verification: null,
    conflictRefresh: null,
    autoEstimate: null,
    durationMs: null,
    maintenancePlanIds: [],
    maintenancePlanId: null,
    changeIds: [],
    errorCode: null,
    persisted,
  };

  if (persisted) {
    ctx.store.db
      .prepare(
        `INSERT INTO maintenance_runs (id, started_at, finished_at, status, receipt, error_code)
         VALUES (?, ?, NULL, 'running', ?, NULL)`,
      )
      .run(receipt.id, startedAt, JSON.stringify(receipt));
    ownedRunIds.add(receipt.id);
  }
  return receipt;
}

export function completeDreamRun(
  ctx: AknoContext,
  started: DreamRunReceipt,
  report: DreamReport,
): DreamRunReceipt {
  const finishedAt = new Date().toISOString();
  const plans =
    report.maintenancePlans.length > 0
      ? report.maintenancePlans
      : report.maintenancePlan
        ? [report.maintenancePlan]
        : [];
  const receipt: DreamRunReceipt = {
    ...started,
    finishedAt,
    status: completedStatus(report),
    phases: safePhases(report.phases),
    counts: reportCounts(report),
    budget: report.budget,
    modelUsage: report.modelUsage,
    degraded: report.degraded,
    semanticMerge: report.semanticMerge,
    verification: report.verification,
    conflictRefresh: report.conflictRefresh,
    autoEstimate: report.autoEstimate ?? null,
    durationMs: report.durationMs,
    maintenancePlanIds: plans.map((plan) => plan.id),
    maintenancePlanId: plans.at(-1)?.id ?? null,
    changeIds: [report.changeId, report.adoptChangeId, report.curateChangeId]
      .filter((id): id is string => id !== null)
      .concat(
        plans.flatMap((plan) =>
          plan.items.map((item) => item.changeId).filter((id): id is string => id !== null),
        ),
      )
      .filter((id, index, all) => all.indexOf(id) === index),
  };
  persistFinished(ctx, receipt);
  return receipt;
}

export function failDreamRun(
  ctx: AknoContext,
  started: DreamRunReceipt,
  error: unknown,
  durationMs: number,
  phases: PhaseReport[],
  budget: MaintenanceBudgetReceipt = started.budget ?? emptyBudget(ctx),
  operability: Pick<DreamRunReceipt, 'modelUsage' | 'degraded' | 'semanticMerge'> = started,
): DreamRunReceipt {
  const receipt: DreamRunReceipt = {
    ...started,
    finishedAt: new Date().toISOString(),
    status: 'failed',
    phases: safePhases(phases),
    budget,
    modelUsage: operability.modelUsage,
    degraded: operability.degraded,
    semanticMerge: operability.semanticMerge ?? null,
    durationMs,
    errorCode: error instanceof AknoError ? error.code : 'internal',
  };
  persistFinished(ctx, receipt);
  return receipt;
}

export function latestDreamRun(ctx: AknoContext): DreamRunReceipt | null {
  return listDreamRuns(ctx, 1)[0] ?? null;
}

/** Latest complete-cycle attempt; phase-specific diagnostics do not mask nightly health. */
export function latestFullDreamRun(ctx: AknoContext): DreamRunReceipt | null {
  if (!runsTableAvailable(ctx)) return null;
  const rows = ctx.store.db
    .prepare('SELECT receipt FROM maintenance_runs ORDER BY rowid DESC')
    .iterate() as Iterable<ReceiptRow>;
  for (const row of rows) {
    const receipt = parseReceipt(row.receipt);
    if (receipt?.requestedPhase === null) return receipt;
  }
  return null;
}

/** Content-safe durable receipts, newest first. */
export function listDreamRuns(ctx: AknoContext, limit = 10): DreamRunReceipt[] {
  if (!runsTableAvailable(ctx)) return [];
  const requested = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;
  const bounded = Math.min(100, requested);
  const rows = ctx.store.db
    .prepare('SELECT receipt FROM maintenance_runs ORDER BY rowid DESC LIMIT ?')
    .all(bounded) as ReceiptRow[];
  return rows.flatMap((row) => {
    const receipt = parseReceipt(row.receipt);
    return receipt ? [receipt] : [];
  });
}

/** One content-safe durable receipt by id. */
export function getDreamRun(ctx: AknoContext, runId: string): DreamRunReceipt {
  if (!runsTableAvailable(ctx)) {
    throw new AknoError('not_found', `no maintenance run with id ${runId}`);
  }
  const row = ctx.store.db.prepare('SELECT receipt FROM maintenance_runs WHERE id = ?').get(runId) as
    ReceiptRow | undefined;
  if (!row) throw new AknoError('not_found', `no maintenance run with id ${runId}`);
  const receipt = parseReceipt(row.receipt);
  if (!receipt) throw new AknoError('internal', `maintenance run ${runId} has an invalid receipt`);
  return receipt;
}

/**
 * Finalize rows owned by a process that no longer exists.
 *
 * Called when a writable Akno opens and again immediately before a run begins. A live run in
 * this process stays in `ownedRunIds`; every other `running` row is necessarily abandoned because
 * no second process can hold the write handle.
 */
export function recoverInterruptedDreamRuns(ctx: AknoContext): DreamRunReceipt[] {
  if (!ctx.writable || !runsTableAvailable(ctx)) return [];
  const recovered: DreamRunReceipt[] = [];
  const finishedAt = new Date().toISOString();
  for (const row of activeRunRows(ctx)) {
    if (ownedRunIds.has(row.id)) continue;
    const started = parseReceipt(row.receipt);
    if (!started) {
      ctx.store.db
        .prepare(
          `UPDATE maintenance_runs
              SET finished_at = ?, status = 'failed', error_code = 'interrupted'
            WHERE id = ? AND status = 'running'`,
        )
        .run(finishedAt, row.id);
      continue;
    }
    const startedMs = Date.parse(started.startedAt);
    const finishedMs = Date.parse(finishedAt);
    const receipt: DreamRunReceipt = {
      ...started,
      finishedAt,
      status: 'failed',
      durationMs:
        Number.isFinite(startedMs) && Number.isFinite(finishedMs)
          ? Math.max(0, finishedMs - startedMs)
          : started.durationMs,
      errorCode: 'interrupted',
    };
    ctx.store.db
      .prepare(
        `UPDATE maintenance_runs
            SET finished_at = ?, status = 'failed', receipt = ?, error_code = 'interrupted'
          WHERE id = ? AND status = 'running'`,
      )
      .run(finishedAt, JSON.stringify(receipt), row.id);
    recovered.push(receipt);
  }
  return recovered;
}

export function activeDreamRuns(ctx: AknoContext): number {
  if (!runsTableAvailable(ctx)) return 0;
  const row = ctx.store.db
    .prepare("SELECT count(*) AS n FROM maintenance_runs WHERE status = 'running'")
    .get() as { n: number };
  return row.n;
}

/** Capture the content-free read boundary used by a run or a document-scoped maintenance action. */
export function captureMaintenanceSnapshot(
  ctx: AknoContext,
  requestedPhases: DreamPhase[],
  modelId: string | null,
  capturedAt = new Date().toISOString(),
): DreamSnapshotManifest {
  const rows = ctx.store.db
    .prepare('SELECT rel_path, sha256, indexed_at FROM files ORDER BY rel_path')
    .all() as { rel_path: string; sha256: string; indexed_at: string }[];
  const knowledgeState = rows.map((row) => [row.rel_path, row.sha256]);
  const indexState = rows.map((row) => [row.rel_path, row.sha256, row.indexed_at]);
  return {
    capturedAt,
    schemaVersion: SCHEMA_VERSION,
    indexRevision: sha256(JSON.stringify({ schema: SCHEMA_VERSION, files: indexState })),
    knowledgeBaseFingerprint: sha256(JSON.stringify(knowledgeState)),
    configurationFingerprint: configurationFingerprint(ctx),
    indexedFiles: rows.length,
    requestedPhases: [...requestedPhases],
    plannerVersion: 'dream-lifecycle-v2',
    modelId,
  };
}

function configurationFingerprint(ctx: AknoContext): string {
  const config = ctx.config;
  // Paths, provider credentials, header values, and free-form config source locations are not
  // receipt data. Policies and role behavior still participate in the opaque fingerprint.
  const effective = {
    maintenance: {
      profile: config.maintenance.profile,
      retain: config.maintenance.retain,
      observe: config.maintenance.observe,
      reflect: config.maintenance.reflect,
      curate: config.maintenance.curate,
      adopt: config.maintenance.adopt,
      conflicts: config.maintenance.conflicts,
      repair: config.maintenance.repair,
      policies: config.maintenance.policies,
      limits: config.maintenance.limits,
      maxRevisionAttempts: config.maintenance.maxRevisionAttempts,
      model: roleFingerprint(config.maintenance.model),
    },
    models: {
      derive: roleFingerprint(config.models.derive),
      embedding: roleFingerprint(config.models.embedding),
    },
    rules: config.rules.map(({ source: _source, ...rule }) => rule),
    writeIds: config.writeIds,
    pageExtensions: config.pageExtensions,
  };
  return sha256(JSON.stringify(effective));
}

function roleFingerprint(role: ResolvedModelRole | null): Record<string, unknown> | null {
  if (!role) return null;
  return {
    role: role.role,
    id: role.id,
    enabled: role.enabled,
    requested: role.requested,
    timeoutMs: role.timeoutMs,
    maxOutputTokens: role.maxOutputTokens,
    concurrency: role.concurrency,
    reasoningEffort: role.reasoningEffort,
    provider: role.provider
      ? {
          name: role.provider.name,
          baseUrl: role.provider.baseUrl,
          api: role.provider.api,
          maxRetries: role.provider.maxRetries,
          headerNames: Object.keys(role.provider.headers).sort(),
        }
      : null,
  };
}

function completedStatus(report: DreamReport): DreamRunStatus {
  const plans =
    report.maintenancePlans.length > 0
      ? report.maintenancePlans
      : report.maintenancePlan
        ? [report.maintenancePlan]
        : [];
  if (report.verification?.status === 'failed') return 'failed';
  if (plans.some((plan) => plan.status === 'awaiting_review')) {
    return 'awaiting_review';
  }
  const failed = plans.filter((plan) => plan.status === 'failed');
  if (failed.length > 0) {
    const onlyRetryableDeferrals = failed.every(
      (plan) =>
        plan.items.some((item) =>
          ['dependency_conflict', 'dependency_unmet', 'snapshot_drift'].includes(item.statusCode ?? ''),
        ) &&
        plan.items.every(
          (item) =>
            !['blocked', 'stale', 'verification_failed'].includes(item.status) ||
            (item.status === 'blocked' &&
              ['dependency_conflict', 'dependency_unmet'].includes(item.statusCode ?? '')) ||
            (item.status === 'stale' && item.statusCode === 'snapshot_drift'),
        ),
    );
    return onlyRetryableDeferrals ? 'partially_completed' : 'failed';
  }
  if (plans.some((plan) => plan.status === 'partially_completed')) return 'partially_completed';
  if (report.conflictRefresh?.status === 'degraded') return 'partially_completed';
  return 'completed';
}

function reportCounts(report: DreamReport): DreamRunCounts {
  return {
    observations: report.observations.length,
    curated: report.curated.length,
    managedItems: { ...report.managedItems.outcomes },
    rejectedByGuard: report.rejected.length,
    adopted: report.adopted.length,
    conflicts: report.conflicts.length,
    repairedLinks: report.repaired?.links.length ?? 0,
    warnings: report.warnings.length,
  };
}

function emptyCounts(): DreamRunCounts {
  return {
    observations: 0,
    curated: 0,
    managedItems: { planned: 0, held: 0, valid: 0, suppressed: 0 },
    rejectedByGuard: 0,
    adopted: 0,
    conflicts: 0,
    repairedLinks: 0,
    warnings: 0,
  };
}

function emptyBudget(ctx: AknoContext): MaintenanceBudgetReceipt {
  return {
    limits: { ...ctx.config.maintenance.limits },
    used: { items: 0, filesChanged: 0, bytesWritten: 0, highRiskItems: 0 },
    deferredItems: 0,
  };
}

function safePhases(phases: PhaseReport[]): DreamRunReceipt['phases'] {
  return phases.map((phase) => ({
    phase: phase.phase,
    ran: phase.ran,
    skipped: phase.skipped !== undefined,
    durationMs: phase.durationMs,
  }));
}

function persistFinished(ctx: AknoContext, receipt: DreamRunReceipt): void {
  if (!receipt.persisted) return;
  try {
    ctx.store.db
      .prepare(
        `UPDATE maintenance_runs
            SET finished_at = ?, status = ?, receipt = ?, error_code = ?
          WHERE id = ?`,
      )
      .run(receipt.finishedAt, receipt.status, JSON.stringify(receipt), receipt.errorCode, receipt.id);
  } finally {
    ownedRunIds.delete(receipt.id);
  }
}

function activeRunRows(ctx: AknoContext): ActiveRunRow[] {
  return ctx.store.db
    .prepare(
      `SELECT id, started_at, receipt FROM maintenance_runs
        WHERE status = 'running' ORDER BY rowid`,
    )
    .all() as ActiveRunRow[];
}

function parseReceipt(value: string): DreamRunReceipt | null {
  try {
    const receipt = JSON.parse(value) as Omit<DreamRunReceipt, 'profile'> & {
      profile?: MaintenanceProfile | 'custom' | 'legacy-custom';
      maintenancePlanIds?: unknown;
    };
    return {
      ...receipt,
      profile:
        receipt.profile === 'audit' ||
        receipt.profile === 'review' ||
        receipt.profile === 'autonomous' ||
        receipt.profile === 'legacy-custom'
          ? receipt.profile
          : 'legacy-custom',
      budget: receipt.budget ?? null,
      modelUsage: receipt.modelUsage ?? emptyDreamModelUsage(receipt.snapshot.modelId),
      degraded: Array.isArray(receipt.degraded) ? receipt.degraded : [],
      semanticMerge: receipt.semanticMerge ?? null,
      verification: receipt.verification ?? null,
      conflictRefresh: receipt.conflictRefresh ?? null,
      autoEstimate: receipt.autoEstimate ?? null,
      maintenancePlanIds: Array.isArray(receipt.maintenancePlanIds)
        ? receipt.maintenancePlanIds.filter((id): id is string => typeof id === 'string')
        : receipt.maintenancePlanId
          ? [receipt.maintenancePlanId]
          : [],
    };
  } catch {
    return null;
  }
}

function runsTableAvailable(ctx: AknoContext): boolean {
  const row = ctx.store.db
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'maintenance_runs'")
    .get() as { present: number } | undefined;
  return row?.present === 1;
}
