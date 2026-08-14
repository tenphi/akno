import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { parseFrontmatter } from '../kb/frontmatter.ts';
import { AKNO_ITEM } from '../kb/page.ts';
import { parseJsonLoose } from '../models/client.ts';
import { missingNumericValues } from './repair.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import { sha256 } from '../store/ids.ts';

export interface CuratedPage {
  slug: string;
  mode: 'hygiene' | 'synthesize';
  action: 'would-update' | 'updated' | 'unchanged' | 'rejected';
  splits: string[];
  issues: string[];
}

export interface CurateResult {
  pages: CuratedPage[];
  files: ChangeFile[];
  changeId: string | null;
  warnings: string[];
}

interface PageRow {
  id: string;
  slug: string;
  rel_path: string;
  title: string;
  role: string;
  dream_management: 'hygiene' | 'synthesize';
  about: string;
  frontmatter: string;
  body_hash: string;
  curate_input_hash: string | null;
  curate_status: CurateStatus | null;
}

type CurateStatus = 'preview' | 'unchanged' | 'rejected' | 'applied';

interface EvidencePage {
  id: string;
  slug: string;
  summary: string | null;
  about: string;
  role: string;
  body_hash: string;
  facts: EvidenceFact[];
}

interface EvidenceFact {
  claim: string;
  subject: string | null;
  attribute: string | null;
  value: string | null;
  item_id: string | null;
}

interface ConflictEvidence {
  subject: string;
  attribute: string;
  claim: string;
  value: string;
  slug: string;
}

interface CurateState {
  pageId: string;
  inputHash: string;
  status: CurateStatus;
}

interface Draft {
  body?: unknown;
  splits?: unknown;
}

interface SplitDraft {
  suffix: string;
  title: string;
  body: string;
}

const HYGIENE_SYSTEM = `You are a conservative Markdown page hygienist. Reply with JSON only:
{"body":"the complete revised Markdown body"}

You may fix formatting, Markdown, grammar, awkward language and minor local organization. Preserve
the page's meaning and semantically equivalent top-level structure. Do not add facts. Do not remove
anything except exact duplicates. Keep every <!-- akno:item ... --> marker immediately before the
knowledge it identifies. Do not add frontmatter.`;

const SYNTHESIZE_SYSTEM = `You synthesize one canonical Markdown knowledge page from its current body
and linked evidence. Reply with JSON only:
{"body":"complete canonical Markdown body","splits":[{"suffix":"topic","title":"Title","body":"complete child body"}]}

You may fully rewrite and restructure the body. Accumulate knowledge by subject; link to evidence and
related pages in the sections they support instead of repeating whole source pages. Reorganize rather
than summarize: preserve every factual detail already in the canonical body, including dates, times,
prices, measurements, descriptions, access instructions and practical guidance. Numeric formatting and
sentence punctuation may change, but no value may disappear. Keep unresolved contradictions under
## Unresolved and do not choose a side without evidence. Keep every
<!-- akno:item ... --> marker exactly once, immediately before the knowledge it identifies. The
canonical page remains at its current slug. Suggest splits only for genuinely oversized, coherent
sections. Child suffixes are one lowercase hyphenated path segment. Do not add frontmatter.`;

const VERIFY_SYSTEM = `You verify an automatic Markdown rewrite. Reply with JSON only:
{"ok":true,"issues":[]}

Reject a hygiene rewrite if it changes meaning, loses non-duplicate knowledge, adds facts, or makes
more than minor structural changes. Reject a synthesis rewrite if it invents facts, loses supported
knowledge, hides a conflict, misattributes evidence, or creates an incoherent split. Stable item
markers are metadata, not prose, and must remain attached to their knowledge.`;

// Changing a prompt or a deterministic rule must invalidate the decisions made by its predecessor.
const CURATE_FINGERPRINT_VERSION = 2;

