import fsp from 'node:fs/promises';
import type { AknoContext } from '../context.ts';
import { indexScanIgnore } from '../config/load.ts';
import { scanTree } from '../kb/scan.ts';
import { parseFrontmatter } from '../kb/frontmatter.ts';
import { sha256 } from '../store/ids.ts';
import { restoreFile, writeFileAtomic } from '../write/atomic.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import {
  managedMemoryFingerprint,
  parseManagedMemoryMarker,
  renderManagedMemoryMarker,
  renderManagedMemoryPayload,
  type ManagedMemoryMarker,
} from '../write/managed-memory.ts';

export interface BrainMigrationOptions {
  dryRun?: boolean;
}

export interface BrainMigrationReport {
  status: 'ok' | 'partial' | 'noop';
  scannedPages: number;
  legacyMarkers: number;
  migrated: number;
  held: number;
  changedPaths: string[];
  changeId?: string;
  dryRun: boolean;
}

interface MigratedSupport {
  itemId: string;
  sourceId: string;
  sourceRef: string;
  origin: 'user' | 'assistant' | 'unknown';
  receipt: string;
  candidate: string;
  proofGroup: string;
  inputHash: string;
  slug: string;
}

const LEGACY_MARKER =
  /^\s*<!--\s*akno:item\s+([A-Za-z0-9_-]{4,80})\s+source=([^\s]+)\s+origin=(user|assistant|unknown)\s*-->\s*$/i;
const MARKER_LIKE = /<!--\s*akno:item\b/i;
const HEADING_OR_COMMENT = /^\s*(?:<!--|#{1,6}(?:\s+|$))/;

/**
 * Upgrade brain bytes explicitly. The normal parser accepts v2 only; this file is the sole v1
 * decoder and is reachable only through the operator migration command.
 */
export async function migrateBrain(
  ctx: AknoContext,
  options: BrainMigrationOptions = {},
): Promise<BrainMigrationReport> {
  const dryRun = options.dryRun ?? false;
  const scanned = await scanTree({
    root: ctx.config.aknoPath,
    ignore: indexScanIgnore(ctx.config.ignore),
    pageExtensions: ctx.config.pageExtensions,
    maxPageBytes: ctx.config.maxPageBytes,
  });
  const pages = scanned.filter((file) => file.kind === 'page' && !file.dataless);
  const changes: { relPath: string; after: string; supports: MigratedSupport[] }[] = [];
  const readable: { relPath: string; before: string; slug: string }[] = [];
  const legacyIds = new Map<string, number>();
  let legacyMarkers = 0;
  let migrated = 0;
  let held = 0;

  for (const file of pages) {
    const before = await fsp.readFile(file.absPath, 'utf8').catch(() => null);
    if (before === null || !MARKER_LIKE.test(before)) continue;
    const slug = file.relPath.replace(/\.(md|markdown)$/i, '');
    readable.push({ relPath: file.relPath, before, slug });
    for (const line of before.split('\n')) {
      const match = LEGACY_MARKER.exec(line);
      if (match) legacyIds.set(match[1]!, (legacyIds.get(match[1]!) ?? 0) + 1);
    }
  }
  const duplicateIds = new Set([...legacyIds].filter(([, count]) => count > 1).map(([itemId]) => itemId));

  for (const page of readable) {
    const result = migratePage(page.before, page.slug, duplicateIds);
    legacyMarkers += result.legacy;
    migrated += result.supports.length;
    held += result.held;
    if (result.after !== page.before) {
      changes.push({ relPath: page.relPath, after: result.after, supports: result.supports });
    }
  }

  const base: BrainMigrationReport = {
    status: held > 0 && migrated > 0 ? 'partial' : migrated > 0 ? 'ok' : held > 0 ? 'partial' : 'noop',
    scannedPages: pages.length,
    legacyMarkers,
    migrated,
    held,
    changedPaths: changes.map((change) => change.relPath),
    dryRun,
  };
  if (dryRun || changes.length === 0) return base;

  const files: ChangeFile[] = [];
  let changeId: string;
  try {
    for (const change of changes) {
      files.push(fileEntry(await writeFileAtomic(ctx.config.aknoPath, change.relPath, change.after)));
    }
    changeId = ctx.journal.record({
      actor: ctx.actor,
      op: 'migrate',
      summary: `migrated ${migrated} managed memory item(s) to brain schema v2`,
      files,
    });
  } catch (error) {
    const failures: string[] = [];
    for (const file of [...files].reverse()) {
      try {
        await restoreFile(ctx.config.aknoPath, file.relPath, file.before);
      } catch (rollback) {
        failures.push(rollback instanceof Error ? rollback.message : String(rollback));
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `brain migration failed and rollback was incomplete: ${error instanceof Error ? error.message : String(error)}; ${failures.join('; ')}`,
        { cause: error },
      );
    }
    throw error;
  }
  try {
    persistMigrationReceipts(
      ctx,
      changes.flatMap((change) => change.supports),
      changeId,
    );
  } catch (error) {
    const failures: string[] = [];
    for (const file of [...files].reverse()) {
      try {
        await restoreFile(ctx.config.aknoPath, file.relPath, file.before);
      } catch (rollback) {
        failures.push(rollback instanceof Error ? rollback.message : String(rollback));
      }
    }
    if (failures.length === 0) {
      ctx.store.db
        .prepare("UPDATE changes SET status = 'undone', undone_at = ? WHERE id = ?")
        .run(new Date().toISOString(), changeId);
    }
    throw new Error(
      `brain migration receipt failed${
        failures.length > 0 ? ' and file rollback was incomplete' : '; brain bytes were rolled back'
      }: ${error instanceof Error ? error.message : String(error)}${
        failures.length > 0 ? `; ${failures.join('; ')}` : ''
      }`,
      { cause: error },
    );
  }
  const paths = changes.map((change) => change.relPath);
  await ctx.indexer.runForeground({ only: paths, modelPaths: [] });
  ctx.derive.schedule(paths);
  return { ...base, changeId };
}

function migratePage(
  content: string,
  slug: string,
  duplicateIds: ReadonlySet<string>,
): {
  after: string;
  legacy: number;
  held: number;
  supports: MigratedSupport[];
} {
  const frontmatter = parseFrontmatter(content);
  const prefix = content.slice(0, frontmatter.bodyOffset);
  const lines = content.slice(frontmatter.bodyOffset).split('\n');
  const supports: MigratedSupport[] = [];
  let legacy = 0;
  let held = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!MARKER_LIKE.test(line) || parseManagedMemoryMarker(line)) continue;
    legacy += 1;
    const match = LEGACY_MARKER.exec(line);
    if (!match) {
      held += 1;
      continue;
    }
    if (duplicateIds.has(match[1]!)) {
      held += 1;
      continue;
    }
    const sourceRef = decodeLegacySource(match[2]!);
    const payloadIndex = legacyPayloadIndex(lines, index);
    if (!sourceRef || payloadIndex === null) {
      held += 1;
      continue;
    }
    const itemId = match[1]!;
    const origin = match[3]!.toLowerCase() as MigratedSupport['origin'];
    const sourceId = `brain-migration:${itemId}`;
    const payload = lines[payloadIndex]!;
    const receipt = managedMemoryFingerprint(`migration-receipt:${itemId}:${sourceRef}`);
    const candidate = managedMemoryFingerprint(`migration-candidate:${itemId}:${payload}`);
    const proofGroup = managedMemoryFingerprint(`migration-proof:${sourceRef}`);
    const marker: ManagedMemoryMarker = {
      id: itemId,
      supports: [{ receipt, candidate, proofGroup, selection: 'extracted' }],
      kind: 'claim',
      subject: 'unresolved',
      sourceRole: origin,
      reporters: [],
      commitment: 'asserted',
      disposition: 'active',
      polarity: 'affirmed',
      basis: 'source_report',
      evidence: [],
      links: [],
    };
    lines[index] = renderManagedMemoryMarker(marker);
    lines[payloadIndex] = renderManagedMemoryPayload(payload, marker);
    supports.push({
      itemId,
      sourceId,
      sourceRef,
      origin,
      receipt,
      candidate,
      proofGroup,
      inputHash: sha256(`${sourceRef}\0${payload}`),
      slug,
    });
  }
  return { after: prefix + lines.join('\n'), legacy, held, supports };
}

