import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { AknoError } from '@tenphi/akno-protocol';
import { writeFileAtomic } from '../write/atomic.ts';
import type { ChangeFile } from '../write/journal.ts';
import { normalizeSlug } from '../ops/write.ts';
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
import { curatePages, type CurateDraft, type CuratedPage } from './curate.ts';
import {
  applyMaintenancePlan,
  createAdoptionPlan,
  createCurationPlan,
  decideMaintenancePlanWithCurator,
  findActiveMaintenancePlan,
  type MaintenanceItem,
  type MaintenanceMode,
  type MaintenancePlan,
  type MaintenancePlanSummary,
} from './plans.ts';
import {
  beginDreamRun,
  completeDreamRun,
  failDreamRun,
  type DreamRunMode,
  type DreamRunReceipt,
} from './runs.ts';
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

export interface ObservationWritten {
  slug: string;
  pattern: string;
  evidence: string[];
  action: 'created' | 'refined' | 'unchanged';
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
    'id' | 'kind' | 'risk' | 'subject' | 'status' | 'decision' | 'statusReason' | 'changeId' | 'verification'
  >[];
}

export interface DreamReport {
  /** Durable, content-safe identity and outcome for this complete invocation. */
  run: DreamRunReceipt;
  phases: PhaseReport[];
  observations: ObservationWritten[];
  curated: CuratedPage[];
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
  changeId: string | null;
  /** The `adopt` phase's change, kept apart from observe's. */
  adoptChangeId: string | null;
  curateChangeId: string | null;
  /** The sealed artifact produced by plan-backed curation, when a mode was selected. */
  maintenancePlan: DreamMaintenancePlan | null;
  /** Every phase-specific plan touched by this run. */
  maintenancePlans: DreamMaintenancePlan[];
  warnings: string[];
  durationMs: number;
  /** Where the run was written down, when `maintenance.log_changes` is on. */
  logPath?: string;
}

export interface DreamOptions {
  /** One phase instead of every enabled one. */
  phase?: DreamPhase;
  /** Report what would be written without touching disk. */
  dryRun?: boolean;
  /** Authority policy for a durable curate or adopt plan. */
  mode?: MaintenanceMode;
}

export async function dream(ctx: AknoContext, options: DreamOptions = {}): Promise<DreamReport> {
  if (options.mode && options.phase !== 'curate' && options.phase !== 'adopt') {
    throw new AknoError('invalid', 'a maintenance mode requires `phase: curate` or `phase: adopt`');
  }
  if (options.mode && options.dryRun) {
    throw new AknoError('invalid', 'choose `mode: audit` instead of combining a mode with dryRun');
  }
  const started = performance.now();
  // The tiers run unattended and are worth a better model than indexing needs — measured:
  // the same observe pass over one knowledge base produced 15 candidates worth about four with a
  // local 3B, and 8 candidates with no guard violations at all with a strong one. When
  // `maintenance.model` is set, the whole cycle uses it and nothing else does.
  const cycle: AknoContext = ctx.config.maintenance.model
    ? { ...ctx, models: { ...ctx.models, derive: new ModelClient(ctx.config.maintenance.model) } }
    : ctx;
  const wanted = options.phase ? [options.phase] : DREAM_PHASES;
  const startedRun = beginDreamRun(ctx, {
    requestedPhase: options.phase ?? null,
    requestedPhases: wanted,
    mode: dreamRunMode(ctx, options),
    dryRun: options.dryRun ?? false,
    modelId: cycle.models.derive.modelId,
  });
  const report: DreamReport = {
    run: startedRun,
    phases: [],
    observations: [],
    curated: [],
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
    warnings: [],
    durationMs: 0,
  };

  // Collected whether or not anything reads it, because the phases are where the information
  // is and threading it out conditionally is how a debugging flag ends up logging half a run.
  const applied: AppliedChange[] = [];

  try {
    // A selected inference or curation phase still gets the same safety boundary as a full run.
    // It does not add a second visible phase to the report; it supplies that phase's prerequisites.
    if (
      options.phase &&
      options.phase !== 'conflicts' &&
      ['observe', 'reflect', 'curate'].includes(options.phase) &&
      cycle.config.maintenance.conflicts.enabled
    ) {
      await inspectConflicts(cycle, report);
    }
    for (const phase of wanted) {
      const phaseStarted = performance.now();
      const skipped = await runPhase(cycle, phase, options, report, applied);
      report.phases.push({
        phase,
        ran: skipped === null,
        ...(skipped ? { skipped } : {}),
        durationMs: Math.round(performance.now() - phaseStarted),
      });
    }

    report.durationMs = Math.round(performance.now() - started);

    if (ctx.config.maintenance.logChanges) {
      const logPath = await logDreamRun(ctx, report, applied, { dryRun: options.dryRun ?? false });
      if (logPath) report.logPath = logPath;
    }
    report.run = completeDreamRun(ctx, startedRun, report);
    return report;
  } catch (error) {
    report.durationMs = Math.round(performance.now() - started);
    report.run = failDreamRun(ctx, startedRun, error, report.durationMs, report.phases);
    throw error;
  }
}