export async function curatePages(
  ctx: AknoContext,
  options: { dryRun: boolean; recordState: boolean },
): Promise<CurateResult> {
  const settings = ctx.config.maintenance.curate;
  const result: CurateResult = { pages: [], files: [], changeId: null, warnings: [] };
  const rows = ctx.store.db
    .prepare(
      `SELECT id, slug, rel_path, title, role, dream_management, about, frontmatter, body_hash,
              curate_input_hash, curate_status
         FROM pages
        WHERE dream_management IN ('hygiene', 'synthesize') AND role = 'knowledge'
        ORDER BY updated_at DESC, slug`,
    )
    .all() as PageRow[];

  let splitBudget = settings.maxSplits;
  let attempted = 0;
  const state = new Map<string, CurateState>();
  const staged: {
    row: PageRow;
    before: string;
    after: string;
    children: { relPath: string; content: string; slug: string }[];
    inputHash: string;
  }[] = [];

  for (const row of rows) {
    const evidence = row.dream_management === 'synthesize' ? evidenceFor(ctx, row) : [];
    const conflicts = row.dream_management === 'synthesize' ? conflictsFor(ctx, row.id) : [];
    const inputHash = curateInputHash(row, evidence, conflicts);
    if (!curationDue(row, inputHash, options.dryRun)) continue;
    if (attempted >= settings.maxPages) break;
    attempted++;

    const before = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (before === null) {
      result.warnings.push(`${row.slug}: could not read page`);
      continue;
    }
    const fm = parseFrontmatter(before);
    const body = before.slice(fm.bodyOffset);
    const prompt = row.dream_management === 'hygiene' ? HYGIENE_SYSTEM : SYNTHESIZE_SYSTEM;
    const draftResult = await ctx.models.derive.chat(
      [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content:
            `Slug: ${row.slug}\nTitle: ${row.title}\n\nCurrent body:\n${body.slice(0, 40_000)}` +
            (evidence.length
              ? `\n\nEvidence graph:\n${renderEvidence(evidence).join('\n\n').slice(0, 40_000)}`
              : '') +
            (conflicts.length ? `\n\nUnresolved conflicts:\n${renderConflicts(conflicts).join('\n')}` : ''),
        },
      ],
      { json: true, maxTokens: 8_000 },
    );
    const parsed = draftResult.ok && draftResult.value ? parseJsonLoose<Draft>(draftResult.value) : null;
    const nextBody = typeof parsed?.body === 'string' ? endWithNewline(parsed.body) : null;
    if (!nextBody) {
      const issue = draftResult.error ?? 'draft was not valid JSON with a body';
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        issues: [issue],
      });
      // Provider/transport failures are retryable. A successful model call that returned an
      // unusable draft is a completed rejection and should not burn another call next night.
      if (draftResult.ok) queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    const maySplit =
      row.dream_management === 'synthesize' && Buffer.byteLength(before) >= settings.splitAfterBytes;
    const splits = maySplit
      ? cleanSplits(
          parsed?.splits,
          Math.min(settings.maxChildrenPerPage, splitBudget),
          settings.splitSectionBytes,
        )
      : [];
    const deterministic = guardRewrite({
      mode: row.dream_management,
      before: body,
      after: nextBody,
      splits,
      conflicts,
    });
    if (deterministic.length > 0) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        issues: deterministic,
      });
      queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    const verified = await verifyDraft(ctx, row, body, nextBody, splits, evidence, conflicts);
    if (!verified.ok) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'rejected',
        splits: [],
        issues: verified.issues,
      });
      if (verified.cacheable) queueCurateState(state, row.id, inputHash, 'rejected');
      continue;
    }

    const children = splits.map((split) => {
      const slug = `${row.slug}/${split.suffix}`;
      return {
        slug,
        relPath: `${slug}.md`,
        content: childPage(split, row.slug),
      };
    });
    const after = before.slice(0, fm.bodyOffset) + nextBody;
    if (after === before && children.length === 0) {
      result.pages.push({
        slug: row.slug,
        mode: row.dream_management,
        action: 'unchanged',
        splits: [],
        issues: [],
      });
      queueCurateState(state, row.id, inputHash, 'unchanged');
      continue;
    }
    staged.push({ row, before, after, children, inputHash });
    splitBudget -= children.length;
    result.pages.push({
      slug: row.slug,
      mode: row.dream_management,
      action: options.dryRun ? 'would-update' : 'updated',
      splits: children.map((child) => child.slug),
      issues: [],
    });
  }

  if (options.dryRun) {
    for (const stage of staged) {
      queueCurateState(state, stage.row.id, stage.inputHash, 'preview');
    }
    if (options.recordState) persistCurateState(ctx, state.values());
    return result;
  }
  if (staged.length === 0) {
    if (options.recordState) persistCurateState(ctx, state.values());
    return result;
  }

  for (const stage of staged) {
    const main = await writeFileAtomic(ctx.config.aknoPath, stage.row.rel_path, stage.after);
    result.files.push(fileEntry(main));
    for (const child of stage.children) {
      const written = await writeFileAtomic(ctx.config.aknoPath, child.relPath, child.content);
      result.files.push(fileEntry(written));
    }
  }
  result.changeId = ctx.journal.record({
    actor: 'agent',
    op: 'curate',
    summary: `curate: ${staged.length} canonical page(s), ${settings.maxSplits - splitBudget} split(s)`,
    files: result.files,
  });
  const paths = result.files.map((file) => file.relPath);
  await ctx.indexer.run({ only: paths, modelPaths: [] });
  ctx.derive.schedule(paths);
  // The rewrite changes the canonical page's own hash. Record the post-write fingerprint or the
  // curator would interpret its own work as new input on the next cycle. New split children are
  // marked too, so creating one does not immediately enqueue it for another synthesis.
  for (const stage of staged) {
    for (const slug of [stage.row.slug, ...stage.children.map((child) => child.slug)]) {
      const refreshed = pageForSlug(ctx, slug);
      if (!refreshed) continue;
      const evidence = refreshed.dream_management === 'synthesize' ? evidenceFor(ctx, refreshed) : [];
      const conflicts = refreshed.dream_management === 'synthesize' ? conflictsFor(ctx, refreshed.id) : [];
      queueCurateState(state, refreshed.id, curateInputHash(refreshed, evidence, conflicts), 'applied');
    }
  }
  if (options.recordState) persistCurateState(ctx, state.values());
  return result;
}

