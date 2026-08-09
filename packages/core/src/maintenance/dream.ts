import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { AknoError } from '@akno/protocol';
import { writeFileAtomic } from '../write/atomic.ts';
import type { ChangeFile } from '../write/journal.ts';
import { normalizeSlug } from '../ops/write.ts';
import { normalizeLinkTarget } from '../kb/page.ts';
import { runObserveMission, type ObservationCandidate } from './observe.ts';
import {
  actionable,
  candidatesFor,
  chooseTargetForTesting as chooseTarget,
  preservesValues,
  rewriteAsHistoryForTesting as rewriteAsHistory,
  type RepairResult,
} from './repair.ts';
import { findCrossPageConflicts, verifyConflicts, type CrossPageConflict } from './conflicts.ts';
import { housekeeping, type Housekeeping } from './housekeeping.ts';
import { ModelClient } from '../models/client.ts';
import { adoptOrphans, type AdoptedDocument } from './adopt.ts';
import { addedLines, logDreamRun, type AppliedChange } from './log.ts';

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
 * every phase reports rather than repairs unless writing is the phase's entire purpose.
 */

export type DreamPhase = 'observe' | 'reflect' | 'adopt' | 'conflicts' | 'repair' | 'housekeeping';

/**
 * Order matters twice.
 *
 * `repair` runs **after `conflicts`**, because it acts on what that phase judged — without a verdict
 * there is nothing it may touch.
 *
 * It runs **before `housekeeping`**, so the report at the end of a run describes the knowledge base
 * as it now is. The other way round you would read "48 broken links" and "9 repaired" in one report
 * and have to subtract. `housekeeping` is not repair's work queue either: its lists are capped for
 * readability, so a phase that consumed them would silently stop at twenty.
 */
