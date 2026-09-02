import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext, DeriveScheduler } from '../context.ts';
import type { MaintenancePolicy, MaintenanceTransform } from '../config/schema.ts';
import { AknoError } from '@tenphi/akno-protocol';
import type { ChangeFile } from '../write/journal.ts';
import { normalizeSlug } from '../ops/write.ts';
import { sha256 } from '../store/ids.ts';
import { rebuildEvidenceGraph } from '../index/graph.ts';
import {
  mergeTopLevelStringArray,
  serializeYamlString,
  serializeYamlStringArray,
} from '../kb/frontmatter.ts';
import { runObserveMission, type ObservationCandidate } from './observe.ts';
import { planBrokenLinks, type BrokenLinkDraft, type LinkRepair, type RepairResult } from './link-repairs.ts';
import {
  claimKey,
  findCrossPageConflicts,
  ineligibleConflictClaims,
  verifyConflicts,
  type CrossPageConflict,
} from './conflicts.ts';
import { planContradictions } from './contradictions.ts';
import { housekeeping, type Housekeeping } from './housekeeping.ts';
import { ModelClient } from '../models/client.ts';
import { planOrphanAdoptions, type AdoptedDocument } from './adopt.ts';
import { addedLines, logDreamRun, type AppliedChange } from './log.ts';
import { curatePages, type CurateDraft, type CuratedPage, type CurateTransformationKind } from './curate.ts';
import {
  addSemanticMergeDiscoveryMetrics,
  type SemanticMergeDiscoveryMetrics,
} from './semantic-merge-discovery.ts';
import {
  applyMaintenancePlan,
  blockMaintenanceDependencies,
  createAdoptionPlan,
  createCurationPlan,
  createObservationPlan,
  createReflectionPlan,
  decideMaintenancePlanWithCurator,
  estimateAuditAutoCuratorWork,
  deferUnmetMaintenanceDependency,
  deferStaleMaintenanceItems,
  finalizeRetryableMaintenancePlans,
  findActiveMaintenancePlan,
  getMaintenancePlan,
  maintenanceItemApplySchedule,
  pruneMaintenancePlans,
  supersedeDependencyMaintenancePlan,
  type MaintenanceItem,
  type MaintenanceMode,
  type MaintenancePlan,
  type MaintenancePlanPruneResult,
  type MaintenancePlanSummary,
  type ObservationPlanDraft,
} from './plans.ts';
import { pruneRetainEvidence, type RetainEvidencePruneResult } from '../write/retain-supports.ts';
import {
  beginDreamRun,
  completeDreamRun,
  dreamRunFileManifest,
  dreamRunIndexRevisionMatches,
  failDreamRun,
  refreshDreamRunSnapshot,
  type DreamRunReceipt,
} from './runs.ts';
import {
  assertMaintenanceModeAllowed,
  effectiveTransformPolicy,
  highestPolicyMode,
  policyMode,
  profileMode,
} from './profile.ts';
import {
  createMaintenanceBudget,
  maintenanceBudgetReceipt,
  type MaintenanceBudgetReceipt,
  type MaintenanceBudgetTracker,
} from './budget.ts';
import {
  DreamModelTelemetry,
  type DreamModelDegradation,
  type DreamModelStage,
  type DreamModelUsageReceipt,
} from './model-telemetry.ts';
import { verifyDreamRun, type DreamRunVerificationReceipt } from './run-verification.ts';
import { Indexer } from '../index/indexer.ts';
import type { IndexRevisionBarrier } from '../index/revision-barrier.ts';
import { planManagedItems, type ManagedItemReport } from './managed-items.ts';
import { planRuleDrifts, ruleDriftPaths, type RuleDriftDraft } from './rule-drift.ts';
import {
  independentProofGroups,
  insertObservationBlock,
  observationBlock,
  observationId,
  observationMarkerIndexes,
  renderObservationMarker,
  replaceObservationBlock,
  type ObservationEvidenceLocator,
} from '../observations/marker.ts';
import {
  liveObservationProofGroups,
  markerFromProjection,
  proofGroupsForFact,
} from '../observations/projection.ts';
import {
  assertProfileAutomaticApplyAvailable,
  configWithMaintenanceRecovery,
  maintenanceRecoveryStatus,
  recordMaintenanceRecovery,
} from './recovery.ts';
export type { CuratedPage } from './curate.ts';

/**
 * The maintenance cycle: three tiers, each with a configurable mission.
 *
 * ```
 * retain    Keep only long-term facts, decisions, preferences, proven experience.
 *    ↓
 * observe   Combine repeated facts into stable patterns and habits. Never restate the facts.
 *    ↓
 * reflect   Build behavioural models, decision principles, long-term strategy.
 * ```
 *
 * `retain` is not run from here. It is available **per-turn**, as the `remember` op, so the
 * tier that needs to be fresh does not wait for a timer; a cycle that also re-ran it would be
 * curating a conversation nobody is having.
 *
 * **Phases are independent and each is safe to re-run.** That is a real constraint, not a
 * nicety — a maintenance pass is the one thing that runs unattended, so a second run must not
 * duplicate the first. Observations are matched by their pattern before being written, and
 * every mutation is journalled and either append-only or plan-backed.
 */

export type DreamPhase = 'observe' | 'reflect' | 'curate' | 'adopt' | 'conflicts' | 'repair' | 'housekeeping';

/**
 * Order matters twice.
 *
 * `conflicts` runs first because unresolved knowledge must be filtered before observation,
 * reflection, or synthesis sees it. The retention ladder remains a user-facing hierarchy, not
 * permission for a disputed claim to influence a higher tier before inspection.
 *
 * `housekeeping` runs last, so its report describes the knowledge base after plan-backed curation and
 * adoption. Broken-link planning queries the complete structural index directly; it never consumes the
 * housekeeping list, which is capped for readability.
 */
export const DREAM_PHASES: DreamPhase[] = [
  'conflicts',
  'observe',
  'reflect',
  'curate',
  'adopt',
  'repair',
  'housekeeping',
];

const CURATE_POLICY_KINDS: Exclude<MaintenanceTransform, 'observe' | 'reflect' | 'adopt'>[] = [
  'hygiene',
  'managed_item',
  'synthesis',
  'split',
  'extract',
  'merge',
  'contradiction',
  'broken_link',
  'rule_drift',
];

export interface ObservationWritten {
  slug: string;
  pattern: string;
  evidence: string[];
  action:
    | 'created'
    | 'reinforced'
    | 'refined'
    | 'weakened'
    | 'retracted'
    | 'split'
    | 'would-create'
    | 'would-reinforce'
    | 'would-refine'
    | 'would-weaken'
    | 'would-retract'
    | 'would-split'
    | 'rejected'
    | 'unchanged';
}

export interface PhaseReport {
  phase: DreamPhase;
  ran: boolean;
  /** Why a phase did not run — disabled, or missing what it needs. */
  skipped?: string;
  durationMs: number;
}

export interface DreamMaintenancePlan extends MaintenancePlanSummary {
  /** Decision and outcome metadata only; exact private bytes are fetched explicitly with `plan()`. */
  items: Pick<
    MaintenanceItem,
    | 'id'
    | 'kind'
    | 'policy'
    | 'risk'
    | 'componentCount'
    | 'subject'
    | 'status'
    | 'statusCode'
    | 'decision'
    | 'statusReason'
    | 'changeId'
    | 'verification'
  >[];
}

export interface DreamReport {
  /** Durable, content-safe identity and outcome for this complete invocation. */
  run: DreamRunReceipt;
  phases: PhaseReport[];
  observations: ObservationWritten[];
  curated: CuratedPage[];
  /** Aggregate inspection and repair outcomes for Akno-owned inline fragments. */
  managedItems: ManagedItemReport;
  /** Candidates a guardrail refused, with the guard that refused them. */
  rejected: { pattern: string; reason: string }[];
  /** Documents given a page of their own, and any that were left alone. */
  adopted: AdoptedDocument[];
  conflicts: CrossPageConflict[];
  /** Broken-link plan outcomes and findings that had no safe applicable target. */
  repaired: RepairResult | null;
  /** @deprecated Direct repair writes were retired; link item change ids live on the plan. */
  repairChangeId: string | null;
  housekeeping: Housekeeping | null;
  /** @deprecated One legacy inference change, or one plan-backed inference item for compatibility. */
  changeId: string | null;
  /** The `adopt` phase's compatibility change id, kept apart from observations. */
  adoptChangeId: string | null;
  curateChangeId: string | null;
  /** Most recently touched sealed maintenance plan, retained for older single-plan callers. */
  maintenancePlan: DreamMaintenancePlan | null;
  /** Every phase-specific plan touched by this run. */
  maintenancePlans: DreamMaintenancePlan[];
  /** Content-safe receipt for configured terminal-plan retention. */
  planPrune: MaintenancePlanPruneResult | null;
  /** Content-safe receipt for dependency-aware private retain-frame pruning. */
  retainEvidencePrune: RetainEvidencePruneResult | null;
  /** Cumulative apply limits and usage shared by plan-backed phases in this invocation. */
  budget: MaintenanceBudgetReceipt;
  /** Exact logical calls and provider-reported tokens for synchronous maintenance model work. */
  modelUsage: DreamModelUsageReceipt;
  /** Typed model capability failures; no prompts, responses, paths, or excerpts. */
  degraded: DreamModelDegradation[];
  /** Aggregate semantic merge discovery work; null when that candidate source did not run. */
  semanticMerge: SemanticMergeDiscoveryMetrics | null;
  /** Final content-safe postcondition and accounting check for the complete invocation. */
  verification: DreamRunVerificationReceipt | null;
  /** Proof that facts changed by this run no longer use pre-write conflict eligibility. */
  conflictRefresh: DreamConflictRefreshReceipt | null;
  /** Initial curator-pass estimate derived from sealed audit items, when configured auto exists. */
  autoEstimate?: DreamRunReceipt['autoEstimate'];
  warnings: string[];
  durationMs: number;
  /** Where the run was written down, when `maintenance.log_changes` is on. */
  logPath?: string;
}

export interface DreamConflictRefreshReceipt {
  status: 'not_needed' | 'passed' | 'degraded';
  cause: 'no_claim_changes' | 'conflicts_disabled' | 'facts_disabled' | null;
  /** Changed paths queued by successful maintenance items; paths themselves are never retained. */
  changedFiles: number;
  knowledgePages: number;
  currentPages: number;
  stalePages: number;
  candidates: number;
  unverified: number;
  checkedAt: string;
}

export interface DreamOptions {
  /** One phase instead of every enabled one. */
  phase?: DreamPhase;
  /** Report what would be written without touching disk. */
  dryRun?: boolean;
  /** Authority policy for a durable observe, reflect, curate, or adopt plan. */
  mode?: MaintenanceMode;
}