function legacyPayloadIndex(lines: readonly string[], markerIndex: number): number | null {
  for (let index = markerIndex + 1; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.trim()) continue;
    if (MARKER_LIKE.test(line) || HEADING_OR_COMMENT.test(line)) return null;
    return index;
  }
  return null;
}

function decodeLegacySource(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded && !decoded.includes('\0') ? decoded : null;
  } catch {
    return null;
  }
}

function persistMigrationReceipts(
  ctx: AknoContext,
  supports: readonly MigratedSupport[],
  changeId: string,
): void {
  if (supports.length === 0) return;
  const createdAt = new Date().toISOString();
  ctx.store.transaction(() => {
    const receipt = ctx.store.db.prepare(
      `INSERT INTO retain_receipts(
         source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint,
         mode, result, change_id, created_at
       ) VALUES (?, 'v1', ?, ?, ?, ?, 'migration', ?, ?, ?)`,
    );
    const retainedSupport = ctx.store.db.prepare(
      `INSERT INTO retain_supports(
         receipt_fingerprint, candidate_id, candidate_fingerprint, proof_group, memory_id,
         slug, selection, source_ref, origin, input_hash, evidence, evidence_hash,
         retracted_by, forgotten_by
       ) VALUES (?, 'v1', ?, ?, ?, ?, 'extracted', ?, ?, ?, ?, ?, NULL, NULL)`,
    );
    for (const support of supports) {
      const archived = ctx.store.db
        .prepare('SELECT evidence, evidence_hash FROM managed_item_sources WHERE item_id = ?')
        .get(support.itemId) as { evidence: string; evidence_hash: string } | undefined;
      const evidence =
        archived && sha256(archived.evidence) === archived.evidence_hash ? archived.evidence : '';
      const result = JSON.stringify({
        source_id: support.sourceId,
        revision: 'v1',
        outcome: 'ok',
        candidates: [
          { candidate_id: 'v1', outcome: 'written', memory_id: support.itemId, slug: support.slug },
        ],
        change_id: changeId,
      });
      receipt.run(
        support.sourceId,
        support.inputHash,
        support.inputHash,
        support.sourceId,
        support.receipt,
        result,
        changeId,
        createdAt,
      );
      retainedSupport.run(
        support.receipt,
        support.candidate,
        support.proofGroup,
        support.itemId,
        support.slug,
        support.sourceRef,
        support.origin,
        support.inputHash,
        evidence,
        sha256(evidence),
      );
    }
  });
}
