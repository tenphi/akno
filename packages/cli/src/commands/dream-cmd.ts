import {
  AknoError,
  parsePhase,
  type DreamReport,
  type MaintenanceMode,
  type MaintenanceStatus,
} from '@tenphi/akno-core';
import { openOptionsFrom, parse } from '../args.ts';
import { runMaintenance, type MaintenanceWaitUpdate } from '../ops-handle.ts';
import { heading, json, kv, line, ms, style, truncate } from '../output.ts';
import { loadMaintenanceStatus, printMaintenanceStatus } from './plan-cmd.ts';

const DREAM_HELP = `akno dream [options]
akno dream status

  The maintenance cycle. Phases are selectable and safe to re-run.

    observe        Combine repeated facts into stable patterns. Writes pages under
                   observations/ with their evidence, and never restates a fact.
    reflect        Plan-backed decision principles built on observation-page evidence.
                   Off by default until the observation tier has enough repeated history.
    curate         Hygiene or full synthesis, only for pages that explicitly authorize it.
                   Runs a draft pass, a verification pass and deterministic guards.
    adopt          A page for a document that has none, written beside the file — so its
                   text can be returned at all. Honours \`ingest: "file"\`.
    conflicts      The thorough pass inline checking cannot do: facts from different
                   pages that state different values for the same thing.
    repair         Legacy report-only view of exact broken-link proposals. Durable fixes
                   are low-risk items in curate audit, review, or auto plans.
    housekeeping   Broken links, orphaned documents, pages that drifted from their rules.

  A full/scheduled run resolves the configured maintenance profile. audit plans only,
  review waits for human decisions, autonomous uses a separate curator and applies only
  accepted work, and custom preserves the phase-level settings.

  --phase <name>   Run one phase instead of every enabled one.
  --mode <policy>  audit | review | auto. May lower configured authority for one run;
                   it cannot raise it.
  --dry-run        Run selected checks and proposals; change no knowledge-base files.
  --private-details
                   Include page names, source excerpts, URLs and other private content in
                   terminal or JSON output. Default output is safe to retain and share.
  --json`;

export async function dreamCommand(argv: string[]): Promise<number> {
  const { values, positionals } = parse<{
    phase?: string;
    mode?: string;
    'dry-run': boolean;
    'private-details': boolean;
  }>(argv, {
    phase: { type: 'string' },
    mode: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'private-details': { type: 'boolean', default: false },
  });

  if (values.help) {
    line(DREAM_HELP);
    return 0;
  }

  if (positionals[0] === 'status' && positionals.length === 1) {
    const status = await loadMaintenanceStatus(values);
    if (values.json) json(status);
    else printMaintenanceStatus(status);
    return 0;
  }
  if (positionals.length > 0) {
    line(DREAM_HELP);
    return 1;
  }

  const phase = values.phase ? parsePhase(values.phase) : undefined;
  const mode = values.mode ? parseMode(values.mode) : undefined;
  const input = {
    ...(phase ? { phase } : {}),
    ...(mode ? { mode } : {}),
    ...(values['dry-run'] ? { dryRun: true } : {}),
  };

  // Through the service when one is running: it holds the write handle, and the cycle writes.
  // A second request on the same multiplexed connection reads content-free plan state while the
  // model call is pending, so a healthy multi-minute run no longer looks hung.
  const progress = values.json ? null : dreamProgressWriter(Date.now(), phase, mode);
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
    if (typed.code !== 'busy') throw typed;
    busy = typed;
  } finally {
    progress?.done();
  }

  if (busy) return reportActiveDream(busy, values);
  if (!report) throw new AknoError('internal', 'dream returned no report');

  if (values.json) {
    json(values['private-details'] ? report : safeDreamReport(report));
    return 0;
  }
  return printDream(report, values['private-details']);
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
  for (const phase of report.phases) {
    const label = phase.ran ? style.green('ran') : style.grey('skipped');
    const detail = phase.skipped ? style.grey(`  ${phase.skipped}`) : style.grey(`  ${ms(phase.durationMs)}`);
    line(`  ${phase.phase.padEnd(13)} ${label}${detail}`);
  }

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

  for (const plan of (report.maintenancePlans ?? []).length > 0
    ? report.maintenancePlans
    : report.maintenancePlan
      ? [report.maintenancePlan]
      : []) {
    heading(`Maintenance plan — ${plan.status}`);
    line(`  ${style.bold(plan.id)}  ${plan.mode}/${plan.phase}  ${style.grey(plan.summary)}`);
    const proposed = plan.items.filter((item) => item.status === 'proposed').length;
    const approved = plan.items.filter((item) => item.status === 'approved').length;
    const dependencyDeferred = plan.items.filter((item) => item.statusCode === 'dependency_conflict').length;
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
      ['broken links', house.counts.brokenLinks],
      ['orphaned documents', house.counts.orphanedDocuments],
      ['pages off their rules', house.counts.drift],
    ]);
    if (privateDetails) {
      for (const entry of house.orphanedDocuments.slice(0, 5)) {
        line(`  ${style.yellow('·')} ${entry.relPath}`);
        line(`    ${style.grey(entry.reason)}`);
      }
      for (const entry of house.drift.slice(0, 5)) {
        line(
          `  ${style.yellow('·')} ${entry.slug}  ${style.grey(`${entry.rule} expects ${entry.expected}, found ${entry.found}`)}`,
        );
      }
      if (house.brokenLinks.length > 0) {
        const shown = house.brokenLinks.slice(0, 5).map((link) => `${link.from} → ${link.to}`);
        line(`  ${style.grey(`links: ${shown.join(', ')}`)}`);
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
  return 0;
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
    maintenancePlan: report.maintenancePlan ? safeMaintenancePlan(report.maintenancePlan) : null,
    maintenancePlans: (report.maintenancePlans ?? []).map(safeMaintenancePlan),
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
    housekeeping: report.housekeeping?.counts ?? null,
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

function safeMaintenancePlan(plan: DreamReport['maintenancePlans'][number]): Record<string, unknown> {
  return {
    id: plan.id,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    mode: plan.mode,
    phase: plan.phase,
    status: plan.status,
    fingerprint: plan.fingerprint,
    counts: plan.counts,
    items: plan.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      policy: item.policy,
      risk: item.risk,
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