export async function dream(ctx: AknoContext, options: DreamOptions = {}): Promise<DreamReport> {
  if (options.mode && options.dryRun) {
    throw new AknoError('invalid', 'choose `mode: audit` instead of combining a mode with dryRun');
  }
  assertMaintenanceModeAllowed(ctx.config, options);
  const started = performance.now();
  // The tiers run unattended and are worth a better model than indexing needs — measured:
  // the same observe pass over one knowledge base produced 15 candidates worth about four with a
  // local 3B, and 8 candidates with no guard violations at all with a strong one. When
  // `maintenance.model` is set, the whole cycle uses it and nothing else does.
  const baseCycleModel = ctx.config.maintenance.model
    ? new ModelClient(ctx.config.maintenance.model)
    : ctx.models.derive;
  const telemetry = new DreamModelTelemetry(baseCycleModel.modelId);
  let modelStage: DreamModelStage = options.phase ?? 'conflicts';
  const pendingDerivation = new QueuedDeriveScheduler();
  const runMode = dreamRunMode(ctx, options);
  const recovery = maintenanceRecoveryStatus(ctx);
  const cycle: AknoContext = {
    ...ctx,
    config: configWithMaintenanceRecovery(ctx.config, recovery, runMode),
    models: {
      ...ctx.models,
      derive: baseCycleModel.withOutcomeObserver((observation) => telemetry.observe(modelStage, observation)),
    },
    // A maintenance write still indexes structure before it is verified. Hold its expensive
    // follow-up until every planned write has landed, so changed facts can be re-derived and
    // reclassified once, synchronously, before this run certifies its outcome.
    derive: pendingDerivation,
  };
  const wanted = options.phase ? [options.phase] : DREAM_PHASES;
  const startedRun = beginDreamRun(cycle, {
    requestedPhase: options.phase ?? null,
    requestedPhases: wanted,
    mode: runMode,
    dryRun: options.dryRun ?? false,
    modelId: cycle.models.derive.modelId,
  });
  const report: DreamReport = {
    run: startedRun,
    phases: [],
    observations: [],
    curated: [],
    managedItems: {
      eligiblePages: 0,
      inspectedMarkers: 0,
      plannedPages: 0,
      suppressedPages: 0,
      findings: {
        empty_marker: 0,
        malformed_marker: 0,
        duplicate_item: 0,
        misplaced_item: 0,
        placement_uncertain: 0,
        placement_unavailable: 0,
        section_created: 0,
        misrouted_item: 0,
        routing_deferred: 0,
        routing_uncertain: 0,
        routing_unavailable: 0,
        wording_corrected: 0,
        wording_uncertain: 0,
        source_unavailable: 0,
        item_conflict: 0,
        valid: 0,
      },
      outcomes: { planned: 0, held: 0, valid: 0, suppressed: 0 },
      placement: {
        pagesConsidered: 0,
        classifierCalls: 0,
        cacheHits: 0,
        kept: 0,
        moved: 0,
        sectionsCreated: 0,
        uncertain: 0,
        unavailable: 0,
      },
      routing: {
        pagesConsidered: 0,
        itemsConsidered: 0,
        candidatesConsidered: 0,
        classifierCalls: 0,
        cacheHits: 0,
        kept: 0,
        moved: 0,
        sectionsCreated: 0,
        deferred: 0,
        uncertain: 0,
        unavailable: 0,
      },
      source: {
        pagesConsidered: 0,
        classifierCalls: 0,
        cacheHits: 0,
        supported: 0,
        corrected: 0,
        uncertain: 0,
        unavailable: 0,
      },
      details: [],
    },
    rejected: [],
    adopted: [],
    conflicts: [],
    repaired: null,
    repairChangeId: null,
    housekeeping: null,
    changeId: null,
    adoptChangeId: null,
    curateChangeId: null,
    maintenancePlan: null,
    maintenancePlans: [],
    planPrune: null,
    retainEvidencePrune: null,
    budget: maintenanceBudgetReceipt(createMaintenanceBudget(ctx.config.maintenance.limits)),
    modelUsage: telemetry.usage(),
    degraded: telemetry.degradation(),
    semanticMerge: null,
    verification: null,
    conflictRefresh: null,
    autoEstimate: null,
    warnings: [],
    durationMs: 0,
  };
  // An unfinished plan may span several invocations. Its old journal ids remain valuable plan
  // history, but they are not evidence that this invocation wrote those files. Snapshot the
  // boundary before recovery, planning, or apply can assign another id.
  const previousMaintenanceChanges = storedMaintenanceChanges(cycle);
  for (const entry of recovery.transforms.filter((candidate) => candidate.pausedAt !== null)) {
    report.warnings.push(
      `automatic ${entry.transform} maintenance is paused after ${entry.consecutiveFailures} consecutive verification rollbacks; resume it explicitly after inspection`,
    );
  }

  // Collected whether or not anything reads it, because the phases are where the information
  // is and threading it out conditionally is how a debugging flag ends up logging half a run.
  const applied: AppliedChange[] = [];
  const budget = createMaintenanceBudget(ctx.config.maintenance.limits);
  const deferAutomaticApply = !options.phase && !options.dryRun;
  const lastWritablePlanner = Math.max(
    ...(['observe', 'reflect', 'curate', 'adopt'] as DreamPhase[]).map((phase) => wanted.lastIndexOf(phase)),
  );
  let plannerBarrier: IndexRevisionBarrier | null = null;
  const releasePlannerBarrier = async (): Promise<void> => {
    if (!plannerBarrier) return;
    const barrier = plannerBarrier;
    let revisionMatches = false;
    let invalidated = false;
    try {
      revisionMatches = dreamRunIndexRevisionMatches(ctx, startedRun);
    } finally {
      plannerBarrier = null;
      invalidated = (await barrier.release()).invalidated;
    }
    if (invalidated) {
      // A foreground mutation has already won and structurally indexed. Recheck the exact
      // sealed inputs so affected proposals become typed stale work; unrelated proposals may be
      // reused by a fresh run, but this mixed-revision invocation never reaches a curator.
      await deferStaleMaintenanceItems(
        cycle,
        report.maintenancePlans.map((plan) => plan.id),
      );
      throw new AknoError(
        'conflict',
        'a foreground memory write changed the indexed revision during dream planning; nothing was applied',
        { retryable: true },
      );
    }
    if (!revisionMatches) {
      throw new AknoError('internal', 'the indexed revision changed inside the dream planner barrier');
    }
  };

  try {
    assertProfileAutomaticApplyAvailable(recovery, runMode);
    if (!options.phase && ctx.writable) {
      plannerBarrier = await ctx.indexer.acquireRevisionBarrier();
      // `beginDreamRun` claims exclusivity before waiting for an in-flight index pass. Once the
      // barrier owns the lane, this becomes the exact revision every full-run planner reads.
      refreshDreamRunSnapshot(ctx, startedRun);
    }
    if (cycle.writable) finalizeRetryableMaintenancePlans(cycle);
    // A selected inference or curation phase still gets the same safety boundary as a full run.
    // It does not add a second visible phase to the report; it supplies that phase's prerequisites.
    if (
      options.phase &&
      options.phase !== 'conflicts' &&
      ['observe', 'reflect', 'curate'].includes(options.phase) &&
      cycle.config.maintenance.conflicts.enabled
    ) {
      modelStage = 'conflicts';
      await inspectConflicts(cycle, report, telemetry);
    }
    for (const [phaseIndex, phase] of wanted.entries()) {
      modelStage = phase;
      const phaseStarted = performance.now();
      const skipped = await runPhase(
        cycle,
        phase,
        options,
        report,
        applied,
        budget,
        deferAutomaticApply,
        telemetry,
      );
      report.phases.push({
        phase,
        ran: skipped === null,
        ...(skipped ? { skipped } : {}),
        durationMs: Math.round(performance.now() - phaseStarted),
      });
      if (plannerBarrier?.invalidated) await releasePlannerBarrier();
      if (deferAutomaticApply && phaseIndex === lastWritablePlanner) {
        await releasePlannerBarrier();
        await decideAndApplyPlannedPhases(cycle, report, applied, budget, telemetry);
        await retryDependencyDeferredPhases(cycle, options, report, applied, budget, telemetry, (stage) => {
          modelStage = stage;
        });
        modelStage = 'conflicts';
        report.conflictRefresh = await refreshChangedClaimEligibility(
          cycle,
          pendingDerivation,
          report,
          telemetry,
        );
      }
    }

    await releasePlannerBarrier();

    if (!deferAutomaticApply) {
      modelStage = 'conflicts';
      report.conflictRefresh = await refreshChangedClaimEligibility(
        cycle,
        pendingDerivation,
        report,
        telemetry,
      );
    }

    report.budget = maintenanceBudgetReceipt(budget);
    report.modelUsage = telemetry.usage();
    report.degraded = telemetry.degradation();
    const runChangeIds = currentDreamChangeIds(report, previousMaintenanceChanges);
    scopeCompatibilityChangeIds(report, new Set(runChangeIds));
    report.verification = await verifyDreamRun(
      cycle,
      report.maintenancePlans.map((plan) => plan.id),
      runChangeIds,
      budget,
      report.budget,
      report.modelUsage,
      dreamRunFileManifest(startedRun),
    );
    report.autoEstimate =
      report.run.mode === 'audit'
        ? estimateAuditAutoCuratorWork(
            cycle,
            report.maintenancePlans.map((plan) => plan.id),
            { sealedPlans: !report.run.dryRun },
          )
        : null;
    report.durationMs = Math.round(performance.now() - started);
    recordMaintenanceRecovery(cycle, {
      runId: startedRun.id,
      mode: runMode,
      planIds: report.maintenancePlans.map((plan) => plan.id),
      verification: report.verification,
    });
    report.planPrune = pruneMaintenancePlans(cycle, {
      apply: cycle.writable && !(options.dryRun ?? false),
    });
    report.retainEvidencePrune = pruneRetainEvidence(cycle, {
      apply: cycle.writable && !(options.dryRun ?? false),
    });
    if (report.planPrune.applied && report.planPrune.payloads.plans > 0) {
      for (const planned of [...report.maintenancePlans]) {
        try {
          recordMaintenancePlan(report, getMaintenancePlan(cycle, planned.id));
        } catch (error) {
          if (AknoError.from(error).code !== 'not_found') throw error;
          // A zero-day compact receipt window deliberately removes even this run's terminal
          // plan. The run receipt still records its id and the pruning receipt explains why.
        }
      }
    }

    if (ctx.config.maintenance.logChanges) {
      const logPath = await logDreamRun(ctx, report, applied, {
        dryRun: options.dryRun ?? false,
        changeIds: runChangeIds,
      });
      if (logPath) report.logPath = logPath;
    }
    report.run = completeDreamRun(ctx, startedRun, report, runChangeIds);
    // Any non-knowledge work, conflicts-disabled work, or failed derivation resumes through the
    // ordinary post-response worker only after the run has sealed its observed final state.
    ctx.derive.schedule(pendingDerivation.take());
    return report;
  } catch (error) {
    try {
      await releasePlannerBarrier();
    } catch {
      // The original failure remains the run error. Releasing the in-process lane is mandatory;
      // queued index callers keep their own typed outcome and final tree verification did not run.
    }
    // A valid write must not lose its ordinary background indexing merely because a later
    // planner or final verifier failed before the changed-claim barrier could consume it.
    ctx.derive.schedule(pendingDerivation.take());
    report.durationMs = Math.round(performance.now() - started);
    report.budget = maintenanceBudgetReceipt(budget);
    report.modelUsage = telemetry.usage();
    report.degraded = telemetry.degradation();
    report.run = failDreamRun(
      ctx,
      startedRun,
      error,
      report.durationMs,
      report.phases,
      report.budget,
      report,
    );
    try {
      recordMaintenanceRecovery(cycle, {
        runId: startedRun.id,
        mode: runMode,
        planIds: report.maintenancePlans.map((plan) => plan.id),
        verification: report.verification,
      });
    } catch {
      // Preserve the original lifecycle error. A store that cannot retain recovery state is
      // already surfaced by that failure and must not replace its more specific cause.
    }
    throw error;
  }
}

interface MaintenanceChangeBoundary {
  byItem: Map<string, string | null>;
  ids: Set<string>;
}

function storedMaintenanceChanges(ctx: AknoContext): MaintenanceChangeBoundary {
  const rows = ctx.store.db.prepare('SELECT id, change_id FROM maintenance_items').all() as {
    id: string;
    change_id: string | null;
  }[];
  return {
    byItem: new Map(rows.map((row) => [row.id, row.change_id])),
    ids: new Set(rows.flatMap((row) => (row.change_id === null ? [] : [row.change_id]))),
  };
}

function currentDreamChangeIds(report: DreamReport, previous: MaintenanceChangeBoundary): string[] {
  const plans =
    report.maintenancePlans.length > 0
      ? report.maintenancePlans
      : report.maintenancePlan
        ? [report.maintenancePlan]
        : [];
  return [
    ...[report.changeId, report.adoptChangeId, report.curateChangeId].filter(
      (id): id is string => id !== null && !previous.ids.has(id),
    ),
    ...plans.flatMap((plan) =>
      plan.items.flatMap((item) =>
        item.changeId !== null && previous.byItem.get(item.id) !== item.changeId ? [item.changeId] : [],
      ),
    ),
  ].filter((id, index, all) => all.indexOf(id) === index);
}

function scopeCompatibilityChangeIds(report: DreamReport, current: ReadonlySet<string>): void {
  for (const field of ['changeId', 'adoptChangeId', 'curateChangeId'] as const) {
    const changeId = report[field];
    if (changeId !== null && !current.has(changeId)) report[field] = null;
  }
}

/** Collect paths without starting the ordinary post-response worker. */
class QueuedDeriveScheduler implements DeriveScheduler {
  readonly #paths = new Set<string>();

  schedule(relPaths: string[]): void {
    for (const relPath of relPaths) this.#paths.add(relPath);
  }