export const DREAM_PHASES: DreamPhase[] = [
  'observe',
  'reflect',
  'adopt',
  'conflicts',
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

export interface DreamReport {
  phases: PhaseReport[];
  observations: ObservationWritten[];
  /** Candidates a guardrail refused, with the guard that refused them. */
  rejected: { pattern: string; reason: string }[];
  /** Documents given a page of their own, and any that were left alone. */
  adopted: AdoptedDocument[];
  conflicts: CrossPageConflict[];
  /** What the repair phase changed, and what it refused to. */
  repaired: RepairResult | null;
  /** Its own change, kept apart from the others: one night's repairs undo together. */
  repairChangeId: string | null;
  housekeeping: Housekeeping | null;
  changeId: string | null;
  /** The `adopt` phase's change, kept apart from observe's. */
  adoptChangeId: string | null;
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
}

export async function dream(ctx: AknoContext, options: DreamOptions = {}): Promise<DreamReport> {
  const started = performance.now();
  // The tiers run unattended and are worth a better model than indexing needs — measured:
  // the same observe pass over one knowledge base produced 15 candidates worth about four with a
  // local 3B, and 8 candidates with no guard violations at all with a strong one. When
  // `maintenance.model` is set, the whole cycle uses it and nothing else does.
  const cycle: AknoContext = ctx.config.maintenance.model
    ? { ...ctx, models: { ...ctx.models, derive: new ModelClient(ctx.config.maintenance.model) } }
    : ctx;
  const report: DreamReport = {
    phases: [],
    observations: [],
    rejected: [],
    adopted: [],
    conflicts: [],
    repaired: null,
    repairChangeId: null,
    housekeeping: null,
    changeId: null,
    adoptChangeId: null,
    warnings: [],
    durationMs: 0,
  };

  // Collected whether or not anything reads it, because the phases are where the information
  // is and threading it out conditionally is how a debugging flag ends up logging half a run.
  const applied: AppliedChange[] = [];

  const wanted = options.phase ? [options.phase] : DREAM_PHASES;
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
  return report;
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
    case 'adopt': {
      if (!ctx.config.maintenance.adopt.enabled) return 'disabled in config';
      const result = await adoptOrphans(ctx, {
        limit: ctx.config.maintenance.adopt.maxPages,
        dryRun: options.dryRun ?? false,
      });
      report.adopted = result.adopted;
      applied.push(...result.files.map((file) => asApplied('adopt', file)));
      if (result.files.length > 0) {
        // Its own change, separate from observe's: adopting a document is a mechanical write
        // from what the file says, and undoing it should not also undo a night's inferences.
        report.adoptChangeId = ctx.journal.record({
          actor: 'agent',
          op: 'write',
          summary: `adopt: ${result.files.length} page(s) for documents that had none`,
          files: result.files,
        });
        // The documents as well as the new pages, forced: the whole point of the phase is that
        // the attachment gains an owner, and its bytes have not changed, so the stat fast path
        // would skip the one file whose ownership just became answerable. Ownership then
        // resolves the ordinary way — through the `![[…]]` embed the page carries — rather than
        // by writing `page_id` behind the indexer's back.
        const adoptedFiles = result.adopted
          .filter((entry) => entry.action === 'created')
          .flatMap((entry) => entry.files);
        await ctx.indexer.run({
          only: [...result.files.map((file) => file.relPath), ...adoptedFiles],
          reindexUnchanged: true,
        });
      }
      return null;
    }
    case 'conflicts': {
      if (!ctx.config.maintenance.conflicts.enabled) return 'disabled in config';
      const candidates = findCrossPageConflicts(ctx, ctx.config.maintenance.conflicts.maxPairs);
      if (ctx.config.maintenance.conflicts.verify) {
        const verified = await verifyConflicts(ctx, candidates);
        report.conflicts = verified.conflicts;
        report.warnings.push(...verified.warnings);
      } else {
        report.conflicts = candidates;
      }
      return null;
    }
    case 'repair': {
      if (!ctx.config.maintenance.repair.enabled) return 'disabled in config';
      return repairPhase(ctx, options, report, applied);
    }
    case 'housekeeping': {
      report.housekeeping = housekeeping(ctx);
      return null;
    }
  }
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
 * - **`full` pages only.** A `reference` page is somebody else's words. "Maria prefers X"
 *   inferred from a marketing email she was cc'd on is exactly the failure this must not have.
 * - **Never self-feeding.** An observation is not admissible evidence for another observation.
 *   No inference cascades.
 */
/**
 * Repoint every `[[link]]` on a page that resolves to the same target.
 *
 * Matched the way the indexer resolved it — case and separators normalized — because the file holds
 * what the author typed and the index holds what it meant. An alias (`[[target|shown]]`) keeps its
 * shown text: the address was broken, not the words around it.
 */
function replaceLink(text: string, from: string, brokenTarget: string, newTarget: string): string {
  const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = key(brokenTarget);

  const wikilinks = text.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (whole, target: string, alias?: string) =>
    key(target) === wanted ? `[[${newTarget}${alias ?? ''}]]` : whole,
  );

  // Markdown links too — `[Tasty](tasty.md)`. Two thirds of this knowledge base's broken links are
  // written that way, and a repairer that only knew wikilinks declined every one of them as "not on
  // the page", which was true and unhelpful.
  //
  // Their target is a path relative to the page holding it, so the replacement has to be recomputed
  // from where that page sits — writing the slug in verbatim would produce a link that resolves
  // somewhere else entirely.
  const folder = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
  return wikilinks.replace(/\]\(([^)\s]+)\)/g, (whole, target: string) => {
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) return whole;
    // Resolved by the indexer's own function, not a copy of it. A copy joined the page's folder
    // onto every target, where the real rule leaves a path containing a slash alone — so a link
    // written from the knowledge base root resolved to a slug that existed nowhere, and was
    // declined as "not on the page" on a page it was plainly on.
    if (key(normalizeLinkTarget(target, from)) !== wanted) return whole;

    // Written back the way it was written: a target relative to its page stays relative, one
    // written from the root stays written from the root. Rewriting the style as well as the
    // address makes a diff nobody asked for.
    const wasFolderRelative = target.startsWith('../') || target.startsWith('./') || !target.includes('/');
    return `](${wasFolderRelative ? relativeTo(folder, newTarget) : newTarget}.md)`;
  });
}

/** The path to write for `target` on a page living in `folder`. */
function relativeTo(folder: string, target: string): string {
  const from = folder ? folder.split('/') : [];
  const to = target.split('/');
  let shared = 0;
  while (shared < from.length && shared < to.length && from[shared] === to[shared]) shared += 1;
  const up = Array.from({ length: from.length - shared }, () => '..');
  return [...up, ...to.slice(shared)].join('/');
}

