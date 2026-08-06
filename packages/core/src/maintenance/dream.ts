import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { AknoError } from '@akno/protocol';
import { writeFileAtomic } from '../write/atomic.ts';
import type { ChangeFile } from '../write/journal.ts';
import { normalizeSlug } from '../ops/write.ts';
import { runObserveMission, type ObservationCandidate } from './observe.ts';
import { findCrossPageConflicts, verifyConflicts, type CrossPageConflict } from './conflicts.ts';
import { housekeeping, type Housekeeping } from './housekeeping.ts';
import { ModelClient } from '../models/client.ts';
import { adoptOrphans, type AdoptedDocument } from './adopt.ts';

/**
 * §13. The maintenance cycle: three tiers, each with a configurable mission.
 *
 * ```
 * retain    Keep only long-term facts, decisions, preferences, proven experience.
 *    ↓
 * observe   Combine repeated facts into stable patterns and habits. Never restate the facts.
 *    ↓
 * reflect   Build behavioural models, decision principles, long-term strategy.
 * ```
 *
 * `retain` is not run from here: §13 says it is available **per-turn**, as the `remember` op,
 * "so the tier that needs to be fresh does not wait for a timer". A cycle that also re-ran it
 * would be curating a conversation nobody is having.
 *
 * **Phases are independent and each is safe to re-run.** That is a real constraint, not a
 * nicety — a maintenance pass is the one thing that runs unattended, so a second run must not
 * duplicate the first. Observations are matched by their pattern before being written, and
 * every phase reports rather than repairs unless writing is the phase's entire purpose.
 */

export type DreamPhase = 'observe' | 'reflect' | 'adopt' | 'conflicts' | 'housekeeping';

export const DREAM_PHASES: DreamPhase[] = ['observe', 'reflect', 'adopt', 'conflicts', 'housekeeping'];

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
  /** Candidates a guardrail refused, with the guard that refused them (§13). */
  rejected: { pattern: string; reason: string }[];
  /** Documents given a page of their own (§11), and any that were left alone. */
  adopted: AdoptedDocument[];
  conflicts: CrossPageConflict[];
  housekeeping: Housekeeping | null;
  changeId: string | null;
  /** The `adopt` phase's change, kept apart from observe's. */
  adoptChangeId: string | null;
  warnings: string[];
  durationMs: number;
}

export interface DreamOptions {
  /** One phase instead of every enabled one. */
  phase?: DreamPhase;
  /** Report what would be written without touching disk. */
  dryRun?: boolean;
}

export async function dream(ctx: AknoContext, options: DreamOptions = {}): Promise<DreamReport> {
  const started = performance.now();
  // §13's tiers run unattended and are worth a better model than per-turn work needs — measured:
  // the same observe pass over one knowledge base produced 15 candidates worth about four with a
  // local 3B, and 8 candidates with no guard violations at all with a strong one. When
  // `maintenance.model` is set, the whole cycle uses it and nothing else does.
  const cycle: AknoContext = ctx.config.maintenance.model
    ? { ...ctx, models: { ...ctx.models, chat: new ModelClient(ctx.config.maintenance.model) } }
    : ctx;
  const report: DreamReport = {
    phases: [],
    observations: [],
    rejected: [],
    adopted: [],
    conflicts: [],
    housekeeping: null,
    changeId: null,
    adoptChangeId: null,
    warnings: [],
    durationMs: 0,
  };

  const wanted = options.phase ? [options.phase] : DREAM_PHASES;
  for (const phase of wanted) {
    const phaseStarted = performance.now();
    const skipped = await runPhase(cycle, phase, options, report);
    report.phases.push({
      phase,
      ran: skipped === null,
      ...(skipped ? { skipped } : {}),
      durationMs: Math.round(performance.now() - phaseStarted),
    });
  }

  report.durationMs = Math.round(performance.now() - started);
  return report;
}