function evidenceFor(ctx: AknoContext, page: PageRow): EvidencePage[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.id, p.slug, p.summary, p.about, p.role, p.body_hash FROM pages p
        WHERE p.id != ? AND (
          EXISTS (SELECT 1 FROM links l WHERE l.from_page = p.id AND l.to_page = ?)
          OR EXISTS (SELECT 1 FROM links l WHERE l.from_page = ? AND l.to_page = p.id)
          OR p.about LIKE ?
        ) ORDER BY p.slug COLLATE NOCASE LIMIT 30`,
    )
    .all(page.id, page.id, page.id, `%${JSON.stringify(page.slug).slice(1, -1)}%`) as Omit<
    EvidencePage,
    'facts'
  >[];
  const facts = ctx.store.db.prepare(
    `SELECT claim, subject, attribute, value, item_id FROM facts
      WHERE page_id = ? AND valid_to IS NULL
      ORDER BY line_start, id LIMIT 50`,
  );
  return rows.map((row) => ({
    ...row,
    facts: facts.all(row.id) as EvidenceFact[],
  }));
}

function conflictsFor(ctx: AknoContext, pageId: string): ConflictEvidence[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT f.subject, f.attribute, f.claim, f.value, p.slug FROM facts f
        JOIN pages p ON p.id = f.page_id
        WHERE f.valid_to IS NULL AND f.subject IS NOT NULL AND f.attribute IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM facts other
             WHERE other.valid_to IS NULL AND other.page_id != f.page_id
               AND lower(other.subject) = lower(f.subject)
               AND lower(other.attribute) = lower(f.attribute)
               AND other.value != f.value
          )
          AND (f.page_id = ? OR p.about LIKE (SELECT '%' || slug || '%' FROM pages WHERE id = ?))
        ORDER BY p.slug COLLATE NOCASE, f.subject COLLATE NOCASE, f.attribute COLLATE NOCASE, f.claim
        LIMIT 20`,
    )
    .all(pageId, pageId) as ConflictEvidence[];
  return rows;
}