function dreamRunMode(ctx: AknoContext, options: DreamOptions): DreamRunMode {
  if (options.dryRun) return 'audit';
  if (options.mode) return options.mode;
  if (options.phase === 'adopt') return ctx.config.maintenance.adopt.mode ?? 'legacy';
  if (!options.phase) {
    return ctx.config.maintenance.curate.mode ?? ctx.config.maintenance.adopt.mode ?? 'legacy';
  }
  if (options.phase === 'curate') return ctx.config.maintenance.curate.mode ?? 'legacy';
  return 'legacy';
}

async function runPhase(
  ctx: AknoContext,
  phase: DreamPhase,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
): Promise<string | null> {
  switch (phase) {
    case 'observe': {
      if (!ctx.config.maintenance.observe.enabled) return 'disabled in config';
      if (!ctx.models.derive.available) {
        return `no model for the cycle: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`;
      }
      await observePhase(ctx, options, report, applied);
      return null;
    }
    case 'reflect': {
      // Reflect ships as an extension point, off by default. At a few hundred pages a
      // "pattern" is one coincidence away from noise, so the default is not a placeholder —
      // it is the recommendation.
      if (!ctx.config.maintenance.reflect.enabled) {
        return 'off by default — enable it once the knowledge base has the volume for it';
      }
      if (!ctx.models.derive.available) {
        return `no model for the cycle: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`;
      }
      await reflectPhase(ctx, options, report, applied);
      return null;
    }
    case 'curate': {
      if (!ctx.config.maintenance.curate.enabled) return 'disabled in config';
      // A configured mode is how a full scheduled run gets plan-backed curation without
      // turning the scheduler into a curate-only command. An explicit dry run keeps its
      // existing read-only path; creating a durable plan needs the service's write handle.
      const mode = options.mode ?? (options.dryRun ? null : ctx.config.maintenance.curate.mode);
      if (!ctx.models.derive.available && !mode) {
        return `no model for the cycle: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`;
      }
      if (mode) {
        // Reuse every unfinished plan, not only autonomous ones. Re-running audit or review must
        // not spend another model call to rediscover a decision already waiting in the queue.
        let plan = findActiveMaintenancePlan(ctx, mode, 'curate');
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
          const contradictionResult = ctx.config.maintenance.conflicts.resolve
            ? await planContradictions(ctx, report.conflicts)
            : { drafts: [], warnings: [] };
          report.warnings.push(...contradictionResult.warnings);
          const linkResult = ctx.config.maintenance.repair.links
            ? await planBrokenLinks(ctx, ctx.config.maintenance.repair.maxChanges)
            : { drafts: [], report: { links: [], claims: [], declined: [] } };
          report.repaired = linkResult.report;
          const result = ctx.models.derive.available
            ? await curatePages(ctx, {
                dryRun: true,
                // Planning may update derived curation fingerprints even though it cannot touch KB
                // bytes. Persisting unchanged and guard-rejected inputs is what makes the next cycle
                // converge; staged pages remain `preview` until their durable item is decided.
                recordState: true,
                includePreviewed: true,
              })
            : {
                pages: [],
                drafts: [],
                warnings: [
                  `page transformations were skipped because no maintenance model is available: ${ctx.models.derive.unavailableReason ?? 'unavailable'}`,
                ],
              };
          report.curated = result.pages;
          report.warnings.push(...result.warnings);
          // A contradiction item has priority over a general synthesis of the same page. Two
          // sealed items replacing one input would make the second stale by construction.
          const contradictionPaths = new Set(
            contradictionResult.drafts.flatMap((draft) =>
              draft.operations.map((operation) => operation.relPath),
            ),
          );
          const linkDrafts: BrokenLinkDraft[] = [];
          const linkMutations = new Set(contradictionPaths);
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
          const protectedPaths = new Set([...contradictionPaths, ...linkDrafts.flatMap(linkDraftPaths)]);
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
          plan = createCurationPlan(ctx, mode, curationDrafts, contradictionResult.drafts, linkDrafts);
        }
        if (!plan) return null;
        if (mode === 'auto') {
          if (plan.items.some((item) => item.status === 'proposed')) {
            plan = await decideMaintenancePlanWithCurator(ctx, plan.id);
          }
          if (
            plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))
          ) {
            const appliedResult = await applyMaintenancePlan(ctx, plan.id);
            plan = appliedResult.plan;
            applied.push(...appliedResult.files.map((file) => asApplied('curate', file)));
          }
        }
        report.curated = report.curated.map((page) => {
          const item = plan.items.find(
            (candidate) => isGeneralCurationItem(candidate) && candidate.subject === page.slug,
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
        report.repaired = repairResultFromPlan(plan, report.repaired?.declined ?? []);
        recordMaintenancePlan(report, plan);
        return null;
      }
      const result = await curatePages(ctx, {
        dryRun: (options.dryRun ?? false) || !ctx.config.maintenance.curate.write,
        // An explicit dry run is observational. A scheduled preview, however, records that its
        // exact inputs were considered so the same page is not sent to the model every night.
        recordState: !(options.dryRun ?? false),
      });
      report.curated = result.pages;
      report.curateChangeId = result.changeId;
      report.warnings.push(...result.warnings);
      applied.push(...result.files.map((file) => asApplied('curate', file)));
      return null;
    }
    case 'adopt': {
      if (!ctx.config.maintenance.adopt.enabled) return 'disabled in config';
      const result = await planOrphanAdoptions(ctx, {
        limit: ctx.config.maintenance.adopt.maxPages,
      });
      report.adopted = result.adopted;
      if (options.dryRun) return null;
      const mode = options.mode ?? ctx.config.maintenance.adopt.mode;
      if (!mode) return null;

      let plan = findActiveMaintenancePlan(ctx, mode, 'adopt');
      if (!plan && result.drafts.length > 0) {
        plan = createAdoptionPlan(ctx, mode, result.drafts, report.run.snapshot);
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
      if (mode === 'auto') {
        if (plan.items.some((item) => item.status === 'proposed')) {
          plan = await decideMaintenancePlanWithCurator(ctx, plan.id);
        }
        if (
          plan.items.some((item) => ['approved', 'applying', 'verification_pending'].includes(item.status))
        ) {
          const appliedResult = await applyMaintenancePlan(ctx, plan.id);
          plan = appliedResult.plan;
          applied.push(...appliedResult.files.map((file) => asApplied('adopt', file)));
        }
      }
      report.adopted = report.adopted.map((entry) => {
        if (entry.action !== 'planned') return entry;
        const item = plan!.items.find((candidate) => candidate.subject === entry.slug);
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
      await inspectConflicts(ctx, report);
      return null;
    }
    case 'repair': {
      if (!ctx.config.maintenance.repair.enabled) return 'disabled in config';
      return repairPhase(ctx, report);
    }
    case 'housekeeping': {
      report.housekeeping = housekeeping(ctx);
      return null;
    }
  }
}

async function inspectConflicts(ctx: AknoContext, report: DreamReport): Promise<void> {
  const candidates = findCrossPageConflicts(ctx, ctx.config.maintenance.conflicts.maxPairs);
  if (!ctx.config.maintenance.conflicts.verify) {
    report.conflicts = candidates;
    return;
  }
  const verified = await verifyConflicts(ctx, candidates);
  report.conflicts = verified.conflicts;
  report.warnings.push(...verified.warnings);
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
  return item.kind !== 'contradiction' && item.kind !== 'broken_link' && item.kind !== 'adopt';
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
      risk: item.risk,
      subject: item.subject,
      status: item.status,
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

// ─── Observe ────────────────────────────────────────────────────────────────

interface SubjectGroup {
  subject: string;
  /** Top-level folder the facts came from, or `.` for pages at the root. */
  folder: string;
  /** Basename of the observations page this group writes to. */
  slug: string;
  facts: { claim: string; slug: string }[];
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
): Promise<void> {
  const groups = subjectGroups(ctx, ctx.config.maintenance.observe.maxSubjects, report.conflicts);
  if (groups.length === 0) return;

  const written: ObservationWritten[] = [];
  const files: ChangeFile[] = [];

  // Gathered once for the whole phase, not per group: fifteen groups reading the same two things
  // fifteen times is the same answer at fifteen times the cost.
  const knownFacts = liveFactClaims(ctx, report.conflicts);
  const observationsBySlug = await allObservations(ctx);

  for (const group of groups) {
    const result = await runObserveMission({
      // The folder travels with the subject so the model knows what kind of thing it is
      // looking at: "price, in shopping" is a question; "price" on its own is a word.
      subject: group.folder === '.' ? group.subject : `${group.subject}, in ${group.folder}`,
      facts: group.facts,
      model: ctx.models.derive,
      mission: ctx.config.maintenance.observe.mission,
      minEvidence: ctx.config.maintenance.observe.minEvidence,
      // What last night already concluded about this subject. The facts rarely change between one
      // night and the next, so without this the same insight comes back reworded every night and
      // the page accumulates paraphrases of one sentence.
      existing: observationsBySlug.get(observationSlug(ctx, group.slug)) ?? [],
      // Everything already observed elsewhere, plus anything written earlier in this same run —
      // two groups can reach one conclusion from overlapping facts, and each would otherwise write
      // it to its own page where neither looks like a duplicate.
      otherObservations: [...observationsBySlug].flatMap(([slug, lines]) =>
        slug === observationSlug(ctx, group.slug) ? [] : lines,
      ),
      knownFacts,
    });

    if (result.error) {
      report.warnings.push(`observe (${group.subject}): ${result.error}`);
      continue;
    }
    report.rejected.push(...result.rejected);

    for (const observation of result.observations) {
      const outcome = await writeObservation(
        ctx,
        { title: group.subject, slug: group.slug },
        observation,
        options.dryRun ?? false,
      );
      written.push(outcome.written);
      // So a later group in this same run sees it. Without this, cross-page duplicates are caught
      // only from the second night onwards — the night they are created, they both go through.
      const slug = observationSlug(ctx, group.slug);
      observationsBySlug.set(slug, [...(observationsBySlug.get(slug) ?? []), observation.pattern]);
      if (outcome.file) {
        files.push(outcome.file);
        applied.push(asApplied('observe', outcome.file));
      }
    }
  }

  report.observations.push(...written);
  if (files.length === 0) return;

  // One change for the whole phase: undoing a night's observations is one decision, not
  // fourteen. The timeline ledger is untouched — an inference is not something that happened.
  report.changeId = ctx.journal.record({
    actor: 'agent',
    op: 'write',
    summary: `observe: ${files.length} observation page(s)`,
    files,
  });
  await ctx.indexer.run({ only: files.map((file) => file.relPath) });
}

/**
 * Live facts from knowledge, non-observation pages, grouped by **folder and subject**.
 *
 * Not by subject alone, which is what the first version did and what a real knowledge base
 * immediately exposed. A small deriver writes the *attribute* into `subject` — "price",
 * "address", "location", "opening hours" — so grouping on it joined a bag with a drum kit
 * ("Price is $79 during sales"), and a Roman church with a person's page ("Address is central
 * and near a major landmark"). Given unrelated facts under one heading, the model does what it
 * is asked and finds a pattern across them; the input was the bug.
 *
 * A folder is the coarsest thing in a knowledge base that means "these are about the same kind
 * of thing", and it is the user's own division rather than one Akno invented. Two pages in
 * `shopping/` sharing a subject are at least comparable. Ordered by how recently the pages were
 * touched, so a capped run looks at what is moving.
 */
function subjectGroups(
  ctx: AknoContext,
  maxSubjects: number,
  conflicts: CrossPageConflict[],
): SubjectGroup[] {
  const observations = ctx.config.paths.observations;
  const ineligible = ineligibleConflictClaims(conflicts);
  const rows = ctx.store.db
    .prepare(
      `SELECT f.subject, f.claim, f.line_start, p.slug, p.updated_at
         FROM facts f JOIN pages p ON p.id = f.page_id
        WHERE f.valid_to IS NULL
          AND f.subject IS NOT NULL
          AND f.confidence >= 0.5
          -- Only canonical claims. A source page is evidence someone else wrote.
          AND p.role = 'knowledge'
          -- Never self-feeding. An observation is not evidence for another observation.
          AND p.slug != ?
          AND p.slug NOT LIKE ?
        ORDER BY p.updated_at DESC`,
    )
    .all(observations, `${observations}/%`) as {
    subject: string;
    claim: string;
    line_start: number;
    slug: string;
    updated_at: string | null;
  }[];

  const groups = new Map<string, SubjectGroup>();
  for (const row of rows) {
    if (ineligible.has(claimKey(row.slug, row.line_start))) continue;
    const subject = row.subject.toLowerCase().replace(/\s+/g, ' ').trim();
    if (subject.length === 0) continue;
    const folder = row.slug.includes('/') ? row.slug.slice(0, row.slug.indexOf('/')) : '.';
    const key = `${folder}|${subject}`;

    const existing = groups.get(key);
    if (existing) {
      if (existing.facts.length < 30) existing.facts.push({ claim: row.claim, slug: row.slug });
    } else {
      groups.set(key, {
        subject: row.subject,
        folder,
        slug: folder === '.' ? slugify(subject) : `${slugify(folder)}-${slugify(subject)}`,
        facts: [{ claim: row.claim, slug: row.slug }],
      });
    }
  }

  return [...groups.values()]
    .filter((group) => new Set(group.facts.map((fact) => fact.slug)).size >= 2)
    .slice(0, maxSubjects);
}

/**
 * **Refine, never overwrite** — a changed pattern gets a new dated line. **Add and
 * refine, never delete** — a curator that can delete loses things nobody watched it delete.
 *
 * So the page is only ever appended to, and an observation already on it is left exactly as it
 * is. That is also what makes the phase safe to re-run: a second pass over unchanged facts
 * reports `unchanged` and writes nothing.
 */
/** Where a subject's observations live. */
function observationSlug(ctx: AknoContext, pageSlug: string): string {
  return normalizeSlug(`${ctx.config.paths.observations}/${pageSlug}`);
}

/**
 * Every observation already written, by page.
 *
 * Read from the files rather than the index because the index is a reading of the files and this
 * runs inside the same cycle that writes them.
 */
async function allObservations(ctx: AknoContext): Promise<Map<string, string[]>> {
  const root = path.join(ctx.config.aknoPath, ctx.config.paths.observations);
  const bySlug = new Map<string, string[]>();

  const entries = await fsp.readdir(root, { withFileTypes: true, recursive: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const abs = path.join(entry.parentPath ?? root, entry.name);
    // Skipped for the same reason `scanTree` and the watcher skip them: a dot path is
    // sync-client or editor state, not an observation. Checked on the whole relative
    // path rather than `entry.name`, because a recursive readdir reports a file inside
    // `.trash/` with a perfectly ordinary basename. It also has to happen before
    // `normalizeSlug` below, which now refuses a dot segment — an unfiltered walk would
    // turn one stray `.backup.md` into a throw inside the nightly cycle.
    if (
      path
        .relative(root, abs)
        .split(path.sep)
        .some((segment) => segment.startsWith('.'))
    ) {
      continue;
    }
    const body = await fsp.readFile(abs, 'utf8').catch(() => null);
    if (body === null) continue;

    const lines = body
      .split('\n')
      .filter((line) => /^- \d{4}-\d{2}-\d{2} — /.test(line))
      .map((line) =>
        line
          .replace(/^- \d{4}-\d{2}-\d{2} — /, '')
          .replace(/\s*\[\[[^\]]*\]\]/g, '')
          .trim(),
      )
      .filter(Boolean);
    if (lines.length === 0) continue;

    const relative = path.relative(ctx.config.aknoPath, abs).replace(/\.md$/, '');
    bySlug.set(normalizeSlug(relative), lines);
  }
  return bySlug;
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
       FROM facts f JOIN pages p ON p.id = f.page_id WHERE f.valid_to IS NULL`,
    )
    .all() as {
    claim: string;
    line_start: number;
    slug: string;
  }[];
  return rows.filter((row) => !ineligible.has(claimKey(row.slug, row.line_start))).map((row) => row.claim);
}

async function writeObservation(
  ctx: AknoContext,
  page: { title: string; slug: string },
  observation: ObservationCandidate,
  dryRun: boolean,
): Promise<{ written: ObservationWritten; file: ChangeFile | null }> {
  const slug = normalizeSlug(`${ctx.config.paths.observations}/${page.slug}`);
  const relPath = `${slug}.md`;
  const absPath = path.join(ctx.config.aknoPath, relPath);
  const existing = await fsp.readFile(absPath, 'utf8').catch(() => null);

  // A page is never evidence for itself, whichever caller got here. `reflect` reads the folder it
  // writes into, so it found `principles` among its own sources and cited it — and a claim offered
  // as its own support reads, later, as a claim with support.
  const evidence = observation.evidence.filter((cited) => normalizeSlug(cited) !== slug);
  if (evidence.length === 0) {
    return {
      written: { slug, pattern: observation.pattern, evidence: [], action: 'unchanged' },
      file: null,
    };
  }
  observation = { ...observation, evidence };

  if (existing !== null && existing.includes(observation.pattern)) {
    return {
      written: { slug, pattern: observation.pattern, evidence: observation.evidence, action: 'unchanged' },
      file: null,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  // Deliberately not `- **YYYY-MM-DD** |`, which is read as a timeline event anywhere it
  // appears. An inferred pattern is not something that happened on a date.
  const line = `- ${today} — ${observation.pattern} ${citation(observation.evidence)}`;

  const next =
    existing === null
      ? newObservationPage(page.title, observation, today)
      : appendObservation(existing, line, observation.evidence);

  const written: ObservationWritten = {
    slug,
    pattern: observation.pattern,
    evidence: observation.evidence,
    action: existing === null ? 'created' : 'refined',
  };
  if (dryRun) return { written, file: null };

  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  const result = await writeFileAtomic(ctx.config.aknoPath, relPath, next);
  return {
    written,
    file: {
      relPath,
      action: existing === null ? 'created' : 'modified',
      before: existing,
      after: result.after,
    },
  };
}

/**
 * `derived` and `evidence` are the two keys Akno writes on `observations/` pages it
 * authors. They are what makes an inference identifiable as one after the fact — by a reader,
 * by recall's ranking, and by the guard that refuses to feed observations back in.
 */
function newObservationPage(subject: string, observation: ObservationCandidate, today: string): string {
  const title = subject.charAt(0).toUpperCase() + subject.slice(1);
  return (
    `---\ntitle: ${title}\nderived: true\nevidence:\n${observation.evidence
      .map((slug) => `  - ${slug}`)
      .join('\n')}\n---\n\n` +
    `# ${title}\n\n` +
    `Patterns Akno inferred from pages listed as evidence. Not authored claims.\n\n` +
    `- ${today} — ${observation.pattern} ${citation(observation.evidence)}\n`
  );
}

/** Appends the new line and unions the evidence, leaving every existing line alone. */
function appendObservation(current: string, line: string, evidence: string[]): string {
  const merged = mergeEvidence(current, evidence);
  return `${merged.replace(/\s+$/, '')}\n${line}\n`;
}

function mergeEvidence(current: string, evidence: string[]): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(current);
  if (!match) return current;

  const front = match[1]!;
  const listed = new Set([...front.matchAll(/^\s*-\s*(\S+)\s*$/gm)].map((entry) => entry[1]!));
  const missing = evidence.filter((slug) => !listed.has(slug));
  if (missing.length === 0) return current;

  // Appended under the existing `evidence:` key, or added as one. Every other frontmatter key
  // is left byte for byte: that promise holds for pages Akno authors too.
  const added = missing.map((slug) => `  - ${slug}`).join('\n');
  const nextFront = /^evidence:/m.test(front)
    ? front.replace(/^(evidence:(?:\n\s*-\s*\S+)*)/m, `$1\n${added}`)
    : `${front}\nevidence:\n${added}`;
  return current.replace(match[0], `---\n${nextFront}\n---\n`);
}

function citation(evidence: string[]): string {
  return evidence.map((slug) => `[[${slug}]]`).join(' ');
}

function slugify(subject: string): string {
  return (
    subject
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'pattern'
  );
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
): Promise<void> {
  // The page this phase writes to is under `observations/` like everything it reads, so without
  // excluding it the tier feeds on its own output: from the second night onwards `principles` has a
  // summary, is selected as a source, and is cited as evidence for the principle it already
  // contains. A conclusion that is its own evidence is not a conclusion.
  const target = observationSlug(ctx, PRINCIPLES_SLUG);
  const observations = await allObservations(ctx);
  const ineligibleSources = ineligibleConflictSourceSlugs(report.conflicts);
  const rows = (
    ctx.store.db
      .prepare(
        `SELECT slug, summary, frontmatter FROM pages
        WHERE (slug = ? OR slug LIKE ?) AND slug != ? AND summary IS NOT NULL
        ORDER BY updated_at DESC LIMIT 40`,
      )
      .all(ctx.config.paths.observations, `${ctx.config.paths.observations}/%`, target) as {
      slug: string;
      summary: string;
      frontmatter: string;
    }[]
  ).filter((row) => !frontmatterEvidence(row.frontmatter).some((slug) => ineligibleSources.has(slug)));

  if (rows.length < 2) {
    report.warnings.push('reflect had fewer than two observations to build on — nothing was written');
    return;
  }

  const result = await runObserveMission({
    subject: 'decision principles',
    facts: rows.map((row) => ({ claim: row.summary, slug: row.slug })),
    model: ctx.models.derive,
    mission:
      ctx.config.maintenance.reflect.mission ??
      'State durable decision principles and long-term tendencies, not individual patterns.',
    // A tier further from the evidence needs more of it.
    minEvidence: Math.max(3, ctx.config.maintenance.observe.minEvidence),
    // This tier appends to one page every night from observations that rarely change, so without
    // its own previous answers it restates them — the same way `observe` did, one tier up.
    existing: observations.get(target) ?? [],
    // A principle that is one of the observation lines verbatim is not a tier above them. Its
    // sources here are page *summaries*, so the lines themselves are not otherwise checked.
    otherObservations: [...observations].flatMap(([slug, lines]) => (slug === target ? [] : lines)),
    // Nor a raw claim promoted to a principle. `facts` for this phase is the observations, so
    // without this the knowledge base's own facts are the one thing it is not compared against.
    knownFacts: liveFactClaims(ctx, report.conflicts),
  });

  if (result.error) {
    report.warnings.push(`reflect: ${result.error}`);
    return;
  }
  report.rejected.push(...result.rejected);

  const files: ChangeFile[] = [];
  for (const observation of result.observations) {
    const outcome = await writeObservation(
      ctx,
      { title: 'Principles', slug: PRINCIPLES_SLUG },
      observation,
      options.dryRun ?? false,
    );
    report.observations.push(outcome.written);
    if (outcome.file) {
      files.push(outcome.file);
      applied.push(asApplied('reflect', outcome.file));
    }
  }

  if (files.length === 0) return;
  report.changeId = ctx.journal.record({
    actor: 'agent',
    op: 'write',
    summary: `reflect: ${files.length} page(s)`,
    files,
  });
  await ctx.indexer.run({ only: files.map((file) => file.relPath) });
}

function ineligibleConflictSourceSlugs(conflicts: CrossPageConflict[]): Set<string> {
  const keys = ineligibleConflictClaims(conflicts);
  const slugs = new Set<string>();
  for (const conflict of conflicts) {
    for (const claim of conflict.claims) {
      if (keys.has(claimKey(claim.slug, claim.line))) slugs.add(claim.slug);
    }
  }
  return slugs;
}

function frontmatterEvidence(frontmatter: string): string[] {
  try {
    const value = JSON.parse(frontmatter) as { evidence?: unknown };
    return Array.isArray(value.evidence)
      ? value.evidence.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
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