  async flush(): Promise<void> {
    // Deliberately idle: `dream` owns the barrier and drains the queue explicitly.
  }

  take(): string[] {
    const paths = [...this.#paths];
    this.#paths.clear();
    return paths;
  }
}

/**
 * Re-derive facts changed by successful maintenance writes and rebuild conflict eligibility.
 *
 * Structural indexing deliberately leaves a changed page's previous `derived_hash` in place.
 * That mismatch is the durable stale marker: until a complete fact derivation succeeds, readers
 * must exclude the page's old facts rather than treating pre-write claims as current evidence.
 */
async function refreshChangedClaimEligibility(
  ctx: AknoContext,
  pending: QueuedDeriveScheduler,
  report: DreamReport,
  telemetry: DreamModelTelemetry,
): Promise<DreamConflictRefreshReceipt> {
  const paths = pending.take();
  const checkedAt = new Date().toISOString();
  if (paths.length === 0) {
    return emptyConflictRefresh('no_claim_changes', checkedAt);
  }

  const pages = livePagesForPaths(ctx, paths);
  const knowledge = pages.filter((page) => page.role === 'knowledge');
  if (knowledge.length === 0) {
    pending.schedule(paths);
    return {
      ...emptyConflictRefresh('no_claim_changes', checkedAt),
      changedFiles: paths.length,
    };
  }

  if (!ctx.config.maintenance.conflicts.enabled) {
    pending.schedule(paths);
    return {
      ...emptyConflictRefresh('conflicts_disabled', checkedAt),
      changedFiles: paths.length,
      knowledgePages: knowledge.length,
    };
  }

  if (!ctx.config.index.facts) {
    // The structural pass has already rebuilt the graph. With fact mining disabled there is no
    // changed claim set to derive; summaries may still finish through the ordinary worker.
    await inspectConflicts(ctx, report, telemetry);
    pending.schedule(paths);
    return {
      status: 'passed',
      cause: 'facts_disabled',
      changedFiles: paths.length,
      knowledgePages: knowledge.length,
      currentPages: 0,
      stalePages: 0,
      candidates: report.conflicts.length,
      unverified: report.conflicts.filter((conflict) => conflict.verdict === 'unverified').length,
      checkedAt,
    };
  }

  if (!ctx.models.derive.available) {
    telemetry.degrade('conflicts', ctx.models.derive.degradedReason({}), 'unavailable');
  } else {
    try {
      const indexer = new Indexer(ctx.config, ctx.store, {
        embedding: ctx.models.embedding,
        derive: ctx.models.derive,
      });
      await indexer.run({ only: paths, modelPaths: paths, reindexUnchanged: true });
    } catch (error) {
      // Preserve the ordinary retry path for infrastructure failures. Semantic model failures
      // return an index report instead and are represented by the stale hash below.
      pending.schedule(paths);
      throw error;
    }
  }

  const refreshed = livePagesForPaths(ctx, paths).filter((page) => page.role === 'knowledge');
  const current = refreshed.filter((page) => page.derived_hash === page.body_hash);
  const stale = refreshed.length - current.length;
  if (stale > 0 && ctx.models.derive.available) {
    telemetry.degrade('conflicts', 'derive_failed');
  }
  if (stale > 0) {
    pending.schedule(
      ctx.models.derive.available
        ? refreshed.filter((page) => page.derived_hash !== page.body_hash).map((page) => page.rel_path)
        : paths,
    );
  }

  // This replaces the pre-write report as well as rebuilding the graph. New claim fingerprints
  // naturally miss old cached verdicts, while unchanged fingerprints may safely reuse them.
  await inspectConflicts(ctx, report, telemetry);
  const unverified = report.conflicts.filter((conflict) => conflict.verdict === 'unverified').length;
  return {
    status: stale > 0 || (ctx.config.maintenance.conflicts.verify && unverified > 0) ? 'degraded' : 'passed',
    cause: null,
    changedFiles: paths.length,
    knowledgePages: refreshed.length,
    currentPages: current.length,
    stalePages: stale,
    candidates: report.conflicts.length,
    unverified,
    checkedAt,
  };
}

function emptyConflictRefresh(
  cause: Exclude<DreamConflictRefreshReceipt['cause'], null>,
  checkedAt: string,
): DreamConflictRefreshReceipt {
  return {
    status: 'not_needed',
    cause,
    changedFiles: 0,
    knowledgePages: 0,
    currentPages: 0,
    stalePages: 0,
    candidates: 0,
    unverified: 0,
    checkedAt,
  };
}

function livePagesForPaths(
  ctx: AknoContext,
  paths: string[],
): { rel_path: string; role: string; body_hash: string; derived_hash: string | null }[] {
  if (paths.length === 0) return [];
  return ctx.store.db
    .prepare(
      `SELECT rel_path, role, body_hash, derived_hash FROM pages
        WHERE rel_path IN (${paths.map(() => '?').join(',')})`,
    )
    .all(...paths) as {
    rel_path: string;
    role: string;
    body_hash: string;
    derived_hash: string | null;
  }[];
}

function dreamRunMode(ctx: AknoContext, options: DreamOptions): MaintenanceMode {
  if (options.dryRun) return 'audit';
  if (options.mode) return options.mode;
  return profileMode(ctx.config.maintenance.profile);
}

function curationPolicies(
  ctx: AknoContext,
  options: DreamOptions,
): Record<Exclude<MaintenanceTransform, 'observe' | 'reflect' | 'adopt'>, MaintenancePolicy> {
  return Object.fromEntries(
    CURATE_POLICY_KINDS.map((kind) => {
      const effective = effectiveTransformPolicy(ctx.config, kind, options.mode);
      return [kind, policyMode(effective) ?? 'off'];
    }),
  ) as Record<Exclude<MaintenanceTransform, 'observe' | 'reflect' | 'adopt'>, MaintenancePolicy>;
}

function planMatchesPolicies(
  plan: MaintenancePlan,
  policies: Partial<Record<MaintenanceTransform, MaintenancePolicy>>,
): boolean {
  return plan.items.every((item) => item.policy === policies[item.kind]);
}

async function runPhase(
  ctx: AknoContext,
  phase: DreamPhase,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
  budget: MaintenanceBudgetTracker,
  deferAutomaticApply: boolean,
  telemetry: DreamModelTelemetry,
): Promise<string | null> {
  switch (phase) {
    case 'observe': {
      if (!ctx.config.maintenance.observe.enabled) return 'disabled in config';
      if (!policyMode(effectiveTransformPolicy(ctx.config, 'observe', options.mode))) {
        return 'observe policy is off';
      }
      if (!ctx.models.derive.available) {
        telemetry.degrade('observe', ctx.models.derive.degradedReason({}), 'unavailable');
        return `no model for the cycle: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`;
      }
      await observePhase(ctx, options, report, applied, budget, deferAutomaticApply, telemetry);
      return null;
    }
    case 'reflect': {
      // Reflect ships as an extension point, off by default. At a few hundred pages a
      // "pattern" is one coincidence away from noise, so the default is not a placeholder —
      // it is the recommendation.
      if (!ctx.config.maintenance.reflect.enabled) {
        return 'off by default — enable it once the knowledge base has the volume for it';
      }
      if (!policyMode(effectiveTransformPolicy(ctx.config, 'reflect', options.mode))) {
        return 'reflect policy is off';
      }
      if (!ctx.models.derive.available) {
        telemetry.degrade('reflect', ctx.models.derive.degradedReason({}), 'unavailable');
        return `no model for the cycle: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`;
      }
      await reflectPhase(ctx, options, report, applied, budget, deferAutomaticApply, telemetry);
      return null;
    }
    case 'curate': {
      const policyMatrix = !options.dryRun;
      const policies = curationPolicies(ctx, options);
      const managedItemResult =
        policies.managed_item === 'off'
          ? { drafts: [], report: report.managedItems }
          : await planManagedItems(ctx, {
              conflictClaims: ineligibleConflictClaims(report.conflicts),
            });
      report.managedItems = managedItemResult.report;
      if (managedItemResult.report.outcomes.held > 0) {
        report.warnings.push(
          `${managedItemResult.report.outcomes.held} managed-item finding${managedItemResult.report.outcomes.held === 1 ? '' : 's'} require${managedItemResult.report.outcomes.held === 1 ? 's' : ''} inspection; surrounding page bytes were not changed`,
        );
      }
      const allowedKinds = new Set<CurateTransformationKind>(
        (['hygiene', 'synthesis', 'split', 'extract', 'merge'] as const).filter(
          (kind) => policies[kind] !== 'off',
        ),
      );
      // A configured mode is how a full scheduled run gets plan-backed curation without
      // turning the scheduler into a curate-only command. An explicit dry run keeps its
      // existing read-only path; creating a durable plan needs the service's write handle.
      const mode = policyMatrix ? highestPolicyMode(Object.values(policies)) : null;
      if (policyMatrix && !mode) return 'all curation policies are off';
      if (!ctx.models.derive.available && !mode) {
        telemetry.degrade('curate', ctx.models.derive.degradedReason({}), 'unavailable');
        return `no model for the cycle: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`;
      }
      if (mode) {
        // Reuse every unfinished plan, not only autonomous ones. Re-running audit or review must
        // not spend another model call to rediscover a decision already waiting in the queue.
        let plan = findActiveMaintenancePlan(ctx, mode, 'curate');
        if (plan && policyMatrix && !planMatchesPolicies(plan, policies)) plan = null;
        if (plan) {
          report.curated = plan.items.filter(isGeneralCurationItem).map((item) => ({
            slug: item.subject,
            mode: item.kind === 'hygiene' ? 'hygiene' : 'synthesize',
            action: 'would-update',
            splits:
              item.kind === 'split'
                ? item.operations
                    .filter((operation) => operation.type === 'create')
                    .map((operation) =>
                      operation.relPath.replace(/\\/g, '/').replace(/\.(md|markdown)$/i, ''),
                    )
                : [],
            extractions:
              item.kind === 'extract'
                ? item.operations
                    .filter((operation) => operation.type === 'create')
                    .map((operation) =>
                      operation.relPath.replace(/\\/g, '/').replace(/\.(md|markdown)$/i, ''),
                    )
                : [],
            merges:
              item.kind === 'merge'
                ? item.operations
                    .filter((operation) => operation.type === 'delete')
                    .map((operation) =>
                      operation.relPath.replace(/\\/g, '/').replace(/\.(md|markdown)$/i, ''),
                    )
                : [],
            issues: [],
          }));
          report.repaired = repairResultFromPlan(plan);
        } else {
          if (!ctx.models.derive.available) {
            telemetry.degrade('curate', ctx.models.derive.degradedReason({}), 'unavailable');
          }
          const contradictionResult =
            ctx.config.maintenance.conflicts.resolve && (!policyMatrix || policies.contradiction !== 'off')
              ? await planContradictions(ctx, report.conflicts)
              : { drafts: [], warnings: [] };
          report.warnings.push(...contradictionResult.warnings);
          const managedPaths = new Set(managedItemResult.drafts.map((draft) => draft.relPath));
          const contradictionDrafts = contradictionResult.drafts.filter((draft) =>
            draft.operations.every((operation) => !managedPaths.has(operation.relPath)),
          );
          if (contradictionDrafts.length !== contradictionResult.drafts.length) {
            report.warnings.push(
              `${contradictionResult.drafts.length - contradictionDrafts.length} contradiction repair${contradictionResult.drafts.length - contradictionDrafts.length === 1 ? '' : 's'} deferred behind an owned managed-item repair`,
            );
          }
          const linkResult =
            ctx.config.maintenance.repair.links && (!policyMatrix || policies.broken_link !== 'off')
              ? await planBrokenLinks(ctx, ctx.config.maintenance.repair.maxChanges)
              : { drafts: [], report: { links: [], claims: [], declined: [] } };
          report.repaired = linkResult.report;
          const ruleDriftDrafts =
            !policyMatrix || policies.rule_drift !== 'off'
              ? await planRuleDrifts(ctx, { limit: ctx.config.maintenance.curate.maxRuleDrifts })
              : [];
          const result = ctx.models.derive.available
            ? await curatePages(ctx, {
                dryRun: true,
                // Planning may update derived curation fingerprints even though it cannot touch KB
                // bytes. Persisting unchanged and guard-rejected inputs is what makes the next cycle
                // converge; staged pages remain `preview` until their durable item is decided.
                recordState: true,
                includePreviewed: true,
                ...(policyMatrix ? { allowedKinds } : {}),
              })
            : {
                pages: [],
                drafts: [],
                degraded: [],
                semanticMerge: null,
                warnings: [
                  `page transformations were skipped because no maintenance model is available: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`,
                ],
              };
          report.curated = result.pages;
          report.warnings.push(...result.warnings);
          report.semanticMerge = addSemanticMergeDiscoveryMetrics(report.semanticMerge, result.semanticMerge);
          for (const degradation of result.degraded) {
            telemetry.degrade('curate', degradation.reason, degradation.failure);
          }
          // A contradiction item has priority over a general synthesis of the same page. Two
          // sealed items replacing one input would make the second stale by construction.
          const contradictionPaths = new Set(
            contradictionDrafts.flatMap((draft) => draft.operations.map((operation) => operation.relPath)),
          );
          const linkDrafts: BrokenLinkDraft[] = [];
          const linkMutations = new Set([...managedPaths, ...contradictionPaths]);
          const linkSeals = new Set<string>();
          for (const draft of linkResult.drafts) {
            const mutations = draft.operations.map((operation) => operation.relPath);
            const seals = draft.targets.map((target) => target.relPath);
            const overlaps =
              mutations.some((relPath) => linkMutations.has(relPath) || linkSeals.has(relPath)) ||
              seals.some((relPath) => linkMutations.has(relPath));
            if (overlaps) continue;
            linkDrafts.push(draft);
            for (const relPath of mutations) linkMutations.add(relPath);
            for (const relPath of seals) linkSeals.add(relPath);
          }
          for (const draft of linkResult.drafts.filter((candidate) => !linkDrafts.includes(candidate))) {
            for (const repair of draft.repairs) {
              report.repaired.links = report.repaired.links.filter((entry) => entry !== repair);
              report.repaired.declined.push({
                what: `[[${repair.brokenTarget}]]`,
                reason: 'deferred until an overlapping maintenance item settles',
              });
            }
          }
          const occupiedRuleDriftPaths = new Set([...linkMutations, ...linkSeals]);
          const selectedRuleDrifts: RuleDriftDraft[] = [];
          for (const draft of ruleDriftDrafts) {
            const paths = ruleDriftPaths(draft);
            if (paths.some((relPath) => occupiedRuleDriftPaths.has(relPath))) continue;
            selectedRuleDrifts.push(draft);
            for (const relPath of paths) occupiedRuleDriftPaths.add(relPath);
          }
          const protectedPaths = new Set([
            ...managedPaths,
            ...contradictionPaths,
            ...linkDrafts.flatMap(linkDraftPaths),
            ...selectedRuleDrifts.flatMap(ruleDriftPaths),
          ]);
          const curationDrafts = result.drafts.filter(
            (draft) => !operationsTouchedByCurateDraft(draft).some((relPath) => protectedPaths.has(relPath)),
          );
          const deferredSlugs = new Set(
            result.drafts.filter((draft) => !curationDrafts.includes(draft)).map((draft) => draft.slug),
          );
          report.curated = report.curated.map((page) =>
            deferredSlugs.has(page.slug)
              ? {
                  ...page,
                  action: 'rejected',
                  issues: ['general synthesis deferred until a higher-priority bounded item settles'],
                }
              : page,
          );
          plan = createCurationPlan(
            ctx,
            mode,
            curationDrafts,
            contradictionDrafts,
            linkDrafts,
            managedItemResult.drafts,
            selectedRuleDrifts,
            policies,
          );
        }
        if (!plan) return null;
        if (mode === 'auto' && !deferAutomaticApply) {
          if (plan.items.some((item) => item.status === 'proposed' && item.policy === 'auto')) {
            plan = await decideDreamPlanWithCurator(ctx, plan.id, telemetry);
          }
          if (
            plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))
          ) {
            const appliedResult = await applyMaintenancePlan(ctx, plan.id, budget);
            plan = appliedResult.plan;
            applied.push(...appliedResult.files.map((file) => asApplied('curate', file)));
          }
        }
        report.curated = curationReportFromPlan(report.curated, plan);
        report.repaired = repairResultFromPlan(plan, report.repaired?.declined ?? []);
        recordMaintenancePlan(report, plan);
        return null;
      }
      const result = await curatePages(ctx, { dryRun: true, recordState: false, allowedKinds });
      report.curated = result.pages;
      report.curateChangeId = result.changeId;
      report.warnings.push(...result.warnings);
      report.semanticMerge = addSemanticMergeDiscoveryMetrics(report.semanticMerge, result.semanticMerge);
      for (const degradation of result.degraded) {
        telemetry.degrade('curate', degradation.reason, degradation.failure);
      }
      applied.push(...result.files.map((file) => asApplied('curate', file)));
      return null;
    }
    case 'adopt': {
      const adoptPolicy = policyMode(effectiveTransformPolicy(ctx.config, 'adopt', options.mode));
      if (!adoptPolicy) return 'adopt policy is off';
      const result = await planOrphanAdoptions(ctx, {
        limit: ctx.config.maintenance.adopt.maxPages,
      });
      report.adopted = result.adopted;
      if (options.dryRun) return null;
      const mode = adoptPolicy;

      let plan = findActiveMaintenancePlan(ctx, mode, 'adopt');
      if (plan && !planMatchesPolicies(plan, { adopt: adoptPolicy })) plan = null;
      if (!plan && result.drafts.length > 0) {
        plan = createAdoptionPlan(ctx, mode, result.drafts, report.run.snapshot, adoptPolicy);
      }
      if (!plan) return null;
      for (const item of plan.items.filter((candidate) => candidate.kind === 'adopt')) {
        if (report.adopted.some((entry) => entry.slug === item.subject)) continue;
        report.adopted.push({
          slug: item.subject,
          files: item.evidence.flatMap((entry) =>
            entry.type === 'document' && entry.documentRelPath ? [entry.documentRelPath] : [],
          ),
          action: 'planned',
        });
      }
      if (mode === 'auto' && !deferAutomaticApply) {
        if (plan.items.some((item) => item.status === 'proposed' && item.policy === 'auto')) {
          plan = await decideDreamPlanWithCurator(ctx, plan.id, telemetry);
        }
        if (
          plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))
        ) {
          const appliedResult = await applyMaintenancePlan(ctx, plan.id, budget);
          plan = appliedResult.plan;
          applied.push(...appliedResult.files.map((file) => asApplied('adopt', file)));
        }
      }
      report.adopted = adoptionReportFromPlan(report.adopted, plan);
      const adoptionChanges = plan.items
        .map((item) => item.changeId)
        .filter((id): id is string => id !== null);
      // Compatibility for callers that adopted one orphan before adoption gained per-item plans.
      report.adoptChangeId = adoptionChanges.length === 1 ? adoptionChanges[0]! : null;
      recordMaintenancePlan(report, plan);
      return null;
    }
    case 'conflicts': {
      if (!ctx.config.maintenance.conflicts.enabled) return 'disabled in config';
      await inspectConflicts(ctx, report, telemetry);
      return null;
    }
    case 'repair': {
      if (!ctx.config.maintenance.repair.enabled) return 'disabled in config';
      return repairPhase(ctx, report);
    }
    case 'housekeeping': {
      report.housekeeping = await housekeeping(ctx);
      return null;
    }
  }
}

