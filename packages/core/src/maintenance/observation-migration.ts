import fsp from 'node:fs/promises';
import path from 'node:path';
import type { AknoContext } from '../context.ts';
import { parsePage } from '../kb/page.ts';
import {
  insertObservationBlock,
  observationBlock,
  observationId,
  observationMarkerIndexes,
} from '../observations/marker.ts';
import { proofGroupsForFact } from '../observations/projection.ts';
import { writeFileAtomic, restoreFile } from '../write/atomic.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';

export interface ObservationMigrationOptions {
  dryRun?: boolean;
}

export interface ObservationMigrationReport {
  status: 'ok' | 'partial' | 'noop';
  scannedPages: number;
  legacyMarkers: number;
  migrated: number;
  held: number;
  changedPaths: string[];
  changeIds: string[];
  dryRun: boolean;
}

const LEGACY_LINE = /^- (\d{4}-\d{2}-\d{2}) — (.+?)(\s+(?:\[\[[^\]]+\]\]\s*)+)$/;

/** Explicit, conservative migration. Ambiguous page-level citations stay readable in place. */
export async function migrateLegacyObservations(
  ctx: AknoContext,
  options: ObservationMigrationOptions = {},
): Promise<ObservationMigrationReport> {
  const dryRun = options.dryRun ?? false;
  const root = ctx.config.paths.observations.replace(/\.(md|markdown)$/i, '').replace(/\/+$/, '');
  const pages = ctx.store.db
    .prepare(
      `SELECT slug, rel_path, frontmatter FROM pages
        WHERE role = 'inference' AND (slug = ? OR slug LIKE ?) AND slug != ? ORDER BY slug`,
    )
    .all(root, `${root}/%`, `${root}/principles`) as {
    slug: string;
    rel_path: string;
    frontmatter: string;
  }[];
  const legacyPages = pages.filter((page) => {
    try {
      return (JSON.parse(page.frontmatter) as { derived?: unknown }).derived === true;
    } catch {
      return false;
    }
  });
  let legacyMarkers = 0;
  let migrated = 0;
  let held = 0;
  const changedPaths = new Set<string>();
  const changeIds: string[] = [];

  for (const page of legacyPages) {
    const initial = await fsp
      .readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8')
      .catch(() => null);
    if (initial === null) continue;
    const candidates = initial.split(/\r?\n/).filter((line) => LEGACY_LINE.test(line));
    legacyMarkers += candidates.length;
    for (const legacyLine of candidates) {
      const prepared = await prepareMigration(ctx, page.rel_path, legacyLine);
      if (!prepared) {
        held++;
        continue;
      }
      if (dryRun) {
        migrated++;
        prepared.paths.forEach((entry) => changedPaths.add(entry));
        continue;
      }
      const files: ChangeFile[] = [];
      try {
        const currentTarget = await fsp
          .readFile(path.join(ctx.config.aknoPath, prepared.targetRelPath), 'utf8')
          .catch(() => null);
        const currentLegacy = await fsp
          .readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8')
          .catch(() => null);
        if (currentTarget !== prepared.targetBefore || currentLegacy !== prepared.legacyBefore) {
          held++;
          continue;
        }
        if (prepared.targetAfter !== prepared.targetBefore) {
          files.push(
            fileEntry(
              await writeFileAtomic(ctx.config.aknoPath, prepared.targetRelPath, prepared.targetAfter),
            ),
          );
        }
        files.push(
          fileEntry(await writeFileAtomic(ctx.config.aknoPath, page.rel_path, prepared.legacyAfter)),
        );
        await ctx.indexer.runForeground({ only: prepared.indexPaths, modelPaths: [] });
        const projected = ctx.store.db
          .prepare(`SELECT eligible, source_slug, disposition FROM observation_entries WHERE id = ?`)
          .get(prepared.observationId) as
          { eligible: number; source_slug: string; disposition: string } | undefined;
        const indexedLegacy = await fsp
          .readFile(path.join(ctx.config.aknoPath, page.rel_path), 'utf8')
          .catch(() => null);
        const indexedTarget = await fsp
          .readFile(path.join(ctx.config.aknoPath, prepared.targetRelPath), 'utf8')
          .catch(() => null);
        if (
          !projected ||
          projected.eligible !== 1 ||
          projected.disposition !== 'active' ||
          projected.source_slug !== prepared.targetSlug ||
          indexedTarget === null ||
          !indexedTarget.replaceAll('\r\n', '\n').includes(prepared.block) ||
          indexedLegacy === null ||
          indexedLegacy.split(/\r?\n/).includes(legacyLine)
        ) {
          throw new Error('migrated observation did not pass projection verification');
        }
        const changeId = ctx.journal.record({
          actor: ctx.actor,
          op: 'migrate',
          summary: 'migrated one legacy observation onto its admitted subject page',
          files,
        });
        changeIds.push(changeId);
        migrated++;
        prepared.paths.forEach((entry) => changedPaths.add(entry));
        ctx.derive.schedule(prepared.paths);
      } catch (error) {
        for (const file of [...files].reverse()) {
          await restoreFile(ctx.config.aknoPath, file.relPath, file.before).catch(() => undefined);
        }
        await ctx.indexer.runForeground({ only: prepared.indexPaths, modelPaths: [] }).catch(() => undefined);
        throw error;
      }
    }
  }

  return {
    status: held > 0 ? 'partial' : migrated > 0 ? 'ok' : 'noop',
    scannedPages: legacyPages.length,
    legacyMarkers,
    migrated,
    held,
    changedPaths: [...changedPaths],
    changeIds,
    dryRun,
  };
}

