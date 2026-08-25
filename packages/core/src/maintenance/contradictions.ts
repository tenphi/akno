import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { sha256 } from '../store/ids.ts';
import {
  preservesAuthoredTokens,
  preservesValues,
  rewriteAsHistoryForTesting as rewriteAsHistory,
} from './repair.ts';
import { explicitCurrentBoundary, type CrossPageConflict } from './conflicts.ts';
import { pageAllowsMaintenanceTransform } from './path-policy.ts';

interface ContradictionOperationDraft {
  slug: string;
  relPath: string;
  before: string;
  after: string;
}

export interface ContradictionDraft {
  kind: 'contradiction';
  outcome: 'superseded' | 'qualified' | 'unresolved';
  /** First replaced page; the generic plan contract uses it as the item subject. */
  slug: string;
  inputHash: string;
  conflictFingerprint: string;
  conflictSubject: string;
  conflictAttribute: string;
  likelyCurrent: string | null;
  operations: ContradictionOperationDraft[];
  claims: CrossPageConflict['claims'];
}

export interface ContradictionPlanResult {
  drafts: ContradictionDraft[];
  warnings: string[];
}

interface EligiblePage {
  slug: string;
  relPath: string;
  before: string;
}

/**
 * Build exact, reversible contradiction items from typed conflict records.
 *
 * Classification alone never writes. Every affected page must independently opt into full synthesis,
 * and completed/rejected work is remembered by the conflict fingerprint so an unchanged night converges.
 */
export async function planContradictions(
  ctx: AknoContext,
  conflicts: CrossPageConflict[],
): Promise<ContradictionPlanResult> {
  const drafts: ContradictionDraft[] = [];
  const warnings: string[] = [];

  for (const conflict of conflicts) {
    if (!['superseded', 'qualified', 'unresolved'].includes(conflict.verdict)) continue;
    if (alreadyHandled(ctx, conflict.fingerprint)) continue;

    const pages = await eligiblePages(ctx, conflict);
    if (!pages) {
      warnings.push(
        `contradiction ${shortFingerprint(conflict.fingerprint)} remains report-only because every affected page must be opted into dream: synthesize`,
      );
      continue;
    }

    const draft =
      conflict.verdict === 'superseded'
        ? await supersededDraft(ctx, conflict, pages)
        : conflict.verdict === 'qualified'
          ? qualifiedDraft(conflict, pages)
          : unresolvedDraft(conflict, pages);
    if (!draft) {
      warnings.push(
        `contradiction ${shortFingerprint(conflict.fingerprint)} could not produce a lossless guarded rewrite`,
      );
      continue;
    }
    drafts.push(draft);
  }

  return { drafts, warnings };
}

function qualifiedDraft(
  conflict: CrossPageConflict,
  pages: Map<string, EligiblePage>,
): ContradictionDraft | null {
  const qualification = conflict.qualification;
  if (!qualification) return null;
  const target = conflict.claims.find(
    (claim) => claim.slug === qualification.targetSlug && claim.line === qualification.targetLine,
  );
  const evidence = conflict.claims.find(
    (claim) => claim.slug === qualification.evidenceSlug && claim.line === qualification.evidenceLine,
  );
  if (!target || !evidence || target.slug === evidence.slug) return null;
  if (!evidence.claim.includes(qualification.scope) || !evidence.claim.includes(target.value)) return null;

  const page = pages.get(target.slug);
  if (!page) return null;
  const lines = page.before.split('\n');
  const beforeLine = lines[target.line - 1];
  if (beforeLine === undefined || !beforeLine.includes(target.value)) return null;
  const rewritten = qualifyLine(beforeLine, qualification.scope);
  if (
    !rewritten ||
    rewritten === beforeLine ||
    !rewritten.includes(qualification.scope) ||
    !preservesValues(beforeLine, rewritten) ||
    !preservesValues(rewritten, `${beforeLine} ${qualification.scope}`) ||
    !preservesAuthoredTokens(beforeLine, rewritten)
  ) {
    return null;
  }
  lines[target.line - 1] = rewritten;

  // Seal the distinct scope evidence as a no-op replacement. A concurrent edit to either the
  // broad claim or the statement proving its scope must stale the whole atomic item.
  const orderedPages = [page, ...[...pages.values()].filter((candidate) => candidate.slug !== target.slug)];
  const operations = orderedPages.map((candidate) => ({
    ...candidate,
    after: candidate.slug === target.slug ? lines.join('\n') : candidate.before,
  }));
  return asDraft(conflict, 'qualified', operations);
}

/** Add an evidence-backed scope without paraphrasing a single authored byte. */
function qualifyLine(line: string, scope: string): string | null {
  if (!scope || /[\r\n]/.test(scope)) return null;
  const match = /^(\s*(?:(?:>\s*)+)?(?:(?:[-+*]|\d+[.)])\s+)?)(\S.*)$/.exec(line);
  if (!match) return null;
  return `${match[1]}For ${scope}: ${match[2]}`;
}