async function inspectConflicts(
  ctx: AknoContext,
  report: DreamReport,
  telemetry: DreamModelTelemetry,
): Promise<void> {
  const candidates = findCrossPageConflicts(ctx, ctx.config.maintenance.conflicts.maxPairs);
  if (!ctx.config.maintenance.conflicts.verify) {
    report.conflicts = candidates;
    return;
  }
  if (candidates.length > 0 && !ctx.models.derive.available) {
    telemetry.degrade('conflicts', ctx.models.derive.degradedReason({}), 'unavailable');
  }
  const verified = await verifyConflicts(ctx, candidates);
  report.conflicts = verified.conflicts;
  report.warnings.push(...verified.warnings);
  // Conflict verdicts are content-addressed graph eligibility. Refresh immediately after
  // caching them so an audit-only cycle does not leave relationship edges one night behind.
  if (ctx.writable) {
    rebuildEvidenceGraph(ctx.store, {
      conflictModelId: ctx.models.derive.modelId,
      contextualModelId: ctx.config.graph.contextualResolution.enabled ? ctx.models.derive.modelId : null,
    });
  }
}

function operationsTouchedByCurateDraft(draft: CurateDraft): string[] {
  return [
    draft.relPath,
    ...draft.children.map((child) => child.relPath),
    ...draft.extractions.map((extraction) => extraction.relPath),
    ...(draft.merge?.linkUpdates.map((update) => update.relPath) ?? []),
    ...(draft.merge ? [draft.merge.sourceRelPath] : []),
  ];
}

function linkDraftPaths(draft: BrokenLinkDraft): string[] {
  return [
    ...draft.operations.map((operation) => operation.relPath),
    ...draft.targets.map((target) => target.relPath),
  ];
}

function isGeneralCurationItem(item: MaintenanceItem): boolean {
  return (
    item.kind !== 'observe' &&
    item.kind !== 'reflect' &&
    item.kind !== 'contradiction' &&
    item.kind !== 'managed_item' &&
    item.kind !== 'broken_link' &&
    item.kind !== 'rule_drift' &&
    item.kind !== 'adopt'
  );
}

function repairResultFromPlan(plan: MaintenancePlan, declined: RepairResult['declined'] = []): RepairResult {
  const links: LinkRepair[] = plan.items.flatMap((item) => {
    if (item.kind !== 'broken_link') return [];
    const action: LinkRepair['action'] =
      item.status === 'applied'
        ? 'applied'
        : ['rejected', 'blocked', 'stale', 'verification_failed'].includes(item.status)
          ? 'rejected'
          : 'planned';
    return item.evidence.flatMap((entry): LinkRepair[] =>
      entry.type === 'link' && entry.brokenTarget && entry.newTarget && entry.signal
        ? [
            {
              from: entry.source,
              brokenTarget: entry.brokenTarget,
              newTarget: entry.newTarget,
              signal: entry.signal,
              action,
            },
          ]
        : [],
    );
  });
  return { links, claims: [], declined };
}

function maintenancePlanForReport(plan: MaintenancePlan): DreamMaintenancePlan {
  const { items, ...summary } = plan;
  return {
    ...summary,
    items: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      policy: item.policy,
      risk: item.risk,
      componentCount: item.componentCount,
      subject: item.subject,
      status: item.status,
      statusCode: item.statusCode,
      decision: item.decision,
      statusReason: item.statusReason,
      changeId: item.changeId,
      verification: item.verification,
    })),
  };
}

function recordMaintenancePlan(report: DreamReport, plan: MaintenancePlan): void {
  const summary = maintenancePlanForReport(plan);
  const existing = report.maintenancePlans.findIndex((candidate) => candidate.id === plan.id);
  if (existing === -1) report.maintenancePlans.push(summary);
  else report.maintenancePlans[existing] = summary;
  // Kept for older clients and single-phase callers. Multi-phase clients should use the array.
  report.maintenancePlan = summary;
}

/**
 * A full policy-backed cycle reaches this barrier only after every writable planner has sealed
 * its current phase plan. Curator calls and knowledge-base writes therefore cannot influence a
 * later planner in the same invocation. Single-phase commands deliberately keep their immediate
 * decide/apply behavior.
 */
async function decideDreamPlanWithCurator(
  ctx: AknoContext,
  planId: string,
  telemetry: DreamModelTelemetry,
): Promise<MaintenancePlan> {
  const curatorContext: AknoContext = {
    ...ctx,
    models: {
      ...ctx.models,
      derive: ctx.models.derive.withOutcomeObserver((observation) =>
        telemetry.observe('curator', observation),
      ),
    },
  };
  return decideMaintenancePlanWithCurator(curatorContext, planId);
}