async function runPhase(
  ctx: AknoContext,
  phase: DreamPhase,
  options: DreamOptions,
  report: DreamReport,
): Promise<string | null> {
  switch (phase) {
    case 'observe': {
      if (!ctx.config.maintenance.observe.enabled) return 'disabled in config';
      if (!ctx.models.chat.available) {
        return `no chat model: ${ctx.models.chat.unavailableReason ?? 'unavailable'}`;
      }
      await observePhase(ctx, options, report);
      return null;
    }
    case 'reflect': {
      // §13: reflect ships as an extension point, off by default. At a few hundred pages a
      // "pattern" is one coincidence away from noise, so the default is not a placeholder —
      // it is the recommendation.
      if (!ctx.config.maintenance.reflect.enabled) {
        return 'off by default (§13) — enable it once the knowledge base has the volume';
      }
      if (!ctx.models.chat.available) {
        return `no chat model: ${ctx.models.chat.unavailableReason ?? 'unavailable'}`;
      }
      await reflectPhase(ctx, options, report);
      return null;
    }
    case 'adopt': {
      if (!ctx.config.maintenance.adopt.enabled) return 'disabled in config';
      const result = await adoptOrphans(ctx, {
        limit: ctx.config.maintenance.adopt.maxPages,
        dryRun: options.dryRun ?? false,
      });
      report.adopted = result.adopted;
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
 * §13's second tier, and the only phase that writes.
 *
 * The guards that need the knowledge base rather than the text are applied here, before the
 * model sees anything:
 *
 * - **`full` pages only.** A `reference` page is somebody else's words. "Maria prefers X"
 *   inferred from a marketing email she was cc'd on is exactly the failure this must not have.
 * - **Never self-feeding.** An observation is not admissible evidence for another observation.
 *   No inference cascades.
 */
async function observePhase(ctx: AknoContext, options: DreamOptions, report: DreamReport): Promise<void> {
  const groups = subjectGroups(ctx, ctx.config.maintenance.observe.maxSubjects);
  if (groups.length === 0) return;

  const written: ObservationWritten[] = [];
  const files: ChangeFile[] = [];

  for (const group of groups) {
    const result = await runObserveMission({
      // The folder travels with the subject so the model knows what kind of thing it is
      // looking at: "price, in shopping" is a question; "price" on its own is a word.
      subject: group.folder === '.' ? group.subject : `${group.subject}, in ${group.folder}`,
      facts: group.facts,
      chat: ctx.models.chat,
      mission: ctx.config.maintenance.observe.mission,
      minEvidence: ctx.config.maintenance.observe.minEvidence,
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
      if (outcome.file) files.push(outcome.file);
    }
  }

  report.observations.push(...written);
  if (files.length === 0) return;

  // One change for the whole phase: undoing a night's observations is one decision, not
  // fourteen. §10's ledger is untouched — an inference is not something that happened.
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
          -- §5: only claims. A reference page is evidence someone else wrote.
          AND p.class = 'full'
          -- §13: never self-feeding. An observation is not evidence for another observation.
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
 * §13: **refine, never overwrite** — a changed pattern gets a new dated line. **Add and
 * refine, never delete** — a curator that can delete loses things nobody watched it delete.
 *
 * So the page is only ever appended to, and an observation already on it is left exactly as it
 * is. That is also what makes the phase safe to re-run: a second pass over unchanged facts
 * reports `unchanged` and writes nothing.
 */
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

  if (existing !== null && existing.includes(observation.pattern)) {
    return {
      written: { slug, pattern: observation.pattern, evidence: observation.evidence, action: 'unchanged' },
      file: null,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  // Deliberately not `- **YYYY-MM-DD** |`, which §10 reads as a timeline event anywhere it
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
 * §4: `derived` and `evidence` are the two keys Akno writes on `observations/` pages it
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
  // is left byte for byte — §4's promise holds for pages Akno authors too.
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
 * §13's third tier — **off by default**, and shipped as an extension point rather than a
 * finished tier because at a few hundred pages a "pattern" is one coincidence away from noise.
 *
 * The plumbing is real: enabling it runs the observe writer over the tier above, so principles
 * are built from observations and the pages behind them. What it deliberately does not do is
 * invent a second set of guardrails — the same evidence floor, the same refusal to hedge, the
 * same append-only writing.
 */
async function reflectPhase(ctx: AknoContext, options: DreamOptions, report: DreamReport): Promise<void> {
  const rows = ctx.store.db
    .prepare(
      `SELECT slug, summary FROM pages
        WHERE (slug = ? OR slug LIKE ?) AND summary IS NOT NULL
        ORDER BY updated_at DESC LIMIT 40`,
    )
    .all(ctx.config.paths.observations, `${ctx.config.paths.observations}/%`) as {
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
    chat: ctx.models.chat,
    mission:
      ctx.config.maintenance.reflect.mission ??
      'State durable decision principles and long-term tendencies, not individual patterns.',
    // A tier further from the evidence needs more of it.
    minEvidence: Math.max(3, ctx.config.maintenance.observe.minEvidence),
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
      { title: 'Principles', slug: 'principles' },
      observation,
      options.dryRun ?? false,
    );
    report.observations.push(outcome.written);
    if (outcome.file) files.push(outcome.file);
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

/** Guard for the CLI: a phase name that is not one. */
export function parsePhase(value: string): DreamPhase {
  if ((DREAM_PHASES as string[]).includes(value)) return value as DreamPhase;
  throw new AknoError('invalid', `unknown phase '${value}' — expected one of ${DREAM_PHASES.join(', ')}`);
}