async function prepareMigration(
  ctx: AknoContext,
  legacyRelPath: string,
  legacyLine: string,
): Promise<{
  targetRelPath: string;
  targetBefore: string;
  targetAfter: string;
  targetSlug: string;
  legacyBefore: string;
  legacyAfter: string;
  observationId: string;
  block: string;
  paths: string[];
  indexPaths: string[];
} | null> {
  const match = LEGACY_LINE.exec(legacyLine);
  if (!match) return null;
  const pattern = match[2]!.trim();
  const citations = [
    ...new Set([...match[3]!.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((entry) => entry[1]!)),
  ];
  if (citations.length < 2) return null;

  const facts: {
    id: string;
    slug: string;
    source_line_hash: string;
    page_id: string;
    item_id: string | null;
    subject_entity: string;
  }[] = [];
  for (const slug of citations) {
    const rows = ctx.store.db
      .prepare(
        `SELECT f.id, p.slug, f.source_line_hash, f.page_id, f.item_id, g.subject_entity
           FROM facts f JOIN pages p ON p.id = f.page_id
           JOIN graph_fact_status g ON g.fact_id = f.id
          WHERE p.slug = ? AND f.valid_to IS NULL AND p.role = 'knowledge'
            AND p.body_hash = p.derived_hash AND g.eligibility = 'eligible' AND g.traversable = 1`,
      )
      .all(slug) as typeof facts;
    // A page-level legacy citation cannot be upgraded by guessing which of several facts it meant.
    if (rows.length !== 1) return null;
    facts.push(rows[0]!);
  }
  const subjects = new Set(facts.map((fact) => fact.subject_entity));
  if (subjects.size !== 1) return null;
  const subject = facts[0]!.subject_entity;
  const entity = ctx.store.db
    .prepare(
      `SELECT p.id, p.slug, p.rel_path, p.title, p.observe_management
         FROM graph_entities e JOIN pages p ON p.id = e.canonical_page WHERE e.id = ?`,
    )
    .get(subject) as
    { id: string; slug: string; rel_path: string; title: string; observe_management: string } | undefined;
  if (!entity) return null;
  const topics = (
    ctx.store.db
      .prepare(
        `SELECT slug, rel_path, about FROM pages
          WHERE role = 'knowledge' AND observe_management = 'integrate' AND id != ?`,
      )
      .all(entity.id) as { slug: string; rel_path: string; about: string }[]
  ).filter((page) => (JSON.parse(page.about) as string[]).includes(entity.slug));
  const targets = entity.observe_management === 'integrate' ? [entity] : topics;
  if (targets.length !== 1) return null;
  const target = targets[0]!;

  const evidence = facts.map((fact) => ({
    factId: fact.id,
    sourceLineHash: fact.source_line_hash,
    proofGroups: [...proofGroupsForFact(ctx.store, fact.id, fact.page_id, fact.item_id)].sort(),
  }));
  if (evidence.some((entry) => entry.proofGroups.length === 0)) return null;
  const proofCount = new Set(evidence.flatMap((entry) => entry.proofGroups)).size;
  if (evidence.length > 12) return null;
  if (proofCount < Math.max(2, ctx.config.maintenance.observe.minEvidence)) return null;

  const targetBefore = await fsp
    .readFile(path.join(ctx.config.aknoPath, target.rel_path), 'utf8')
    .catch(() => null);
  const legacyBefore = await fsp
    .readFile(path.join(ctx.config.aknoPath, legacyRelPath), 'utf8')
    .catch(() => null);
  if (targetBefore === null || legacyBefore === null) return null;
  const id = observationId(subject, pattern);
  const block = observationBlock(
    { id, subject, disposition: 'active', evidence, proofCount },
    pattern,
    facts.map((fact) => fact.slug),
  );
  const targetPage = parsePage(target.rel_path, targetBefore);
  const targetLines = targetPage.lines.map((line) => line.replace(/\r$/, ''));
  const existingIndexes = observationMarkerIndexes(targetLines, id);
  if (existingIndexes.length > 1) return null;
  if (
    existingIndexes.length === 1 &&
    `${targetLines[existingIndexes[0]!]!}\n${targetLines[existingIndexes[0]! + 1] ?? ''}` !== block
  ) {
    return null;
  }
  const targetAfter =
    existingIndexes.length === 1 ? targetBefore : insertObservationBlock(targetBefore, block);
  if (targetAfter === null) return null;
  const legacyAfter = removeExactLine(legacyBefore, legacyLine);
  if (legacyAfter === null) return null;
  return {
    targetRelPath: target.rel_path,
    targetBefore,
    targetAfter,
    targetSlug: target.slug,
    legacyBefore,
    legacyAfter,
    observationId: id,
    block,
    paths: [...new Set([...(targetAfter === targetBefore ? [] : [target.rel_path]), legacyRelPath])],
    indexPaths: [...new Set([target.rel_path, legacyRelPath])],
  };
}

function removeExactLine(content: string, target: string): string | null {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const matches = lines.flatMap((line, index) => (line === target ? [index] : []));
  if (matches.length !== 1) return null;
  lines.splice(matches[0]!, 1);
  return lines.join(newline);
}