async function decideAndApplyPlannedPhases(
  ctx: AknoContext,
  report: DreamReport,
  applied: AppliedChange[],
  budget: MaintenanceBudgetTracker,
  telemetry: DreamModelTelemetry,
): Promise<void> {
  const planIds = report.maintenancePlans.map((plan) => plan.id);
  const pagePaths = new Map(
    (
      ctx.store.db.prepare('SELECT slug, rel_path FROM pages').all() as {
        slug: string;
        rel_path: string;
      }[]
    ).map((row) => [row.slug, row.rel_path]),
  );
  const schedule = maintenanceItemApplySchedule(
    planIds.map((planId) => getMaintenancePlan(ctx, planId)),
    pagePaths,
  );
  await deferStaleMaintenanceItems(ctx, planIds);
  blockMaintenanceDependencies(ctx, planIds);

  // Decide every sealed item before applying any of them. A target creator may move ahead of an
  // earlier-phase referencer, but its bytes must never influence that referencer's curator prompt.
  for (const planId of planIds) {
    let plan = getMaintenancePlan(ctx, planId);
    if (plan.mode === 'auto') {
      if (plan.items.some((item) => item.status === 'proposed' && item.policy === 'auto')) {
        plan = await decideDreamPlanWithCurator(ctx, plan.id, telemetry);
      }
    }
  }

  for (const step of schedule) {
    let plan = getMaintenancePlan(ctx, step.planId);
    const item = plan.items.find((candidate) => candidate.id === step.itemId);
    if (!item || !['approved', 'applying', 'verification_pending'].includes(item.status)) continue;
    const prerequisiteMissing = step.dependsOn.some((dependency) => {
      const prerequisite = getMaintenancePlan(ctx, dependency.planId).items.find(
        (candidate) => candidate.id === dependency.itemId,
      );
      return prerequisite?.status !== 'applied';
    });
    if (prerequisiteMissing) {
      deferUnmetMaintenanceDependency(ctx, plan.id, item.id);
      continue;
    }
    const result = await applyMaintenancePlan(ctx, plan.id, budget, {
      onlyItemIds: new Set([item.id]),
    });
    plan = result.plan;
    applied.push(...result.files.map((file) => asApplied(plan.phase, file)));
  }

  for (const planId of planIds) {
    const plan = getMaintenancePlan(ctx, planId);
    refreshReportFromPlan(report, plan);
    recordMaintenancePlan(report, plan);
  }
}

/**
 * One bounded post-apply planning wave closes the common autonomous case where an earlier item
 * safely changed a later item's sealed evidence. Every affected phase replans from the newly
 * indexed state before any retry curator call, then all retry plans share one final barrier and
 * the original run budget. A dependency created inside this wave waits for the next cycle; this
 * function is deliberately not recursive.
 */
async function retryDependencyDeferredPhases(
  ctx: AknoContext,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
  budget: MaintenanceBudgetTracker,
  telemetry: DreamModelTelemetry,
  setModelStage: (stage: DreamModelStage) => void,
): Promise<void> {
  const deferred = report.maintenancePlans.filter(
    (plan) =>
      plan.status === 'failed' && plan.items.some((item) => item.statusCode === 'dependency_conflict'),
  );
  if (deferred.length === 0) return;

  const retryPhases = new Set<DreamPhase>(deferred.map((plan) => plan.phase));
  const retryReport: DreamReport = {
    ...report,
    phases: [],
    observations: [],
    curated: [],
    rejected: [],
    adopted: [],
    repaired: null,
    repairChangeId: null,
    housekeeping: null,
    changeId: null,
    adoptChangeId: null,
    curateChangeId: null,
    maintenancePlan: null,
    maintenancePlans: [],
    budget: maintenanceBudgetReceipt(budget),
    warnings: [],
    durationMs: 0,
  };

  for (const plan of deferred) {
    recordMaintenancePlan(report, supersedeDependencyMaintenancePlan(ctx, plan.id));
  }
  for (const phase of DREAM_PHASES) {
    if (!retryPhases.has(phase)) continue;
    setModelStage(phase);
    await runPhase(ctx, phase, options, retryReport, applied, budget, true, telemetry);
  }
  await decideAndApplyPlannedPhases(ctx, retryReport, applied, budget, telemetry);
  mergeRetryReport(report, retryReport);
}

function mergeRetryReport(report: DreamReport, retry: DreamReport): void {
  report.observations = mergeByKey(
    report.observations,
    retry.observations,
    (entry) => `${entry.slug}\0${entry.pattern}`,
  );
  report.curated = mergeByKey(report.curated, retry.curated, (entry) => entry.slug);
  report.rejected = mergeByKey(
    report.rejected,
    retry.rejected,
    (entry) => `${entry.pattern}\0${entry.reason}`,
  );
  report.adopted = mergeByKey(report.adopted, retry.adopted, (entry) => entry.slug);
  report.repaired = mergeRepairResults(report.repaired, retry.repaired);
  if (retry.changeId !== null) report.changeId = retry.changeId;
  if (retry.adoptChangeId !== null) report.adoptChangeId = retry.adoptChangeId;
  if (retry.curateChangeId !== null) report.curateChangeId = retry.curateChangeId;
  report.warnings.push(...retry.warnings);
  for (const plan of retry.maintenancePlans) {
    const existing = report.maintenancePlans.findIndex((candidate) => candidate.id === plan.id);
    if (existing === -1) report.maintenancePlans.push(plan);
    else report.maintenancePlans[existing] = plan;
  }
  if (retry.maintenancePlan) report.maintenancePlan = retry.maintenancePlan;
}

function mergeRepairResults(current: RepairResult | null, retry: RepairResult | null): RepairResult | null {
  if (!current) return retry;
  if (!retry) return current;
  return {
    links: mergeByKey(current.links, retry.links, (entry) => `${entry.from}\0${entry.brokenTarget}`),
    claims: mergeByKey(
      current.claims,
      retry.claims,
      (entry) => `${entry.slug}\0${entry.line}\0${entry.before}`,
    ),
    declined: mergeByKey(current.declined, retry.declined, (entry) => `${entry.what}\0${entry.reason}`),
  };
}

function mergeByKey<T>(current: T[], retry: T[], key: (entry: T) => string): T[] {
  const merged = new Map(current.map((entry) => [key(entry), entry]));
  for (const entry of retry) merged.set(key(entry), entry);
  return [...merged.values()];
}

function refreshReportFromPlan(report: DreamReport, plan: MaintenancePlan): void {
  if (plan.phase === 'observe' || plan.phase === 'reflect') {
    for (const item of plan.items.filter(
      (candidate) => candidate.kind === 'observe' || candidate.kind === 'reflect',
    )) {
      const next = observationFromPlanItem(item);
      const existing = report.observations.findIndex(
        (entry) => entry.slug === next.slug && entry.pattern === next.pattern,
      );
      if (existing === -1) report.observations.push(next);
      else report.observations[existing] = next;
    }
    const changes = plan.items.map((item) => item.changeId).filter((id): id is string => id !== null);
    report.changeId = changes.length === 1 ? changes[0]! : null;
    return;
  }
  if (plan.phase === 'curate') {
    report.curated = curationReportFromPlan(report.curated, plan);
    report.repaired = repairResultFromPlan(plan, report.repaired?.declined ?? []);
    return;
  }
  report.adopted = adoptionReportFromPlan(report.adopted, plan);
  const changes = plan.items.map((item) => item.changeId).filter((id): id is string => id !== null);
  report.adoptChangeId = changes.length === 1 ? changes[0]! : null;
}

function curationReportFromPlan(pages: CuratedPage[], plan: MaintenancePlan): CuratedPage[] {
  return pages.map((page) => {
    const item = plan.items.find(
      (candidate) => isGeneralCurationItem(candidate) && maintenanceItemCoversSlug(candidate, page.slug),
    );
    if (!item) return page;
    if (item.status === 'applied') return { ...page, action: 'updated', issues: [] };
    if (item.status === 'verification_pending') {
      return {
        ...page,
        action: 'updated',
        issues: [item.verification?.detail ?? 'post-write verification is pending'],
      };
    }
    if (['rejected', 'blocked', 'stale', 'verification_failed'].includes(item.status)) {
      return {
        ...page,
        action: 'rejected',
        issues: [
          item.verification?.detail ??
            item.decision?.reason ??
            item.statusReason ??
            `maintenance item is ${item.status}`,
        ],
      };
    }
    return page;
  });
}

function maintenanceItemCoversSlug(item: MaintenanceItem, slug: string): boolean {
  return (
    item.subject === slug ||
    item.evidence.some((entry) => entry.type === 'component' && entry.source === slug)
  );
}

function adoptionReportFromPlan(entries: AdoptedDocument[], plan: MaintenancePlan): AdoptedDocument[] {
  return entries.map((entry) => {
    if (entry.action !== 'planned') return entry;
    const item = plan.items.find((candidate) => candidate.subject === entry.slug);
    if (!item) return entry;
    if (item.status === 'applied') return { ...entry, action: 'created' };
    if (['rejected', 'blocked', 'stale', 'verification_failed'].includes(item.status)) {
      return {
        ...entry,
        action: 'rejected',
        reason:
          item.verification?.detail ??
          item.decision?.reason ??
          item.statusReason ??
          `maintenance item is ${item.status}`,
      };
    }
    return entry;
  });
}

// ─── Observe ────────────────────────────────────────────────────────────────

interface SubjectGroup {
  subject: string;
  subjectEntity: string;
  targetSlug: string;
  targetRelPath: string;
  facts: ObservationFact[];
}

interface ObservationFact {
  id: string;
  claim: string;
  slug: string;
  sourceLineHash: string;
  proofGroups: string[];
}

/**
 * The second tier, and the phase that writes the most.
 *
 * The guards that need the knowledge base rather than the text are applied here, before the
 * model sees anything:
 *
 * - **Knowledge pages only.** A source page is somebody else's words. "Maria prefers X"
 *   inferred from a marketing email she was cc'd on is exactly the failure this must not have.
 * - **Never self-feeding.** An observation is not admissible evidence for another observation.
 *   No inference cascades.
 */
async function repairPhase(ctx: AknoContext, report: DreamReport): Promise<string | null> {
  if (!report.repaired) {
    const result = ctx.config.maintenance.repair.links
      ? await planBrokenLinks(ctx, ctx.config.maintenance.repair.maxChanges)
      : { report: { links: [], claims: [], declined: [] } };
    report.repaired = result.report;
  }
  report.warnings.push(
    'the legacy repair phase is report-only; use the curate phase in audit, review, or auto mode to persist guarded link fixes',
  );
  return null;
}

async function observePhase(
  ctx: AknoContext,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
  budget: MaintenanceBudgetTracker,
  deferAutomaticApply: boolean,
  telemetry: DreamModelTelemetry,
): Promise<void> {
  if (options.dryRun) {
    await previewObservePhase(ctx, report);
    return;
  }

  const observePolicy = policyMode(effectiveTransformPolicy(ctx.config, 'observe', options.mode));
  if (!observePolicy) return;
  let plan = findActiveMaintenancePlan(ctx, observePolicy, 'observe');
  if (plan && !planMatchesPolicies(plan, { observe: observePolicy })) plan = null;

  const previouslyRejected: ObservationWritten[] = [];
  if (!plan) {
    const prepared = await collectPreparedObservations(ctx, report);
    const drafts: ObservationPlanDraft[] = [];
    for (const entry of prepared) {
      if (!entry.draft) continue;
      if (inferenceWasRejected(ctx, 'observe', entry.draft)) {
        previouslyRejected.push({ ...entry.written, action: 'rejected' });
      } else {
        drafts.push(entry.draft);
      }
    }
    plan = createObservationPlan(ctx, observePolicy, drafts, observePolicy);
  }
  if (!plan) {
    report.observations.push(...previouslyRejected);
    return;
  }

  if (observePolicy === 'auto' && !deferAutomaticApply) {
    if (plan.items.some((item) => item.status === 'proposed' && item.policy === 'auto')) {
      plan = await decideDreamPlanWithCurator(ctx, plan.id, telemetry);
    }
    if (plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))) {
      const result = await applyMaintenancePlan(ctx, plan.id, budget);
      plan = result.plan;
      applied.push(...result.files.map((file) => asApplied('observe', file)));
    }
  }

  report.observations.push(...plan.items.map(observationFromPlanItem), ...previouslyRejected);
  const changeIds = plan.items
    .map((item) => item.changeId)
    .filter((changeId): changeId is string => changeId !== null);
  // Compatibility for callers from before observations gained per-item journal changes.
  report.changeId = changeIds.length === 1 ? changeIds[0]! : null;
  recordMaintenancePlan(report, plan);
}

async function previewObservePhase(ctx: AknoContext, report: DreamReport): Promise<void> {
  const prepared = await collectPreparedObservations(ctx, report);
  for (const entry of prepared) {
    report.observations.push(asPreviewObservation(entry.written));
  }
}

