import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { parseFrontmatter } from '../kb/frontmatter.ts';
import { AKNO_ITEM } from '../kb/page.ts';
import { parseJsonLoose } from '../models/client.ts';
import { preservesValues } from './repair.ts';
import { writeFileAtomic } from '../write/atomic.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';

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
related pages in the sections they support instead of repeating whole source pages. Keep unresolved
contradictions under ## Unresolved and do not choose a side without evidence. Keep every
<!-- akno:item ... --> marker exactly once, immediately before the knowledge it identifies. The
canonical page remains at its current slug. Suggest splits only for genuinely oversized, coherent
sections. Child suffixes are one lowercase hyphenated path segment. Do not add frontmatter.`;

const VERIFY_SYSTEM = `You verify an automatic Markdown rewrite. Reply with JSON only:
{"ok":true,"issues":[]}

Reject a hygiene rewrite if it changes meaning, loses non-duplicate knowledge, adds facts, or makes
more than minor structural changes. Reject a synthesis rewrite if it invents facts, loses supported
knowledge, hides a conflict, misattributes evidence, or creates an incoherent split. Stable item
markers are metadata, not prose, and must remain attached to their knowledge.`;

export async function curatePages(ctx: AknoContext, options: { dryRun: boolean }): Promise<CurateResult> {
  const settings = ctx.config.maintenance.curate;
  const result: CurateResult = { pages: [], files: [], changeId: null, warnings: [] };
  const rows = ctx.store.db
    .prepare(
      `SELECT id, slug, rel_path, title, role, dream_management, about FROM pages
        WHERE dream_management IN ('hygiene', 'synthesize') AND role = 'knowledge'
        ORDER BY updated_at DESC LIMIT ?`,
    )
    .all(settings.maxPages) as PageRow[];

  let splitBudget = settings.maxSplits;
  const staged: {
    row: PageRow;
    before: string;
    after: string;
    children: { relPath: string; content: string; slug: string }[];
  }[] = [];

  for (const row of rows) {
    const before = await fsp
      .readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8')
      .catch(() => null);
    if (before === null) {
      result.warnings.push(`${row.slug}: could not read page`);
      continue;
    }
    const fm = parseFrontmatter(before);
    const body = before.slice(fm.bodyOffset);
    const evidence = row.dream_management === 'synthesize' ? evidenceFor(ctx, row) : [];
    const conflicts = row.dream_management === 'synthesize' ? conflictsFor(ctx, row.id) : [];
    const prompt = row.dream_management === 'hygiene' ? HYGIENE_SYSTEM : SYNTHESIZE_SYSTEM;
    const draftResult = await ctx.models.derive.chat(
      [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content:
            `Slug: ${row.slug}\nTitle: ${row.title}\n\nCurrent body:\n${body.slice(0, 40_000)}` +
            (evidence.length ? `\n\nEvidence graph:\n${evidence.join('\n\n').slice(0, 40_000)}` : '') +
            (conflicts.length ? `\n\nUnresolved conflicts:\n${conflicts.join('\n')}` : ''),
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
      continue;
    }
    staged.push({ row, before, after, children });
    splitBudget -= children.length;
    result.pages.push({
      slug: row.slug,
      mode: row.dream_management,
      action: options.dryRun ? 'would-update' : 'updated',
      splits: children.map((child) => child.slug),
      issues: [],
    });
  }

  if (options.dryRun || staged.length === 0) return result;

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
  return result;
}

function evidenceFor(ctx: AknoContext, page: PageRow): string[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT DISTINCT p.slug, p.summary, p.about FROM pages p
        WHERE p.id != ? AND (
          EXISTS (SELECT 1 FROM links l WHERE l.from_page = p.id AND l.to_page = ?)
          OR EXISTS (SELECT 1 FROM links l WHERE l.from_page = ? AND l.to_page = p.id)
          OR p.about LIKE ?
        ) ORDER BY p.updated_at DESC LIMIT 30`,
    )
    .all(page.id, page.id, page.id, `%${JSON.stringify(page.slug).slice(1, -1)}%`) as {
    slug: string;
    summary: string | null;
    about: string;
  }[];
  return rows.map((row) => `[[${row.slug}]]${row.summary ? ` — ${row.summary}` : ''}`);
}

function conflictsFor(ctx: AknoContext, pageId: string): string[] {
  const rows = ctx.store.db
    .prepare(
      `SELECT f.subject, f.attribute, f.claim, p.slug FROM facts f
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
        LIMIT 20`,
    )
    .all(pageId, pageId) as { subject: string; attribute: string; claim: string; slug: string }[];
  return rows.map((row) => `${row.subject} / ${row.attribute}: ${row.claim} [[${row.slug}]]`);
}

async function verifyDraft(
  ctx: AknoContext,
  page: PageRow,
  before: string,
  after: string,
  splits: SplitDraft[],
  evidence: string[],
  conflicts: string[],
): Promise<{ ok: boolean; issues: string[] }> {
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
  if (!result.ok || !result.value) return { ok: false, issues: [result.error ?? 'verification failed'] };
  const parsed = parseJsonLoose<{ ok?: unknown; issues?: unknown }>(result.value);
  const issues = Array.isArray(parsed?.issues)
    ? parsed.issues.filter((issue): issue is string => typeof issue === 'string').slice(0, 12)
    : [];
  return {
    ok: parsed?.ok === true && issues.length === 0,
    issues: issues.length ? issues : ['verifier rejected rewrite'],
  };
}

function guardRewrite(input: {
  mode: 'hygiene' | 'synthesize';
  before: string;
  after: string;
  splits: SplitDraft[];
  conflicts: string[];
}): string[] {
  const issues: string[] = [];
  const combined = [input.after, ...input.splits.map((split) => split.body)].join('\n');
  const beforeItems = itemIds(input.before);
  const afterItems = itemIds(combined);
  if (beforeItems.size !== afterItems.size || [...beforeItems].some((id) => !afterItems.has(id))) {
    issues.push('stable item markers were lost, duplicated or changed');
  }
  if (!preservesValues(input.before, combined))
    issues.push('a numeric/date/value token changed or disappeared');
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