/**
 * Apply what the cycle found: repoint links whose page moved, and retire claims a newer one replaced.
 *
 * The two halves share a change so one night's repairs undo together, and share a ceiling so a run
 * that goes wrong goes wrong in a bounded way. Everything it refuses is reported with the reason —
 * a repair tier that silently skips things is indistinguishable from one that is broken.
 */
async function repairPhase(
  ctx: AknoContext,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
): Promise<string | null> {
  const settings = ctx.config.maintenance.repair;
  const result: RepairResult = { links: [], claims: [], declined: [] };
  // Edits are collected per file and written once: two links repaired on one page is one rewrite,
  // and interleaving reads and writes of the same file is how an edit gets lost.
  const edits = new Map<string, { relPath: string; before: string; after: string }>();

  const budget = () => result.links.length + result.claims.length < settings.maxChanges;

  const load = async (slug: string): Promise<{ relPath: string; text: string } | null> => {
    const row = ctx.store.db.prepare('SELECT rel_path FROM pages WHERE slug = ?').get(slug) as
      { rel_path: string } | undefined;
    if (!row) return null;
    const held = edits.get(slug);
    if (held) return { relPath: held.relPath, text: held.after };
    const text = await fsp.readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8').catch(() => null);
    return text === null ? null : { relPath: row.rel_path, text };
  };

  const stage = (slug: string, relPath: string, before: string, after: string): void => {
    const held = edits.get(slug);
    edits.set(slug, { relPath, before: held?.before ?? before, after });
  };

  if (settings.links) {
    const slugs = (ctx.store.db.prepare('SELECT slug FROM pages').all() as { slug: string }[]).map(
      (r) => r.slug,
    );
    // The same definition `housekeeping` reports on, embeds excluded — an embed is a file, not a
    // page reference, and repointing one at a page would be nonsense. The indexer never marks them
    // broken today, so this changes nothing now and stops the two phases disagreeing later about
    // what "a broken link" is.
    const broken = ctx.store.db
      .prepare(
        `SELECT DISTINCT p.slug AS from_slug, l.to_slug FROM links l
           JOIN pages p ON p.id = l.from_page
          WHERE l.broken = 1 AND l.kind != 'embed'`,
      )
      .all() as { from_slug: string; to_slug: string }[];

    for (const link of broken) {
      if (!budget()) break;
      const candidates = candidatesFor(link.to_slug, slugs);
      if (candidates.length === 0) {
        result.declined.push({ what: `[[${link.to_slug}]]`, reason: 'no page it could have meant' });
        continue;
      }

      // One candidate needs no model: there is only one page it could have been. Several is exactly
      // the judgement call a model is for — constrained to the list, so it can choose but not invent.
      const target =
        candidates.length === 1 ? candidates[0]! : await chooseTarget(ctx, link.to_slug, candidates);
      if (!target) {
        result.declined.push({
          what: `[[${link.to_slug}]]`,
          reason: `${candidates.length} candidates, none clearly right`,
        });
        continue;
      }

      const page = await load(link.from_slug);
      if (!page) continue;
      // The stored target is normalized; what is on the page is what the author typed —
      // `[[Family/Travel/2026/…]]` against a slug that lost its capitals. Rewriting only exact
      // matches left those as "not on the page", which is true and useless.
      const next = replaceLink(page.text, link.from_slug, link.to_slug, target);
      if (next === page.text) {
        result.declined.push({
          what: `[[${link.to_slug}]]`,
          reason: 'the link text is not on the page as written',
        });
        continue;
      }
      stage(link.from_slug, page.relPath, page.text, next);
      result.links.push({
        from: link.from_slug,
        brokenTarget: link.to_slug,
        newTarget: target,
        how: candidates.length === 1 ? 'unique' : 'model',
      });
    }
  }

  if (settings.conflicts) {
    for (const conflict of actionable(report.conflicts)) {
      if (!budget()) break;
      // `likelyCurrent` is the *slug* the model judged current, not the claim text.
      const onCurrentPage = conflict.claims.filter((claim) => claim.slug === conflict.likelyCurrent);
      const stale = conflict.claims.filter((claim) => claim.slug !== conflict.likelyCurrent);
      // Two claims on the page called current means the model named a page, not a sentence, and
      // there is no way to tell which of them replaced the other.
      if (onCurrentPage.length !== 1 || stale.length === 0) {
        result.declined.push({
          what: `${conflict.subject} / ${conflict.attribute}`,
          reason: 'which claim is current is ambiguous',
        });
        continue;
      }
      const current = onCurrentPage[0]!;

      for (const claim of stale) {
        if (!budget()) break;
        const page = await load(claim.slug);
        if (!page) continue;

        const lines = page.text.split('\n');
        const before = lines[claim.line - 1];
        // The line moved since it was indexed. Rewriting by line number alone would edit whatever is
        // there now, which is how a repair becomes damage.
        if (before === undefined || !before.includes(claim.value)) {
          result.declined.push({
            what: `${claim.slug}:${claim.line}`,
            reason: 'the line has changed since it was read',
          });
          continue;
        }

        const rewritten = await rewriteAsHistory(ctx, before, current.claim);
        if (!rewritten) {
          result.declined.push({
            what: `${claim.slug}:${claim.line}`,
            reason: 'no rewrite that kept the claim intact',
          });
          continue;
        }
        if (!preservesValues(before, rewritten)) {
          result.declined.push({
            what: `${claim.slug}:${claim.line}`,
            reason: 'the rewrite changed a value',
          });
          continue;
        }

        lines[claim.line - 1] = rewritten;
        stage(claim.slug, page.relPath, page.text, lines.join('\n'));
        result.claims.push({
          slug: claim.slug,
          line: claim.line,
          before,
          after: rewritten,
          supersededBy: `${current.slug}:${current.line}`,
        });
      }
    }
  }

  report.repaired = result;
  if (edits.size === 0 || options.dryRun) return null;

  const files: ChangeFile[] = [];
  for (const edit of edits.values()) {
    const written = await writeFileAtomic(ctx.config.aknoPath, edit.relPath, edit.after);
    files.push({ relPath: edit.relPath, action: 'modified', before: edit.before, after: written.after });
  }

  report.repairChangeId = ctx.journal.record({
    actor: 'agent',
    op: 'write',
    summary: `repair: ${result.links.length} link(s), ${result.claims.length} claim(s)`,
    files,
  });
  for (const file of files) applied.push(asApplied('repair', file));
  await ctx.indexer.run({ only: files.map((file) => file.relPath) });
  return null;
}