function asPreviewObservation(entry: ObservationWritten): ObservationWritten {
  if (entry.action === 'created') return { ...entry, action: 'would-create' };
  if (entry.action === 'reinforced') return { ...entry, action: 'would-reinforce' };
  if (entry.action === 'refined') return { ...entry, action: 'would-refine' };
  if (entry.action === 'weakened') return { ...entry, action: 'would-weaken' };
  if (entry.action === 'retracted') return { ...entry, action: 'would-retract' };
  if (entry.action === 'split') return { ...entry, action: 'would-split' };
  return entry;
}

interface PreparedObservation {
  written: ObservationWritten;
  draft: ObservationPlanDraft | null;
  rejectionReason?: string;
}

async function collectPreparedObservations(
  ctx: AknoContext,
  report: DreamReport,
): Promise<PreparedObservation[]> {
  const groups = subjectGroups(ctx, ctx.config.maintenance.observe.maxSubjects, report.conflicts);
  const prepared: PreparedObservation[] = await staleObservationOutcomes(ctx);
  for (const entry of prepared) {
    if (entry.rejectionReason)
      report.rejected.push({ pattern: entry.written.pattern, reason: entry.rejectionReason });
  }
  if (groups.length === 0) return prepared;

  // Gathered once for the whole phase, not per group: fifteen groups reading the same two things
  // fifteen times is the same answer at fifteen times the cost.
  const knownFacts = liveFactClaims(ctx, report.conflicts);
  const observationsBySlug = indexedObservations(ctx);

  for (const group of groups) {
    const result = await runObserveMission({
      // The display label comes from the canonical entity page. Group membership itself is the
      // exact resolved entity id below, never a folder or a model-generated subject string.
      subject: group.subject,
      facts: group.facts.map((fact) => ({ id: fact.id, claim: fact.claim, slug: fact.slug })),
      model: ctx.models.derive,
      mission: ctx.config.maintenance.observe.mission,
      minEvidence: ctx.config.maintenance.observe.minEvidence,
      // What last night already concluded about this subject. The facts rarely change between one
      // night and the next, so without this the same insight comes back reworded every night and
      // the page accumulates paraphrases of one sentence.
      existing: observationsBySlug.get(group.targetSlug) ?? [],
      existingRecords: indexedObservationRecords(ctx, group.subjectEntity, group.targetSlug),
      // Everything already observed elsewhere, plus anything written earlier in this same run —
      // two groups can reach one conclusion from overlapping facts, and each would otherwise write
      // it to its own page where neither looks like a duplicate.
      otherObservations: [...observationsBySlug].flatMap(([slug, lines]) =>
        slug === group.targetSlug ? [] : lines,
      ),
      knownFacts,
    });

    if (result.error) {
      report.warnings.push(`observe (${group.subject}): ${result.error}`);
      continue;
    }
    report.rejected.push(...result.rejected);

    for (const observation of result.observations) {
      const outcome = await prepareCoLocatedObservation(ctx, group, observation);
      prepared.push(outcome);
      if (outcome.rejectionReason) {
        report.rejected.push({ pattern: observation.pattern, reason: outcome.rejectionReason });
      }
      // So a later group in this same run sees it. Without this, cross-page duplicates are caught
      // only from the second night onwards — the night they are created, they both go through.
      observationsBySlug.set(group.targetSlug, [
        ...(observationsBySlug.get(group.targetSlug) ?? []),
        observation.pattern,
      ]);
    }
  }
  return prepared;
}

async function staleObservationOutcomes(ctx: AknoContext): Promise<PreparedObservation[]> {
  const rows = ctx.store.db
    .prepare(
      `SELECT oe.id, oe.source_slug, oe.payload, oe.payload_hash, oe.subject_entity,
              oe.proof_count, oe.issue, p.rel_path, p.role, p.observe_management
         FROM observation_entries oe JOIN pages p ON p.id = oe.source_page
        WHERE oe.eligible = 0 AND oe.disposition = 'active'
        ORDER BY oe.source_slug, oe.marker_line`,
    )
    .all() as {
    id: string;
    source_slug: string;
    payload: string;
    payload_hash: string;
    subject_entity: string;
    proof_count: number;
    issue: string | null;
    rel_path: string;
    role: string;
    observe_management: string;
  }[];
  const prepared: PreparedObservation[] = [];
  for (const row of rows) {
    const marker = markerFromProjection(ctx.store, row.id);
    const survivingProofs = marker ? liveObservationProofGroups(ctx.store, marker) : new Set<string>();
    const outcome = survivingProofs.size > 0 ? 'weaken' : 'retract';
    const action: ObservationWritten['action'] = outcome === 'weaken' ? 'weakened' : 'retracted';
    const pattern = row.payload
      .replace(/^- \*\*Observation:\*\*\s*/, '')
      .replace(/\s+Evidence:\s+(?:\[\[[^\]]+\]\]\s*)+$/, '')
      .trim();
    const written: ObservationWritten = { slug: row.source_slug, pattern, evidence: [], action };
    if (!marker || row.role !== 'knowledge' || row.observe_management !== 'integrate' || !row.issue) {
      prepared.push({
        written: { ...written, action: outcome === 'weaken' ? 'would-weaken' : 'would-retract' },
        draft: null,
        rejectionReason: `held ${outcome}: ${row.issue ?? 'the target no longer admits observation integration'}`,
      });
      continue;
    }
    const absPath = path.join(ctx.config.aknoPath, row.rel_path);
    const before = await fsp.readFile(absPath, 'utf8').catch(() => null);
    if (before === null) {
      prepared.push({
        written: { ...written, action: outcome === 'weaken' ? 'would-weaken' : 'would-retract' },
        draft: null,
        rejectionReason: `held ${outcome}: the target page is no longer readable`,
      });
      continue;
    }
    const disposition = outcome === 'weaken' ? 'weakened' : 'retracted';
    const replacement = `${renderObservationMarker({ ...marker, disposition })}\n${row.payload}`;
    const after = replaceObservationBlock(before, marker.id, replacement);
    if (after === null) {
      prepared.push({
        written: { ...written, action: outcome === 'weaken' ? 'would-weaken' : 'would-retract' },
        draft: null,
        rejectionReason: `held ${outcome}: the owned block no longer matches its projection`,
      });
      continue;
    }
    const sealedEvidence: ObservationPlanDraft['evidence'] = [];
    for (const locator of marker.evidence) {
      const fact = ctx.store.db
        .prepare(`SELECT p.slug, p.rel_path FROM facts f JOIN pages p ON p.id = f.page_id WHERE f.id = ?`)
        .get(locator.factId) as { slug: string; rel_path: string } | undefined;
      const sourceBytes = fact
        ? await fsp.readFile(path.join(ctx.config.aknoPath, fact.rel_path), 'utf8').catch(() => null)
        : null;
      sealedEvidence.push({
        slug: fact?.slug ?? `fact:${locator.factId}`,
        contentHash: sourceBytes === null ? null : sha256(sourceBytes),
        factId: locator.factId,
        sourceLineHash: locator.sourceLineHash,
        proofGroups: locator.proofGroups,
      });
    }
    const inputHash = sha256(
      JSON.stringify({
        target: row.source_slug,
        beforeHash: sha256(before),
        observationId: row.id,
        payloadHash: row.payload_hash,
        issue: row.issue,
        outcome,
        evidence: sealedEvidence,
      }),
    );
    prepared.push({
      written,
      draft: {
        slug: row.source_slug,
        relPath: row.rel_path,
        inputHash,
        before,
        after,
        evidence: sealedEvidence,
        observationId: row.id,
        observationSubject: row.subject_entity,
        observationDisposition: disposition,
        observationProofCount: row.proof_count,
        observationOutcome: outcome,
        observationTargetId: row.id,
        observationPayloadHash: row.payload_hash,
        observationQualificationIssue: row.issue,
      },
    });
  }
  return prepared;
}

/** Live eligible level-one facts grouped only by exact resolved subject identity. */
function subjectGroups(
  ctx: AknoContext,
  maxSubjects: number,
  conflicts: CrossPageConflict[],
): SubjectGroup[] {
  const ineligible = ineligibleConflictClaims(conflicts);
  const rows = ctx.store.db
    .prepare(
      `SELECT f.id, f.claim, f.line_start, f.source_line_hash, f.item_id,
              p.id AS page_id, p.slug, p.updated_at, g.subject_entity,
              e.canonical_page, cp.slug AS canonical_slug, cp.rel_path AS canonical_rel_path,
              cp.observe_management AS canonical_observe
         FROM facts f JOIN pages p ON p.id = f.page_id
         JOIN graph_fact_status g ON g.fact_id = f.id
         JOIN graph_entities e ON e.id = g.subject_entity
         JOIN pages cp ON cp.id = e.canonical_page
        WHERE f.valid_to IS NULL
          AND f.confidence >= 0.5
          AND p.role = 'knowledge'
          AND p.derived_hash = p.body_hash
          AND g.eligibility = 'eligible'
          AND g.traversable = 1
        ORDER BY p.updated_at DESC`,
    )
    .all() as {
    id: string;
    claim: string;
    line_start: number;
    source_line_hash: string;
    item_id: string | null;
    page_id: string;
    slug: string;
    updated_at: string | null;
    subject_entity: string;
    canonical_page: string;
    canonical_slug: string;
    canonical_rel_path: string;
    canonical_observe: string;
  }[];

  const groups = new Map<string, SubjectGroup>();
  for (const row of rows) {
    if (ineligible.has(claimKey(row.slug, row.line_start))) continue;
    const target = observationTarget(ctx, row);
    if (!target) continue;
    const proofs = [...proofGroupsForFact(ctx.store, row.id, row.page_id, row.item_id)].sort();
    if (proofs.length === 0) continue;
    const key = row.subject_entity;

    const existing = groups.get(key);
    if (existing) {
      if (existing.targetSlug !== target.slug) {
        groups.delete(key);
        continue;
      }
      if (existing.facts.length < 30) {
        existing.facts.push({
          id: row.id,
          claim: row.claim,
          slug: row.slug,
          sourceLineHash: row.source_line_hash,
          proofGroups: proofs,
        });
      }
    } else {
      groups.set(key, {
        subject: target.title,
        subjectEntity: row.subject_entity,
        targetSlug: target.slug,
        targetRelPath: target.relPath,
        facts: [
          {
            id: row.id,
            claim: row.claim,
            slug: row.slug,
            sourceLineHash: row.source_line_hash,
            proofGroups: proofs,
          },
        ],
      });
    }
  }

  return [...groups.values()]
    .filter(
      (group) =>
        independentProofGroups(
          group.facts.map((fact) => ({
            factId: fact.id,
            sourceLineHash: fact.sourceLineHash,
            proofGroups: fact.proofGroups,
          })),
        ).size >= ctx.config.maintenance.observe.minEvidence,
    )
    .slice(0, maxSubjects);
}

function observationTarget(
  ctx: AknoContext,
  row: {
    canonical_page: string;
    canonical_slug: string;
    canonical_rel_path: string;
    canonical_observe: string;
  },
): { slug: string; relPath: string; title: string } | null {
  if (row.canonical_observe === 'integrate') {
    const page = ctx.store.db.prepare('SELECT title FROM pages WHERE id = ?').get(row.canonical_page) as
      { title: string } | undefined;
    return page ? { slug: row.canonical_slug, relPath: row.canonical_rel_path, title: page.title } : null;
  }
  const topics = (
    ctx.store.db
      .prepare(
        `SELECT slug, rel_path, title, about FROM pages
          WHERE role = 'knowledge' AND observe_management = 'integrate' AND id != ?`,
      )
      .all(row.canonical_page) as { slug: string; rel_path: string; title: string; about: string }[]
  ).filter((page) => (JSON.parse(page.about) as string[]).includes(row.canonical_slug));
  return topics.length === 1
    ? { slug: topics[0]!.slug, relPath: topics[0]!.rel_path, title: topics[0]!.title }
    : null;
}

function indexedObservations(ctx: AknoContext): Map<string, string[]> {
  const rows = ctx.store.db
    .prepare(
      `SELECT source_slug, payload FROM observation_entries
        WHERE disposition != 'retracted' ORDER BY source_slug, marker_line`,
    )
    .all() as { source_slug: string; payload: string }[];
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const pattern = row.payload
      .replace(/^- \*\*Observation:\*\*\s*/, '')
      .replace(/\s+Evidence:\s+(?:\[\[[^\]]+\]\]\s*)+$/, '')
      .trim();
    const bucket = result.get(row.source_slug);
    if (bucket) bucket.push(pattern);
    else result.set(row.source_slug, [pattern]);
  }
  return result;
}