async function verifyDraft(
  ctx: AknoContext,
  page: PageRow,
  before: string,
  after: string,
  splits: SplitDraft[],
  evidence: EvidencePage[],
  conflicts: ConflictEvidence[],
): Promise<{ ok: boolean; issues: string[]; cacheable: boolean }> {
  const result = await ctx.models.derive.chat(
    [
      { role: 'system', content: VERIFY_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({
          mode: page.dream_management,
          before,
          after,
          splits,
          evidence,
          conflicts,
        }).slice(0, 100_000),
      },
    ],
    { json: true, maxTokens: 1_200 },
  );
  if (!result.ok || !result.value) {
    return { ok: false, issues: [result.error ?? 'verification failed'], cacheable: false };
  }
  const parsed = parseJsonLoose<{ ok?: unknown; issues?: unknown }>(result.value);
  const issues = Array.isArray(parsed?.issues)
    ? parsed.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 12)
    : [];
  return {
    ok: parsed?.ok === true && issues.length === 0,
    issues: issues.length ? issues : ['verifier rejected rewrite'],
    cacheable: true,
  };
}

function guardRewrite(input: {
  mode: 'hygiene' | 'synthesize';
  before: string;
  after: string;
  splits: SplitDraft[];
  conflicts: ConflictEvidence[];
}): string[] {
  const issues: string[] = [];
  const combined = [input.after, ...input.splits.map((split) => split.body)].join('\n');
  const beforeItems = itemIds(input.before);
  const afterItems = itemIds(combined);
  if (beforeItems.size !== afterItems.size || [...beforeItems].some((id) => !afterItems.has(id))) {
    issues.push('stable item markers were lost, duplicated or changed');
  }
  const missingValues = missingNumericValues(input.before, combined);
  if (missingValues.length > 0) {
    const shown = missingValues.slice(0, 12).map((value) => JSON.stringify(value));
    const remainder = missingValues.length - shown.length;
    issues.push(
      `numeric/date/value tokens missing from rewrite: ${shown.join(', ')}` +
        (remainder > 0 ? ` (+${remainder} more)` : ''),
    );
    issues.push(...missingValueContexts(input.before, missingValues));
  }
  if (input.mode === 'hygiene') {
    const beforeH1 = firstH1(input.before);
    const afterH1 = firstH1(input.after);
    if (beforeH1 !== afterH1) issues.push('the page title/top-level heading changed');
    const ratio = input.after.length / Math.max(1, input.before.length);
    if (ratio < 0.6 || ratio > 1.4) issues.push('the hygiene rewrite changed the page size too drastically');
    if (input.splits.length > 0) issues.push('hygiene pages cannot split');
  }
  if (input.mode === 'synthesize' && input.conflicts.length > 0 && !/^##\s+Unresolved\s*$/im.test(combined)) {
    issues.push('known conflicts are not preserved under an Unresolved section');
  }
  return issues;
}

function missingValueContexts(body: string, values: string[]): string[] {
  const lines = body.split('\n');
  const contexts: string[] = [];
  for (const value of values.slice(0, 6)) {
    const index = lines.findIndex((line) => line.includes(value));
    if (index < 0) continue;
    const source = lines[index]!.trim().replace(/\s+/g, ' ');
    contexts.push(
      `source body line ${index + 1} for ${JSON.stringify(value)}: ${source.length > 240 ? `${source.slice(0, 237)}...` : source}`,
    );
  }
  return contexts;
}

function renderEvidence(evidence: EvidencePage[]): string[] {
  return evidence.map((row) => {
    const heading = `[[${row.slug}]]${row.summary ? ` — ${row.summary}` : ''}`;
    return row.facts.length
      ? `${heading}\n${row.facts.map((fact) => `- ${fact.claim}`).join('\n')}`
      : heading;
  });
}