function alreadyHandled(ctx: AknoContext, fingerprint: string): boolean {
  const row = ctx.store.db
    .prepare(
      `SELECT 1 AS present FROM maintenance_items
       WHERE kind = 'contradiction' AND input_hash = ? AND status IN ('applied', 'rejected')
       LIMIT 1`,
    )
    .get(fingerprint) as { present: number } | undefined;
  return row?.present === 1;
}

async function eligiblePages(
  ctx: AknoContext,
  conflict: CrossPageConflict,
): Promise<Map<string, EligiblePage> | null> {
  const pages = new Map<string, EligiblePage>();
  for (const slug of new Set(conflict.claims.map((claim) => claim.slug))) {
    const row = ctx.store.db
      .prepare(`SELECT slug, rel_path, role, dream_management FROM pages WHERE slug = ?`)
      .get(slug) as { slug: string; rel_path: string; role: string; dream_management: string } | undefined;
    if (
      !row ||
      !pageAllowsMaintenanceTransform(
        ctx.config,
        { slug: row.slug, role: row.role, dreamManagement: row.dream_management },
        'contradiction',
      )
    ) {
      return null;
    }
    const before = await fsp.readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8').catch(() => null);
    if (before === null) return null;
    pages.set(slug, { slug, relPath: row.rel_path, before });
  }
  return pages;
}

async function supersededDraft(
  ctx: AknoContext,
  conflict: CrossPageConflict,
  pages: Map<string, EligiblePage>,
): Promise<ContradictionDraft | null> {
  const current = conflict.claims.filter((claim) => claim.slug === conflict.likelyCurrent);
  const stale = conflict.claims.filter((claim) => claim.slug !== conflict.likelyCurrent);
  if (current.length !== 1 || stale.length === 0) return null;
  const boundary = explicitCurrentBoundary(current[0]!.claim);
  if (!boundary) return null;

  const afterBySlug = new Map([...pages].map(([slug, page]) => [slug, page.before]));
  for (const claim of stale) {
    const page = pages.get(claim.slug);
    const held = afterBySlug.get(claim.slug);
    if (!page || held === undefined) return null;
    const lines = held.split('\n');
    const beforeLine = lines[claim.line - 1];
    if (beforeLine === undefined || !beforeLine.includes(claim.value)) return null;

    const rewritten = await rewriteAsHistory(ctx, beforeLine, current[0]!.claim, boundary);
    if (
      !rewritten ||
      rewritten === beforeLine ||
      !rewritten.includes(boundary) ||
      !preservesValues(beforeLine, rewritten) ||
      !preservesValues(rewritten, `${beforeLine} ${boundary}`) ||
      !preservesAuthoredTokens(beforeLine, rewritten)
    ) {
      return null;
    }
    lines[claim.line - 1] = rewritten;
    afterBySlug.set(claim.slug, lines.join('\n'));
  }

  // The current page is sealed as a no-op replacement. That gives apply the same stale-byte check
  // for the evidence selecting the winner as for the line it rewrites; otherwise the "current"
  // claim could change after planning while the stale rewrite still applied.
  const operations = [...pages.values()].map((page) => ({
    ...page,
    after: afterBySlug.get(page.slug)!,
  }));
  return operations.some((operation) => operation.after !== operation.before)
    ? asDraft(conflict, 'superseded', operations)
    : null;
}

function unresolvedDraft(
  conflict: CrossPageConflict,
  pages: Map<string, EligiblePage>,
): ContradictionDraft | null {
  const markerId = shortFingerprint(conflict.fingerprint);
  const slugs = [...pages.keys()].sort();
  const label = `${safeLabel(conflict.subject)} / ${safeLabel(conflict.attribute)}`;
  const operations = [...pages.values()].map((page) => {
    const references = slugs
      .filter((slug) => slug !== page.slug)
      .map((slug) => `[[${slug}]]`)
      .join(', ');
    const block =
      `<!-- akno:conflict ${markerId} start -->\n` +
      `> [!warning] Unresolved memory conflict\n` +
      `> Akno found incompatible authored claims for **${label}** across this page and ${references}. ` +
      `Both claims remain; neither supports new inferences until resolved.\n` +
      `<!-- akno:conflict ${markerId} end -->`;
    return {
      ...page,
      after: page.before.includes(`<!-- akno:conflict ${markerId} start -->`)
        ? page.before
        : `${page.before.replace(/\s+$/, '')}\n\n${block}\n`,
    };
  });
  return operations.some((operation) => operation.after !== operation.before)
    ? asDraft(conflict, 'unresolved', operations)
    : null;
}

function asDraft(
  conflict: CrossPageConflict,
  outcome: ContradictionDraft['outcome'],
  operations: ContradictionOperationDraft[],
): ContradictionDraft {
  return {
    kind: 'contradiction',
    outcome,
    slug: operations[0]!.slug,
    inputHash: conflict.fingerprint,
    conflictFingerprint: conflict.fingerprint,
    conflictSubject: conflict.subject,
    conflictAttribute: conflict.attribute,
    likelyCurrent: conflict.likelyCurrent ?? null,
    operations,
    claims: conflict.claims,
  };
}

function safeLabel(value: string): string {
  return (
    value
      .replace(/[\r\n<>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'unknown field'
  );
}

function shortFingerprint(value: string): string {
  return sha256(value).slice(0, 12);
}