function indexedObservationRecords(
  ctx: AknoContext,
  subject: string,
  slug: string,
): { id: string; pattern: string }[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT id, payload FROM observation_entries
        WHERE subject_entity = ? AND source_slug = ? AND disposition = 'active' AND eligible = 1
        ORDER BY marker_line`,
    )
    .all(subject, slug) as { id: string; payload: string }[];
  return rows.map((row) => ({
    id: row.id,
    pattern: row.payload
      .replace(/^- \*\*Observation:\*\*\s*/, '')
      .replace(/\s+Evidence:\s+(?:\[\[[^\]]+\]\]\s*)+$/, '')
      .trim(),
  }));
}

async function prepareCoLocatedObservation(
  ctx: AknoContext,
  group: SubjectGroup,
  observation: ObservationCandidate,
): Promise<PreparedObservation> {
  let selected = observation.evidence.flatMap((id) => {
    const fact = group.facts.find((candidate) => candidate.id === id);
    return fact ? [fact] : [];
  });
  const outcome = observation.outcome ?? 'create';
  const targetMarker = observation.targetId ? markerFromProjection(ctx.store, observation.targetId) : null;
  const targetRow = observation.targetId
    ? (ctx.store.db
        .prepare(
          `SELECT source_slug, payload FROM observation_entries
            WHERE id = ? AND subject_entity = ? AND disposition = 'active' AND eligible = 1`,
        )
        .get(observation.targetId, group.subjectEntity) as
        { source_slug: string; payload: string } | undefined)
    : undefined;
  if (outcome !== 'create' && (!targetMarker || !targetRow || targetRow.source_slug !== group.targetSlug)) {
    return {
      written: {
        slug: group.targetSlug,
        pattern: observation.pattern,
        evidence: [],
        action: 'rejected',
      },
      draft: null,
      rejectionReason: 'the requested observation lifecycle target is no longer active and eligible',
    };
  }
  if (outcome === 'reinforce' && targetMarker) {
    selected = await observationFactsForLocators(ctx, [
      ...targetMarker.evidence,
      ...selected.map((fact) => ({
        factId: fact.id,
        sourceLineHash: fact.sourceLineHash,
        proofGroups: fact.proofGroups,
      })),
    ]);
  }
  if (selected.length > 12) {
    return {
      written: {
        slug: group.targetSlug,
        pattern: observation.pattern,
        evidence: [],
        action: 'rejected',
      },
      draft: null,
      rejectionReason: 'observation lineage exceeds the 12-fact marker limit',
    };
  }
  const locators: ObservationEvidenceLocator[] = selected.map((fact) => ({
    factId: fact.id,
    sourceLineHash: fact.sourceLineHash,
    proofGroups: fact.proofGroups,
  }));
  const proofCount = independentProofGroups(locators).size;
  const action =
    outcome === 'reinforce'
      ? 'reinforced'
      : outcome === 'refine'
        ? 'refined'
        : outcome === 'split'
          ? 'split'
          : 'created';
  const written: ObservationWritten = {
    slug: group.targetSlug,
    pattern: observation.pattern,
    evidence: [...new Set(selected.map((fact) => fact.slug))],
    action,
  };
  if (selected.length < 2 || proofCount < ctx.config.maintenance.observe.minEvidence) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: `evidence has ${proofCount} independent proof group(s)`,
    };
  }

  const absPath = path.join(ctx.config.aknoPath, group.targetRelPath);
  const before = await fsp.readFile(absPath, 'utf8').catch(() => null);
  if (before === null) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: 'the admitted target page is no longer readable',
    };
  }
  const existingPattern = targetRow
    ? targetRow.payload
        .replace(/^- \*\*Observation:\*\*\s*/, '')
        .replace(/\s+Evidence:\s+(?:\[\[[^\]]+\]\]\s*)+$/, '')
        .trim()
    : null;
  const finalPattern = outcome === 'reinforce' && existingPattern ? existingPattern : observation.pattern;
  const marker = {
    id: targetMarker?.id ?? observationId(group.subjectEntity, finalPattern),
    subject: group.subjectEntity,
    disposition: 'active' as const,
    evidence: locators,
    proofCount,
  };
  const block = observationBlock(
    marker,
    finalPattern,
    selected.map((fact) => fact.slug),
  );
  if (outcome === 'create' && observationMarkerIndexes(before.split(/\r?\n/), marker.id, true).length > 0) {
    return { written: { ...written, action: 'unchanged' }, draft: null };
  }
  let after: string | null;
  if (outcome === 'create') {
    after = insertObservationBlock(before, block);
  } else if (outcome === 'split' && targetMarker && existingPattern && observation.splitPattern) {
    const oldFacts = await observationFactsForLocators(ctx, targetMarker.evidence);
    if (oldFacts.length !== targetMarker.evidence.length) after = null;
    else {
      const superseded = observationBlock(
        { ...targetMarker, disposition: 'superseded' },
        existingPattern,
        oldFacts.map((fact) => fact.slug),
      );
      const first = {
        ...marker,
        id: observationId(group.subjectEntity, observation.pattern),
      };
      const second = {
        ...marker,
        id: observationId(group.subjectEntity, observation.splitPattern),
      };
      after = replaceObservationBlock(
        before,
        targetMarker.id,
        `${superseded}\n\n${observationBlock(
          first,
          observation.pattern,
          selected.map((fact) => fact.slug),
        )}\n\n${observationBlock(
          second,
          observation.splitPattern,
          selected.map((fact) => fact.slug),
        )}`,
      );
    }
  } else {
    after = replaceObservationBlock(before, marker.id, block);
  }
  if (after === null) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: 'the owned observation block changed before its lifecycle update was sealed',
    };
  }
  const sealedEvidence = await sealObservationFacts(ctx, selected);
  if (sealedEvidence.length !== selected.length) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: 'exact evidence changed before the observation was sealed',
    };
  }
  const inputHash = sha256(
    JSON.stringify({
      target: group.targetSlug,
      beforeHash: sha256(before),
      observation: marker,
      evidence: sealedEvidence,
    }),
  );
  return {
    written,
    draft: {
      slug: group.targetSlug,
      relPath: group.targetRelPath,
      inputHash,
      before,
      after,
      evidence: sealedEvidence,
      observationId: marker.id,
      observationSubject: marker.subject,
      observationDisposition: marker.disposition,
      observationProofCount: marker.proofCount,
      observationOutcome: outcome,
      ...(targetMarker ? { observationTargetId: targetMarker.id } : {}),
    },
  };
}

async function observationFactsForLocators(
  ctx: AknoContext,
  locators: ObservationEvidenceLocator[],
): Promise<ObservationFact[]> {
  const byFact = new Map<string, ObservationFact>();
  for (const locator of locators) {
    if (byFact.has(locator.factId)) continue;
    const row = ctx.store.db
      .prepare(
        `SELECT f.id, f.claim, f.source_line_hash, f.item_id, f.page_id, p.slug
           FROM facts f JOIN pages p ON p.id = f.page_id
          WHERE f.id = ? AND f.valid_to IS NULL`,
      )
      .get(locator.factId) as
      | {
          id: string;
          claim: string;
          source_line_hash: string;
          item_id: string | null;
          page_id: string;
          slug: string;
        }
      | undefined;
    if (!row || row.source_line_hash !== locator.sourceLineHash) continue;
    const proofGroups = [...proofGroupsForFact(ctx.store, row.id, row.page_id, row.item_id)].sort();
    if (
      proofGroups.length !== locator.proofGroups.length ||
      proofGroups.some((proof) => !locator.proofGroups.includes(proof))
    ) {
      continue;
    }
    byFact.set(row.id, {
      id: row.id,
      claim: row.claim,
      slug: row.slug,
      sourceLineHash: row.source_line_hash,
      proofGroups,
    });
  }
  return [...byFact.values()];
}

async function sealObservationFacts(
  ctx: AknoContext,
  facts: ObservationFact[],
): Promise<ObservationPlanDraft['evidence']> {
  const out: ObservationPlanDraft['evidence'] = [];
  for (const fact of facts) {
    const row = ctx.store.db
      .prepare(
        `SELECT f.source_line_hash, f.valid_to, p.rel_path, p.role, p.derived_hash, p.body_hash
           FROM facts f JOIN pages p ON p.id = f.page_id WHERE f.id = ?`,
      )
      .get(fact.id) as
      | {
          source_line_hash: string;
          valid_to: string | null;
          rel_path: string;
          role: string;
          derived_hash: string | null;
          body_hash: string;
        }
      | undefined;
    if (
      !row ||
      row.valid_to !== null ||
      row.source_line_hash !== fact.sourceLineHash ||
      row.role !== 'knowledge' ||
      row.derived_hash !== row.body_hash
    ) {
      continue;
    }
    const content = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (content === null) continue;
    out.push({
      slug: fact.slug,
      contentHash: sha256(content),
      factId: fact.id,
      sourceLineHash: fact.sourceLineHash,
      proofGroups: fact.proofGroups,
    });
  }
  return out;
}

/** The configured inference namespace remains the home of the separate L3 principles page. */
function inferenceSlug(ctx: AknoContext, pageSlug: string): string {
  return normalizeSlug(`${ctx.config.paths.observations}/${pageSlug}`);
}

/**
 * Every live claim in the knowledge base, so an "observation" cannot be one of them handed back.
 *
 * Superseded claims are left out: their sentence has already been replaced, and an observation is
 * not a repeat of something the knowledge base no longer says.
 */
function liveFactClaims(ctx: AknoContext, conflicts: CrossPageConflict[] = []): string[] {
  const ineligible = ineligibleConflictClaims(conflicts);
  const rows = ctx.store.db
    .prepare(
      `SELECT f.claim, f.line_start, p.slug
       FROM facts f JOIN pages p ON p.id = f.page_id
       WHERE f.valid_to IS NULL AND p.derived_hash = p.body_hash`,
    )
    .all() as {
    claim: string;
    line_start: number;
    slug: string;
  }[];
  return rows.filter((row) => !ineligible.has(claimKey(row.slug, row.line_start))).map((row) => row.claim);
}

function inferenceWasRejected(
  ctx: AknoContext,
  kind: Extract<MaintenanceItem['kind'], 'observe' | 'reflect'>,
  draft: ObservationPlanDraft,
): boolean {
  const row = ctx.store.db
    .prepare(
      `SELECT 1 FROM maintenance_items
        WHERE kind = ? AND status = 'rejected' AND subject = ? AND input_hash = ?
        LIMIT 1`,
    )
    .get(kind, draft.slug, draft.inputHash);
  return row !== undefined;
}

function observationFromPlanItem(item: MaintenanceItem): ObservationWritten {
  const operation = item.operations[0]!;
  if (operation.type === 'move') throw new Error('an inference item cannot move a document');
  const after = operation.type === 'delete' ? operation.before : operation.after;
  if (item.kind === 'observe') {
    const metadata = item.evidence.find((entry) => entry.observationId);
    const projectedId = metadata?.observationId;
    const lines = after.split(/\r?\n/);
    const marker = projectedId ? (observationMarkerIndexes(lines, projectedId, true)[0] ?? -1) : -1;
    const payload = marker >= 0 ? (lines[marker + 1] ?? '') : '';
    const pattern = /^- \*\*Observation:\*\* (.+?) Evidence: /.exec(payload)?.[1] ?? '';
    const outcome = metadata?.observationOutcome ?? 'create';
    const proposed: ObservationWritten['action'] =
      outcome === 'reinforce'
        ? 'would-reinforce'
        : outcome === 'refine'
          ? 'would-refine'
          : outcome === 'split'
            ? 'would-split'
            : outcome === 'weaken'
              ? 'would-weaken'
              : outcome === 'retract'
                ? 'would-retract'
                : 'would-create';
    const completed: ObservationWritten['action'] =
      outcome === 'reinforce'
        ? 'reinforced'
        : outcome === 'refine'
          ? 'refined'
          : outcome === 'split'
            ? 'split'
            : outcome === 'weaken'
              ? 'weakened'
              : outcome === 'retract'
                ? 'retracted'
                : 'created';
    const action: ObservationWritten['action'] =
      item.status === 'applied'
        ? completed
        : ['rejected', 'blocked', 'stale', 'verification_failed'].includes(item.status)
          ? 'rejected'
          : proposed;
    return {
      slug: item.subject,
      pattern,
      evidence: [...new Set(item.evidence.map((entry) => entry.source))],
      action,
    };
  }
  const lastLine = after.trimEnd().split('\n').at(-1) ?? '';
  const pattern = /^- \d{4}-\d{2}-\d{2} — (.+?)(?:\s+\[\[[^\]]+\]\])+$/.exec(lastLine)?.[1] ?? '';
  const proposed = operation.type === 'create' ? 'would-create' : 'would-refine';
  const action: ObservationWritten['action'] =
    item.status === 'applied'
      ? operation.type === 'create'
        ? 'created'
        : 'refined'
      : ['rejected', 'blocked', 'stale', 'verification_failed'].includes(item.status)
        ? 'rejected'
        : proposed;
  return {
    slug: item.subject,
    pattern,
    evidence: item.evidence.filter((entry) => entry.type === 'page').map((entry) => entry.source),
    action,
  };
}

/** L3 principles retain the legacy inference-page envelope; L2 observations do not use this writer. */
function newPrinciplesPage(subject: string, observation: ObservationCandidate, today: string): string {
  const title = subject.charAt(0).toUpperCase() + subject.slice(1);
  return (
    `---\ntitle: ${serializeYamlString(title, 'title')}\nderived: true\n` +
    `evidence: ${serializeYamlStringArray(observation.evidence, 'evidence')}\n---\n\n` +
    `# ${title}\n\n` +
    `Patterns Akno inferred from pages listed as evidence. Not authored claims.\n\n` +
    `- ${today} — ${observation.pattern} ${citation(observation.evidence)}\n`
  );
}