function renderConflicts(conflicts: ConflictEvidence[]): string[] {
  return conflicts.map((row) => `${row.subject} / ${row.attribute}: ${row.claim} [[${row.slug}]]`);
}

function curateInputHash(page: PageRow, evidence: EvidencePage[], conflicts: ConflictEvidence[]): string {
  return sha256(
    JSON.stringify({
      version: CURATE_FINGERPRINT_VERSION,
      page: {
        slug: page.slug,
        title: page.title,
        role: page.role,
        mode: page.dream_management,
        about: page.about,
        frontmatter: page.frontmatter,
        bodyHash: page.body_hash,
      },
      // Hygiene deliberately has empty arrays here: its authority is confined to this page.
      evidence: evidence.map((row) => ({
        slug: row.slug,
        summary: row.summary,
        about: row.about,
        role: row.role,
        bodyHash: row.body_hash,
        facts: row.facts,
      })),
      conflicts,
    }),
  );
}

function curationDue(page: PageRow, inputHash: string, dryRun: boolean): boolean {
  if (page.curate_input_hash !== inputHash) return true;
  // A write-enabled pass must rerun a previously accepted preview once. Rejected and unchanged
  // inputs are already complete decisions, and applied input is current by definition.
  return !dryRun && page.curate_status === 'preview';
}

function queueCurateState(
  state: Map<string, CurateState>,
  pageId: string,
  inputHash: string,
  status: CurateStatus,
): void {
  state.set(pageId, { pageId, inputHash, status });
}

function persistCurateState(ctx: AknoContext, values: Iterable<CurateState>): void {
  const rows = [...values];
  if (rows.length === 0) return;
  const update = ctx.store.db.prepare(
    `UPDATE pages SET curate_input_hash = ?, curate_status = ?, curated_at = ? WHERE id = ?`,
  );
  const now = new Date().toISOString();
  ctx.store.transaction(() => {
    for (const row of rows) update.run(row.inputHash, row.status, now, row.pageId);
  });
}

function pageForSlug(ctx: AknoContext, slug: string): PageRow | null {
  return (
    (ctx.store.db
      .prepare(
        `SELECT id, slug, rel_path, title, role, dream_management, about, frontmatter, body_hash,
                curate_input_hash, curate_status
           FROM pages WHERE slug = ? AND role = 'knowledge'
             AND dream_management IN ('hygiene', 'synthesize')`,
      )
      .get(slug) as PageRow | undefined) ?? null
  );
}

function itemIds(text: string): Set<string> {
  const out = new Set<string>();
  for (const line of text.split('\n')) {
    const match = AKNO_ITEM.exec(line);
    if (match) {
      const id = match[1]!.trim().split(/\s+/)[0]!;
      if (out.has(id)) out.add(`duplicate:${id}`);
      else out.add(id);
    }
  }
  return out;
}

function firstH1(body: string): string | null {
  return (
    body
      .split('\n')
      .map((line) => /^#\s+(.+?)\s*$/.exec(line)?.[1] ?? null)
      .find(Boolean) ?? null
  );
}

function cleanSplits(value: unknown, limit: number, minBytes: number): SplitDraft[] {
  if (!Array.isArray(value) || limit <= 0) return [];
  const out: SplitDraft[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const suffix = typeof row.suffix === 'string' ? row.suffix.trim().toLowerCase() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const body = typeof row.body === 'string' ? endWithNewline(row.body) : '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(suffix) || !title || Buffer.byteLength(body) < minBytes) continue;
    out.push({ suffix, title, body });
    if (out.length >= limit) break;
  }
  return out;
}

function childPage(split: SplitDraft, canonicalSlug: string): string {
  return `---\ntitle: ${JSON.stringify(split.title)}\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n    dream: synthesize\n  about:\n    - ${JSON.stringify(canonicalSlug)}\n---\n\n${split.body}`;
}

function endWithNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}