async function observePhase(
  ctx: AknoContext,
  options: DreamOptions,
  report: DreamReport,
  applied: AppliedChange[],
): Promise<void> {
  const groups = subjectGroups(ctx, ctx.config.maintenance.observe.maxSubjects);
  if (groups.length === 0) return;

  const written: ObservationWritten[] = [];
  const files: ChangeFile[] = [];

  // Gathered once for the whole phase, not per group: fifteen groups reading the same two things
  // fifteen times is the same answer at fifteen times the cost.
  const knownFacts = liveFactClaims(ctx);
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
 * Live facts from `full`, non-observation pages, grouped by **folder and subject**.
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
function subjectGroups(ctx: AknoContext, maxSubjects: number): SubjectGroup[] {
  const observations = ctx.config.paths.observations;
  const rows = ctx.store.db
    .prepare(
      `SELECT f.subject, f.claim, p.slug, p.updated_at
         FROM facts f JOIN pages p ON p.id = f.page_id
        WHERE f.valid_to IS NULL
          AND f.subject IS NOT NULL
          AND f.confidence >= 0.5
          -- Only claims. A reference page is evidence someone else wrote.
          AND p.class = 'full'
          -- Never self-feeding. An observation is not evidence for another observation.
          AND p.slug != ?
          AND p.slug NOT LIKE ?
        ORDER BY p.updated_at DESC`,
    )
    .all(observations, `${observations}/%`) as {
    subject: string;
    claim: string;
    slug: string;
    updated_at: string | null;
  }[];

  const groups = new Map<string, SubjectGroup>();
  for (const row of rows) {
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
function liveFactClaims(ctx: AknoContext): string[] {
  const rows = ctx.store.db.prepare('SELECT claim FROM facts WHERE valid_to IS NULL').all() as {
    claim: string;
  }[];
  return rows.map((row) => row.claim);
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
  const rows = ctx.store.db
    .prepare(
      `SELECT slug, summary FROM pages
        WHERE (slug = ? OR slug LIKE ?) AND slug != ? AND summary IS NOT NULL
        ORDER BY updated_at DESC LIMIT 40`,
    )
    .all(ctx.config.paths.observations, `${ctx.config.paths.observations}/%`, target) as {
    slug: string;
    summary: string;
  }[];

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
    knownFacts: liveFactClaims(ctx),
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