/** Appends the new line and unions the evidence, leaving every existing line alone. */
function appendPrinciple(current: string, line: string, evidence: string[]): string | null {
  const merged = mergeEvidence(current, evidence);
  if (merged === null) return null;
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  return `${merged.replace(/\s+$/, '')}${newline}${line}${newline}`;
}

function mergeEvidence(current: string, evidence: string[]): string | null {
  const merged = mergeTopLevelStringArray(current, 'evidence', evidence);
  if (merged !== null) return merged;

  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(current);
  if (!match) return null;

  const front = match[1]!;
  // An existing key that is not one exact string sequence is user-edited or malformed. Refuse
  // to guess around it and propagate that refusal so no unsupported principle is appended.
  if (/^evidence:/m.test(front)) return null;

  // Add the owned key without round-tripping any neighboring frontmatter.
  const newline = match[0].includes('\r\n') ? '\r\n' : '\n';
  const nextFront = `${front}${newline}evidence: ${serializeYamlStringArray(evidence, 'evidence')}`;
  return current.replace(match[0], `---${newline}${nextFront}${newline}---${newline}`);
}

function citation(evidence: string[]): string {
  return evidence.map((slug) => `[[${slug}]]`).join(' ');
}

// ─── Reflect ────────────────────────────────────────────────────────────────

/**
 * The third tier — **off by default**, and shipped as an extension point rather than a
 * finished tier because at a few hundred pages a "pattern" is one coincidence away from noise.
 *
 * The plumbing is real: enabling it runs the observe writer over the tier above, so principles
 * are built from observations and the pages behind them. What it deliberately does not do is
 * invent a second set of guardrails — the same evidence floor, the same refusal to hedge, the
 * same append-only writing.
 */
/** The one page `reflect` writes, and the one page it must not read. */
const PRINCIPLES_SLUG = 'principles';

async function reflectPhase(
  ctx: AknoContext,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
  budget: MaintenanceBudgetTracker,
  deferAutomaticApply: boolean,
  telemetry: DreamModelTelemetry,
): Promise<void> {
  if (options.dryRun) {
    await previewReflectPhase(ctx, report);
    return;
  }

  const reflectPolicy = policyMode(effectiveTransformPolicy(ctx.config, 'reflect', options.mode));
  if (!reflectPolicy) return;
  let plan = findActiveMaintenancePlan(ctx, reflectPolicy, 'reflect');
  if (plan && !planMatchesPolicies(plan, { reflect: reflectPolicy })) plan = null;

  const previouslyRejected: ObservationWritten[] = [];
  if (!plan) {
    const prepared = await collectPreparedReflections(ctx, report);
    const drafts: ObservationPlanDraft[] = [];
    for (const entry of prepared) {
      if (!entry.draft) continue;
      if (inferenceWasRejected(ctx, 'reflect', entry.draft)) {
        previouslyRejected.push({ ...entry.written, action: 'rejected' });
      } else {
        drafts.push(entry.draft);
      }
    }
    plan = createReflectionPlan(ctx, reflectPolicy, drafts, reflectPolicy);
  }
  if (!plan) {
    report.observations.push(...previouslyRejected);
    return;
  }

  if (reflectPolicy === 'auto' && !deferAutomaticApply) {
    if (plan.items.some((item) => item.status === 'proposed' && item.policy === 'auto')) {
      plan = await decideDreamPlanWithCurator(ctx, plan.id, telemetry);
    }
    if (plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))) {
      const result = await applyMaintenancePlan(ctx, plan.id, budget);
      plan = result.plan;
      applied.push(...result.files.map((file) => asApplied('reflect', file)));
    }
  }

  report.observations.push(...plan.items.map(observationFromPlanItem), ...previouslyRejected);
  const changeIds = plan.items
    .map((item) => item.changeId)
    .filter((changeId): changeId is string => changeId !== null);
  report.changeId = changeIds.length === 1 ? changeIds[0]! : null;
  recordMaintenancePlan(report, plan);
}

async function previewReflectPhase(ctx: AknoContext, report: DreamReport): Promise<void> {
  const prepared = await collectPreparedReflections(ctx, report);
  for (const outcome of prepared) {
    report.observations.push(asPreviewObservation(outcome.written));
  }
}

async function collectPreparedReflections(
  ctx: AknoContext,
  report: DreamReport,
): Promise<PreparedObservation[]> {
  // The L3 page must not feed its own prior conclusions back into reflection. L2 input comes only
  // from eligible projected markers, while the separate principles page remains write-only here.
  const target = inferenceSlug(ctx, PRINCIPLES_SLUG);
  const observations = indexedObservations(ctx);
  const rows = ctx.store.db
    .prepare(
      `SELECT oe.id, oe.source_slug AS slug, oe.payload, oe.payload_hash, p.rel_path
         FROM observation_entries oe JOIN pages p ON p.id = oe.source_page
        WHERE oe.eligible = 1 AND oe.disposition = 'active'
        ORDER BY p.updated_at DESC, oe.marker_line DESC LIMIT 40`,
    )
    .all() as {
    id: string;
    slug: string;
    payload: string;
    payload_hash: string;
    rel_path: string;
  }[];

  if (rows.length < 2) {
    report.warnings.push('reflect had fewer than two observations to build on — nothing was written');
    return [];
  }

  const result = await runObserveMission({
    subject: 'decision principles',
    facts: rows.map((row) => ({ id: row.id, claim: row.payload, slug: row.slug })),
    model: ctx.models.derive,
    mission:
      ctx.config.maintenance.reflect.mission ??
      'State durable decision principles and long-term tendencies, not individual patterns.',
    // A tier further from the evidence needs more of it.
    minEvidence: Math.max(3, ctx.config.maintenance.observe.minEvidence),
    // This tier appends to one page every night from observations that rarely change, so without
    // its own previous answers it restates them — the same way `observe` did, one tier up.
    existing: await recordedPrinciples(ctx),
    // A principle that is one of the observation lines verbatim is not a tier above them. Its
    // sources here are page *summaries*, so the lines themselves are not otherwise checked.
    otherObservations: [...observations].flatMap(([slug, lines]) => (slug === target ? [] : lines)),
    // Nor a raw claim promoted to a principle. `facts` for this phase is the observations, so
    // without this the knowledge base's own facts are the one thing it is not compared against.
    knownFacts: liveFactClaims(ctx, report.conflicts),
  });

  if (result.error) {
    report.warnings.push(`reflect: ${result.error}`);
    return [];
  }
  report.rejected.push(...result.rejected);

  const prepared: PreparedObservation[] = [];
  for (const observation of result.observations) {
    const outcome = await prepareIndexedReflection(ctx, observation, rows);
    prepared.push(outcome);
    if (outcome.rejectionReason) {
      report.rejected.push({ pattern: observation.pattern, reason: outcome.rejectionReason });
    }
  }
  return prepared;
}

/** L3 is one explicit synthesis page, so read only its owned dated entries. */
async function recordedPrinciples(ctx: AknoContext): Promise<string[]> {
  const relPath = `${inferenceSlug(ctx, PRINCIPLES_SLUG)}.md`;
  const body = await fsp.readFile(path.join(ctx.config.aknoPath, relPath), 'utf8').catch(() => null);
  if (body === null) return [];
  return body
    .split(/\r?\n/)
    .filter((line) => /^- \d{4}-\d{2}-\d{2} — /.test(line))
    .map((line) =>
      line
        .replace(/^- \d{4}-\d{2}-\d{2} — /, '')
        .replace(/\s*\[\[[^\]]*\]\]/g, '')
        .trim(),
    )
    .filter(Boolean);
}

async function prepareIndexedReflection(
  ctx: AknoContext,
  observation: ObservationCandidate,
  rows: {
    id: string;
    slug: string;
    payload: string;
    payload_hash: string;
    rel_path: string;
  }[],
): Promise<PreparedObservation> {
  const selected = observation.evidence.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id);
    return row ? [row] : [];
  });
  const slug = inferenceSlug(ctx, PRINCIPLES_SLUG);
  const relPath = `${slug}.md`;
  const absPath = path.join(ctx.config.aknoPath, relPath);
  const before = await fsp.readFile(absPath, 'utf8').catch(() => null);
  const evidenceSlugs = [...new Set(selected.map((entry) => entry.slug))];
  const written: ObservationWritten = {
    slug,
    pattern: observation.pattern,
    evidence: evidenceSlugs,
    action: before === null ? 'created' : 'refined',
  };
  if (selected.length < Math.max(3, ctx.config.maintenance.observe.minEvidence)) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: 'reflection cited too few eligible level-two observations',
    };
  }
  if (before?.includes(observation.pattern)) {
    return { written: { ...written, action: 'unchanged' }, draft: null };
  }
  const today = new Date().toISOString().slice(0, 10);
  const line = `- ${today} — ${observation.pattern} ${citation(evidenceSlugs)}`;
  const pageCandidate = { ...observation, evidence: evidenceSlugs };
  const after =
    before === null
      ? newPrinciplesPage('Principles', pageCandidate, today)
      : appendPrinciple(before, line, evidenceSlugs);
  if (after === null) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: 'the existing principles page has an unsupported evidence declaration',
    };
  }
  const evidence: ObservationPlanDraft['evidence'] = [];
  for (const row of selected) {
    const bytes = await fsp.readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8').catch(() => null);
    if (bytes === null) continue;
    evidence.push({
      slug: row.slug,
      contentHash: sha256(bytes),
      reflectionObservationId: row.id,
      reflectionPayloadHash: row.payload_hash,
    });
  }
  if (evidence.length !== selected.length) {
    return {
      written: { ...written, action: 'rejected' },
      draft: null,
      rejectionReason: 'a level-two source changed before reflection was sealed',
    };
  }
  const inputHash = sha256(
    JSON.stringify({
      slug,
      before: before === null ? null : sha256(before),
      pattern: observation.pattern,
      evidence,
    }),
  );
  return { written, draft: { slug, relPath, inputHash, before, after, evidence } };
}

/** A journal entry, as the log wants it: which phase, and what the write added. */
function asApplied(phase: DreamPhase, file: ChangeFile): AppliedChange {
  return {
    phase,
    relPath: file.relPath,
    action: file.action,
    added: file.after === null ? [] : addedLines(file.before, file.after),
  };
}

/** Guard for the CLI: a phase name that is not one. */
export function parsePhase(value: string): DreamPhase {
  if ((DREAM_PHASES as string[]).includes(value)) return value as DreamPhase;
  throw new AknoError('invalid', `unknown phase '${value}' — expected one of ${DREAM_PHASES.join(', ')}`);
}
