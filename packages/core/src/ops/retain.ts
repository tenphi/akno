import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  RetainInput,
  type ProvidedRetainCandidate,
  type RetainCandidateResult,
  type RetainOutput,
  type RetainRetraction,
  type RetainSourceResult,
  type RetainSourceSpan,
  type RetainUpsertSource,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { folderCatalog } from '../kb/folders.ts';
import { parseFrontmatter, serializeYamlString } from '../kb/frontmatter.ts';
import { parsePage } from '../kb/page.ts';
import { isReserved } from '../reserved.ts';
import { newPrefixedId, sha256 } from '../store/ids.ts';
import { restoreFile, writeFileAtomic } from '../write/atomic.ts';
import { detectConflict } from '../write/conflict.ts';
import { fileEntry, type ChangeFile } from '../write/journal.ts';
import {
  managedMemoryBlock,
  managedMemoryFingerprint,
  markerFromProvidedCandidate,
  parseManagedMemoryMarker,
  renderManagedMemoryMarker,
  renderManagedMemoryPayload,
  sameManagedMemorySemantics,
  type ManagedMemoryMarker,
  type ManagedMemorySupport,
} from '../write/managed-memory.ts';
import { appendManagedBlock, managedSourceReference } from '../write/placement.ts';
import { reconcileRetainManagedSources } from '../write/retain-supports.ts';
import { normalizeSlug } from './write.ts';

interface ReceiptRow {
  source_id: string;
  revision: string;
  request_hash: string;
  source_hash: string;
  source_group: string | null;
  receipt_fingerprint: string;
  result: string;
}

interface SupportRow {
  receipt_fingerprint: string;
  candidate_id: string;
  candidate_fingerprint: string;
  proof_group: string;
  memory_id: string;
  slug: string;
  selection: 'provided' | 'extracted';
  source_ref: string;
  origin: 'user' | 'assistant' | 'unknown';
  input_hash: string;
  evidence: string;
  evidence_hash: string;
  retracted_by: string | null;
  forgotten_by: string | null;
}

interface PageStage {
  slug: string;
  relPath: string;
  before: string | null;
  after: string;
}

type PendingSupport = Omit<SupportRow, 'retracted_by' | 'forgotten_by'>;

interface ManagedBlockLocation {
  marker: ManagedMemoryMarker;
  markerIndex: number;
  payloadIndex: number;
  payload: string;
}

export async function retain(ctx: AknoContext, rawInput: unknown): Promise<RetainOutput> {
  const input = RetainInput.parse(rawInput);
  const results: RetainSourceResult[] = [];
  for (const source of input.sources) {
    try {
      results.push(
        'input' in source
          ? await retainProvidedExact(ctx, source, input.dry_run ?? false)
          : await retractSource(ctx, source, input.dry_run ?? false),
      );
    } catch (error) {
      results.push({
        source_id: source.source_id,
        revision: source.revision,
        outcome: 'held',
        candidates: [],
        note: `source apply failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  const held = results.filter(
    (result) => result.outcome === 'held' || result.outcome === 'revision_conflict',
  ).length;
  const effective = results.filter((result) => result.outcome === 'ok').length;
  return {
    status: 'ok',
    outcome: held > 0 && effective > 0 ? 'partial' : effective > 0 ? 'ok' : 'noop',
    sources: results,
  };
}

async function retainProvidedExact(
  ctx: AknoContext,
  source: RetainUpsertSource,
  dryRun: boolean,
): Promise<RetainSourceResult> {
  const sourceHash = sha256(JSON.stringify(source.input));
  const requestHash = sha256(JSON.stringify(source));
  const replay = replayResult(ctx, source.source_id, source.revision, requestHash, sourceHash);
  if (replay) return replay;

  const groupIssue = sourceGroupIssue(ctx, source.source_id, source.source_group);
  if (groupIssue) {
    return conflictResult(source.source_id, source.revision, groupIssue);
  }

  const receiptFingerprint = managedMemoryFingerprint(
    `receipt:${source.source_id}:${source.revision}:${requestHash}`,
  );
  const proofGroup = managedMemoryFingerprint(`proof:${source.source_group ?? source.source_id}`);
  const stages = new Map<string, PageStage>();
  const pendingSupports: PendingSupport[] = [];
  const candidateResults: RetainCandidateResult[] = [];
  const candidateIds = new Set(source.retention.candidates.map((candidate) => candidate.candidate_id));
  const candidateOrder = new Map(
    source.retention.candidates.map((candidate, index) => [candidate.candidate_id, index]),
  );
  const candidateMemoryIds = new Map<string, string>();
  const ordered = dependencyOrder(source.retention.candidates);

  for (const candidate of source.retention.candidates) {
    if (ordered.blocked.has(candidate.candidate_id)) {
      candidateResults.push({
        candidate_id: candidate.candidate_id,
        outcome: 'held',
        reason: 'candidate relation cycle or blocked dependency',
      });
    }
  }

  for (const candidate of ordered.candidates) {
    const issue = candidateIssue(ctx, source, candidate, candidateIds);
    if (issue) {
      candidateResults.push({ candidate_id: candidate.candidate_id, outcome: 'held', reason: issue });
      continue;
    }
    const missingTarget = (candidate.relations ?? []).find(
      (relation) =>
        'candidate_id' in relation.target && !candidateMemoryIds.has(relation.target.candidate_id),
    );
    if (missingTarget && 'candidate_id' in missingTarget.target) {
      candidateResults.push({
        candidate_id: candidate.candidate_id,
        outcome: 'held',
        reason: `relation target candidate ${missingTarget.target.candidate_id} was not retained`,
      });
      continue;
    }

    const slug = normalizeSlug(candidate.destination.slug);
    const stage = await pageStage(ctx, stages, slug, candidate.subject);
    if ('issue' in stage) {
      candidateResults.push({
        candidate_id: candidate.candidate_id,
        outcome: 'held',
        slug,
        reason: stage.issue,
      });
      continue;
    }

    const candidateFingerprint = managedMemoryFingerprint({
      source: source.source_id,
      revision: source.revision,
      candidate: candidate.candidate_id,
      semantics: candidate,
    });
    const support: ManagedMemorySupport = {
      receipt: receiptFingerprint,
      candidate: candidateFingerprint,
      proofGroup,
      selection: 'provided',
    };
    const proposedId = newPrefixedId('mem');
    const marker = markerFromProvidedCandidate(proposedId, candidate, support, candidateMemoryIds);
    const payload = renderManagedMemoryPayload(candidate.text, marker);
    const duplicate = managedBlocks(stage.after).find(
      (block) => block.payload === payload && sameManagedMemorySemantics(block.marker, marker),
    );

    let memoryId = proposedId;
    let outcome: RetainCandidateResult['outcome'] = 'written';
    if (duplicate) {
      memoryId = duplicate.marker.id;
      const alreadySupported = duplicate.marker.supports.some(
        (current) => current.receipt === support.receipt && current.candidate === support.candidate,
      );
      if (alreadySupported) {
        outcome = 'duplicate';
      } else if (duplicate.marker.supports.length >= 8) {
        candidateResults.push({
          candidate_id: candidate.candidate_id,
          outcome: 'held',
          memory_id: memoryId,
          slug,
          reason: 'support_limit',
        });
        continue;
      } else {
        duplicate.marker.supports.push(support);
        stage.after = replaceLine(
          stage.after,
          duplicate.markerIndex,
          renderManagedMemoryMarker(duplicate.marker),
        );
        outcome = 'support_added';
      }
    } else {
      const row = ctx.store.db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug) as
        { id: string } | undefined;
      if (
        stage.before !== null &&
        candidate.destination.section &&
        countSection(stage.after, candidate.destination.section) !== 1
      ) {
        candidateResults.push({
          candidate_id: candidate.candidate_id,
          outcome: 'held',
          slug,
          reason: 'exact destination section is absent or ambiguous',
        });
        continue;
      }
      if (row) {
        const parsed = parsePage(stage.relPath, stage.after);
        const conflict = detectConflict({
          store: ctx.store,
          pageId: row.id,
          slug,
          body: parsed.body,
          bodyStartLine: parsed.bodyLine,
          incoming: candidate.text,
        });
        if (conflict) {
          candidateResults.push({
            candidate_id: candidate.candidate_id,
            outcome: 'held',
            slug,
            reason: 'conflict',
          });
          continue;
        }
      }
      stage.after = appendBlock(
        stage.after,
        candidate.destination.section ?? 'Unsorted',
        managedMemoryBlock(marker, payload),
      );
    }

    const evidence = sourceEvidence(candidate);
    pendingSupports.push({
      receipt_fingerprint: receiptFingerprint,
      candidate_id: candidate.candidate_id,
      candidate_fingerprint: candidateFingerprint,
      proof_group: proofGroup,
      memory_id: memoryId,
      slug,
      selection: 'provided',
      evidence,
      evidence_hash: sha256(evidence),
      source_ref: managedSourceReference(source.locator ?? source.source_id),
      origin: sourceOrigin(candidate.attribution.source_role),
      input_hash: sourceHash,
    });
    candidateResults.push({
      candidate_id: candidate.candidate_id,
      outcome,
      memory_id: memoryId,
      slug,
    });
    candidateMemoryIds.set(candidate.candidate_id, memoryId);
  }

  candidateResults.sort(
    (left, right) => candidateOrder.get(left.candidate_id)! - candidateOrder.get(right.candidate_id)!,
  );

  const changed = [...stages.values()].filter((stage) => stage.before !== stage.after);
  const preview: RetainSourceResult = {
    source_id: source.source_id,
    revision: source.revision,
    outcome:
      changed.length > 0 ? 'ok' : candidateResults.some((item) => item.outcome === 'held') ? 'held' : 'noop',
    candidates: candidateResults,
    ...(dryRun ? { note: 'dry run — nothing was written and no replay receipt was created' } : {}),
  };
  if (dryRun) return preview;

  const committed = await commitStages(
    ctx,
    changed,
    `retained ${candidateResults.filter((item) => ['written', 'support_added'].includes(item.outcome)).length} item(s) from one source revision`,
  );
  const changeId = committed?.changeId ?? null;
  const result = { ...preview, ...(changeId ? { change_id: changeId } : {}) };
  try {
    persistReceipt(ctx, {
      source,
      sourceHash,
      requestHash,
      receiptFingerprint,
      mode: 'provided_exact',
      result,
      changeId,
      supports: pendingSupports,
      retracted: [],
    });
  } catch (error) {
    await rollbackCommittedStages(ctx, committed, error);
  }
  await reindexStages(ctx, changed);
  return result;
}

async function retractSource(
  ctx: AknoContext,
  source: RetainRetraction,
  dryRun: boolean,
): Promise<RetainSourceResult> {
  const sourceHash = sha256('retraction');
  const requestHash = sha256(JSON.stringify(source));
  const replay = replayResult(ctx, source.source_id, source.revision, requestHash, sourceHash);
  if (replay) return replay;
  const target = ctx.store.db
    .prepare('SELECT * FROM retain_receipts WHERE source_id = ? AND revision = ?')
    .get(source.source_id, source.retention.target_revision) as ReceiptRow | undefined;
  if (!target) {
    return {
      source_id: source.source_id,
      revision: source.revision,
      outcome: 'held',
      candidates: [],
      note: 'target_revision was not retained',
    };
  }

  const selected = ctx.store.db
    .prepare(
      `SELECT * FROM retain_supports
       WHERE receipt_fingerprint = ? AND retracted_by IS NULL AND forgotten_by IS NULL
       ORDER BY candidate_id`,
    )
    .all(target.receipt_fingerprint) as SupportRow[];
  const wanted = source.retention.candidate_ids
    ? new Set(source.retention.candidate_ids)
    : new Set(selected.map((row) => row.candidate_id));
  const stages = new Map<string, PageStage>();
  const results: RetainCandidateResult[] = [];
  const removed: SupportRow[] = [];

  for (const candidateId of wanted) {
    const support = selected.find((row) => row.candidate_id === candidateId);
    if (!support) {
      results.push({ candidate_id: candidateId, outcome: 'not_found' });
      continue;
    }
    const stage = await existingPageStage(ctx, stages, support.slug);
    if ('issue' in stage) {
      results.push({ candidate_id: candidateId, outcome: 'held', reason: stage.issue });
      continue;
    }
    const block = managedBlocks(stage.after).find((entry) => entry.marker.id === support.memory_id);
    if (!block) {
      results.push({ candidate_id: candidateId, outcome: 'held', reason: 'owned memory block changed' });
      continue;
    }
    const nextSupports = block.marker.supports.filter(
      (entry) =>
        !(entry.receipt === support.receipt_fingerprint && entry.candidate === support.candidate_fingerprint),
    );
    if (nextSupports.length === block.marker.supports.length) {
      results.push({ candidate_id: candidateId, outcome: 'held', reason: 'support marker changed' });
      continue;
    }
    stage.after =
      nextSupports.length > 0
        ? replaceLine(
            stage.after,
            block.markerIndex,
            renderManagedMemoryMarker({ ...block.marker, supports: nextSupports }),
          )
        : removeBlock(stage.after, block.markerIndex, block.payloadIndex);
    removed.push(support);
    results.push({
      candidate_id: candidateId,
      outcome: 'retracted',
      memory_id: support.memory_id,
      slug: support.slug,
    });
  }

  const changed = [...stages.values()].filter((stage) => stage.before !== stage.after);
  const preview: RetainSourceResult = {
    source_id: source.source_id,
    revision: source.revision,
    outcome: changed.length > 0 ? 'ok' : results.some((item) => item.outcome === 'held') ? 'held' : 'noop',
    candidates: results,
    ...(dryRun ? { note: 'dry run — nothing was retracted and no replay receipt was created' } : {}),
  };
  if (dryRun) return preview;

  const committed = await commitStages(ctx, changed, `retracted ${removed.length} source support(s)`);
  const changeId = committed?.changeId ?? null;
  const result = { ...preview, ...(changeId ? { change_id: changeId } : {}) };
  const receiptFingerprint = managedMemoryFingerprint(
    `receipt:${source.source_id}:${source.revision}:${requestHash}`,
  );
  try {
    persistReceipt(ctx, {
      source,
      sourceHash,
      requestHash,
      receiptFingerprint,
      mode: 'retract',
      result,
      changeId,
      supports: [],
      retracted: removed,
    });
  } catch (error) {
    await rollbackCommittedStages(ctx, committed, error);
  }
  await reindexStages(ctx, changed);
  return result;
}

function replayResult(
  ctx: AknoContext,
  sourceId: string,
  revision: string,
  requestHash: string,
  sourceHash: string,
): RetainSourceResult | null {
  const row = ctx.store.db
    .prepare('SELECT * FROM retain_receipts WHERE source_id = ? AND revision = ?')
    .get(sourceId, revision) as ReceiptRow | undefined;
  if (!row) return null;
  if (row.request_hash !== requestHash || row.source_hash !== sourceHash) {
    return conflictResult(sourceId, revision, 'revision_conflict');
  }
  try {
    const stored = JSON.parse(row.result) as RetainSourceResult;
    const retired = new Set(
      (
        ctx.store.db
          .prepare(
            `SELECT candidate_id FROM retain_supports
             WHERE receipt_fingerprint = ? AND (retracted_by IS NOT NULL OR forgotten_by IS NOT NULL)`,
          )
          .all(row.receipt_fingerprint) as { candidate_id: string }[]
      ).map((support) => support.candidate_id),
    );
    return {
      ...stored,
      outcome: 'replayed',
      candidates: stored.candidates.map((candidate) =>
        retired.has(candidate.candidate_id) ? { ...candidate, outcome: 'retracted' as const } : candidate,
      ),
      note:
        retired.size > 0
          ? 'identical source revision already completed; some support was later retracted or forgotten'
          : 'identical source revision already completed',
    };
  } catch {
    return conflictResult(sourceId, revision, 'stored receipt is unreadable');
  }
}

function conflictResult(sourceId: string, revision: string, note: string): RetainSourceResult {
  return { source_id: sourceId, revision, outcome: 'revision_conflict', candidates: [], note };
}

function sourceGroupIssue(ctx: AknoContext, sourceId: string, group: string | undefined): string | null {
  const row = ctx.store.db
    .prepare(
      `SELECT source_group FROM retain_receipts
       WHERE source_id = ? AND source_group IS NOT NULL ORDER BY created_at LIMIT 1`,
    )
    .get(sourceId) as { source_group: string } | undefined;
  return row && row.source_group !== (group ?? sourceId) ? 'source_group_conflict' : null;
}

function candidateIssue(
  ctx: AknoContext,
  source: RetainUpsertSource,
  candidate: ProvidedRetainCandidate,
  candidateIds: ReadonlySet<string>,
): string | null {
  if (candidate.text.includes('\n') || candidate.text.includes('\0'))
    return 'candidate text must be one line';
  if (
    candidate.subject.includes('\r') ||
    candidate.subject.includes('\n') ||
    candidate.subject.includes('\0')
  ) {
    return 'candidate subject must be one line';
  }
  if (
    candidate.destination.section &&
    (candidate.destination.section.includes('\r') ||
      candidate.destination.section.includes('\n') ||
      candidate.destination.section.includes('\0') ||
      !/^[^#[\]<>]{1,100}$/.test(candidate.destination.section) ||
      candidate.destination.section.trim().length === 0)
  ) {
    return 'destination section is not a safe heading';
  }
  const supportIssue = spansIssue(source, candidate.support);
  if (supportIssue) return `support: ${supportIssue}`;
  const frameIssue = spansIssue(source, candidate.discourse_frame);
  if (frameIssue) return `discourse_frame: ${frameIssue}`;
  const frameKeys = new Set(candidate.discourse_frame.map(spanKey));
  if (candidate.support.some((span) => !frameKeys.has(spanKey(span)))) {
    return 'discourse_frame must contain every support span';
  }
  const attributionIssue = structuredAttributionIssue(source, candidate);
  if (attributionIssue) return attributionIssue;
  if (sourceEvidence(candidate).length > 1200) return 'discourse frame exceeds the evidence limit';
  if (
    candidate.subject_ref &&
    !ctx.store.db.prepare('SELECT 1 FROM graph_entities WHERE id = ?').get(candidate.subject_ref.entity_id)
  ) {
    return 'subject_ref does not name an existing canonical entity';
  }
  for (const relation of candidate.relations ?? []) {
    const issue = spansIssue(source, relation.support);
    if (issue) return `relation support: ${issue}`;
    if ('candidate_id' in relation.target && !candidateIds.has(relation.target.candidate_id)) {
      return `relation target candidate ${relation.target.candidate_id} is not in this source revision`;
    }
    if (
      'memory_id' in relation.target &&
      !ctx.store.db
        .prepare(
          'SELECT 1 FROM retain_supports WHERE memory_id = ? AND retracted_by IS NULL AND forgotten_by IS NULL',
        )
        .get(relation.target.memory_id)
    ) {
      return `relation target memory ${relation.target.memory_id} does not exist`;
    }
    if (
      'fact_id' in relation.target &&
      !ctx.store.db.prepare('SELECT 1 FROM facts WHERE id = ?').get(relation.target.fact_id)
    ) {
      return `relation target fact ${relation.target.fact_id} does not exist`;
    }
  }
  if (candidate.epistemic.basis === 'cited_evidence') {
    for (const evidence of candidate.epistemic.evidence ?? []) {
      if (!durableEvidenceExists(ctx, evidence)) return 'cited evidence is unavailable';
    }
  }
  return null;
}

function structuredAttributionIssue(
  source: RetainUpsertSource,
  candidate: ProvidedRetainCandidate,
): string | null {
  if (!('items' in source.input)) return null;
  const items = new Map(source.input.items.map((item) => [item.item_id, item]));
  for (const span of candidate.support) {
    const item = span.item_id ? items.get(span.item_id) : undefined;
    if (!item) continue;
    const itemRole = item.role === 'system' ? 'unknown' : item.role;
    if (
      itemRole &&
      candidate.attribution.source_role !== 'unknown' &&
      itemRole !== candidate.attribution.source_role
    ) {
      return 'source attribution conflicts with the structured support item role';
    }
    if (
      item.speaker &&
      candidate.attribution.source_speaker &&
      item.speaker !== candidate.attribution.source_speaker
    ) {
      return 'source attribution conflicts with the structured support item speaker';
    }
  }
  return null;
}

function spansIssue(source: RetainUpsertSource, spans: readonly RetainSourceSpan[]): string | null {
  if ('text' in source.input) {
    for (const span of spans) {
      if (span.item_id) return 'item_id is invalid for unstructured text';
      if (occurrences(source.input.text, span.quote) !== 1) return 'quote is missing or ambiguous';
    }
    return null;
  }
  const items = new Map(source.input.items.map((item) => [item.item_id, item]));
  if (items.size !== source.input.items.length) return 'source item ids are not unique';
  for (const span of spans) {
    if (!span.item_id) return 'structured source spans require item_id';
    const item = items.get(span.item_id);
    if (!item || occurrences(item.text, span.quote) !== 1) return 'quote is missing or ambiguous in its item';
  }
  return null;
}

function durableEvidenceExists(
  ctx: AknoContext,
  evidence: NonNullable<ProvidedRetainCandidate['epistemic']['evidence']>[number],
): boolean {
  if ('fact_id' in evidence)
    return Boolean(ctx.store.db.prepare('SELECT 1 FROM facts WHERE id = ?').get(evidence.fact_id));
  if ('page_slug' in evidence) {
    return Boolean(
      ctx.store.db
        .prepare(
          `SELECT 1 FROM facts f JOIN pages p ON p.id = f.page_id
           WHERE p.slug = ? AND f.source_line_hash = ?`,
        )
        .get(evidence.page_slug, evidence.line_hash),
    );
  }
  if ('document_id' in evidence) {
    return Boolean(
      ctx.store.db
        .prepare('SELECT 1 FROM chunks WHERE document_id = ? AND CAST(id AS TEXT) = ?')
        .get(evidence.document_id, evidence.passage_id),
    );
  }
  return Boolean(ctx.store.db.prepare('SELECT 1 FROM changes WHERE id = ?').get(evidence.journal_event_id));
}

async function pageStage(
  ctx: AknoContext,
  stages: Map<string, PageStage>,
  slug: string,
  subject: string,
): Promise<PageStage | { issue: string }> {
  const cached = stages.get(slug);
  if (cached) return cached;
  if (isReserved(slug, ctx.config)) return { issue: 'reserved_path' };
  const row = ctx.store.db
    .prepare('SELECT rel_path, role, remember_management FROM pages WHERE slug = ?')
    .get(slug) as { rel_path: string; role: string; remember_management: string } | undefined;
  if (row && (row.role !== 'knowledge' || row.remember_management !== 'integrate')) {
    return { issue: 'destination is not knowledge + remember: integrate' };
  }
  if (!row) {
    const parent = slug.slice(0, slug.lastIndexOf('/'));
    const admitted = folderCatalog(ctx.config, ctx.store).some(
      (folder) =>
        folder.path === parent &&
        folder.role === 'knowledge' &&
        folder.remember === 'integrate' &&
        folder.creatable,
    );
    if (!admitted) return { issue: 'destination folder is not admitted for managed memory' };
  }
  const relPath = row?.rel_path ?? `${slug}.md`;
  const absolute = path.join(ctx.config.aknoPath, relPath);
  const before = row ? await fsp.readFile(absolute, 'utf8').catch(() => null) : null;
  if (row && before === null) return { issue: 'destination page is unreadable' };
  if (!row && (await fsp.stat(absolute).catch(() => null))) {
    return { issue: 'unindexed_page_exists' };
  }
  const title = safeTitle(subject) || slugTitle(slug);
  const stage: PageStage = {
    slug,
    relPath,
    before,
    after: before ?? newManagedPage(title),
  };
  stages.set(slug, stage);
  return stage;
}

async function existingPageStage(
  ctx: AknoContext,
  stages: Map<string, PageStage>,
  slug: string,
): Promise<PageStage | { issue: string }> {
  const cached = stages.get(slug);
  if (cached) return cached;
  const row = ctx.store.db.prepare('SELECT rel_path FROM pages WHERE slug = ?').get(slug) as
    { rel_path: string } | undefined;
  if (!row) return { issue: 'owned page is unavailable' };
  const before = await fsp.readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8').catch(() => null);
  if (before === null) return { issue: 'owned page is unreadable' };
  const stage = { slug, relPath: row.rel_path, before, after: before };
  stages.set(slug, stage);
  return stage;
}

function appendBlock(content: string, heading: string, block: string): string {
  const frontmatter = parseFrontmatter(content);
  return (
    content.slice(0, frontmatter.bodyOffset) +
    appendManagedBlock(content.slice(frontmatter.bodyOffset), heading, block)
  );
}

function countSection(content: string, heading: string): number {
  const frontmatter = parseFrontmatter(content);
  const wanted = heading.trim().toLowerCase();
  return content
    .slice(frontmatter.bodyOffset)
    .split('\n')
    .filter((line) => /^##\s+(.+?)\s*$/.exec(line)?.[1]?.trim().toLowerCase() === wanted).length;
}

function managedBlocks(content: string): ManagedBlockLocation[] {
  const frontmatter = parseFrontmatter(content);
  const lines = content.slice(frontmatter.bodyOffset).split('\n');
  const out: ManagedBlockLocation[] = [];
  for (let index = 0; index < lines.length; index++) {
    const marker = parseManagedMemoryMarker(lines[index]!);
    if (!marker) continue;
    let payloadIndex: number | null = null;
    for (let next = index + 1; next < lines.length; next++) {
      const line = lines[next]!;
      if (!line.trim()) continue;
      if (/^\s*(?:<!--|#{1,6}\s)/.test(line)) break;
      payloadIndex = next;
      break;
    }
    if (payloadIndex !== null) {
      out.push({ marker, markerIndex: index, payloadIndex, payload: lines[payloadIndex]! });
    }
  }
  return out;
}

function replaceLine(content: string, bodyIndex: number, replacement: string): string {
  const frontmatter = parseFrontmatter(content);
  const prefix = content.slice(0, frontmatter.bodyOffset);
  const lines = content.slice(frontmatter.bodyOffset).split('\n');
  lines[bodyIndex] = replacement;
  return prefix + lines.join('\n');
}

function removeBlock(content: string, markerIndex: number, payloadIndex: number): string {
  const frontmatter = parseFrontmatter(content);
  const prefix = content.slice(0, frontmatter.bodyOffset);
  const lines = content.slice(frontmatter.bodyOffset).split('\n');
  lines.splice(markerIndex, payloadIndex - markerIndex + 1);
  return prefix + lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

async function commitStages(
  ctx: AknoContext,
  stages: readonly PageStage[],
  summary: string,
): Promise<{ changeId: string; files: ChangeFile[] } | null> {
  if (stages.length === 0) return null;
  const files: ChangeFile[] = [];
  try {
    for (const stage of stages) {
      files.push(fileEntry(await writeFileAtomic(ctx.config.aknoPath, stage.relPath, stage.after)));
    }
    const changeId = ctx.journal.record({ actor: ctx.actor, op: 'retain', summary, files });
    return { changeId, files };
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
        `retain failed and rollback was incomplete: ${error instanceof Error ? error.message : String(error)}; ${failures.join('; ')}`,
        { cause: error },
      );
    }
    throw error;
  }
}

async function rollbackCommittedStages(
  ctx: AknoContext,
  committed: { changeId: string; files: readonly ChangeFile[] } | null,
  cause: unknown,
): Promise<never> {
  if (!committed) throw cause;
  const failures: string[] = [];
  for (const file of [...committed.files].reverse()) {
    try {
      await restoreFile(ctx.config.aknoPath, file.relPath, file.before);
    } catch (rollback) {
      failures.push(rollback instanceof Error ? rollback.message : String(rollback));
    }
  }
  if (failures.length === 0) {
    ctx.store.db
      .prepare("UPDATE changes SET status = 'undone', undone_at = ? WHERE id = ?")
      .run(new Date().toISOString(), committed.changeId);
  }
  throw new Error(
    `retain receipt failed${failures.length > 0 ? ' and file rollback was incomplete' : '; brain bytes were rolled back'}: ${
      cause instanceof Error ? cause.message : String(cause)
    }${failures.length > 0 ? `; ${failures.join('; ')}` : ''}`,
    { cause },
  );
}

async function reindexStages(ctx: AknoContext, stages: readonly PageStage[]): Promise<void> {
  if (stages.length === 0) return;
  const paths = stages.map((stage) => stage.relPath);
  await ctx.indexer.runForeground({ only: paths, modelPaths: [] });
  ctx.derive.schedule(paths);
}

function persistReceipt(
  ctx: AknoContext,
  input: {
    source: RetainUpsertSource | RetainRetraction;
    sourceHash: string;
    requestHash: string;
    receiptFingerprint: string;
    mode: 'provided_exact' | 'retract';
    result: RetainSourceResult;
    changeId: string | null;
    supports: readonly PendingSupport[];
    retracted: readonly SupportRow[];
  },
): void {
  const now = new Date().toISOString();
  ctx.store.transaction(() => {
    ctx.store.db
      .prepare(
        `INSERT INTO retain_receipts(
           source_id, revision, request_hash, source_hash, source_group, receipt_fingerprint,
           mode, result, change_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.source.source_id,
        input.source.revision,
        input.requestHash,
        input.sourceHash,
        'source_group' in input.source ? (input.source.source_group ?? input.source.source_id) : null,
        input.receiptFingerprint,
        input.mode,
        JSON.stringify(input.result),
        input.changeId,
        now,
      );
    const supportInsert = ctx.store.db.prepare(
      `INSERT INTO retain_supports(
         receipt_fingerprint, candidate_id, candidate_fingerprint, proof_group, memory_id,
         slug, selection, source_ref, origin, input_hash, evidence, evidence_hash,
         retracted_by, forgotten_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    );
    for (const support of input.supports) {
      supportInsert.run(
        support.receipt_fingerprint,
        support.candidate_id,
        support.candidate_fingerprint,
        support.proof_group,
        support.memory_id,
        support.slug,
        support.selection,
        support.source_ref,
        support.origin,
        support.input_hash,
        support.evidence,
        support.evidence_hash,
      );
    }
    const retract = ctx.store.db.prepare(
      `UPDATE retain_supports SET retracted_by = ?
       WHERE receipt_fingerprint = ? AND candidate_id = ? AND retracted_by IS NULL`,
    );
    for (const support of input.retracted) {
      retract.run(input.receiptFingerprint, support.receipt_fingerprint, support.candidate_id);
    }
  });
  reconcileRetainManagedSources(ctx, [
    ...input.supports.map((support) => support.memory_id),
    ...input.retracted.map((support) => support.memory_id),
  ]);
}

function sourceEvidence(candidate: ProvidedRetainCandidate): string {
  return candidate.discourse_frame.map((span) => span.quote).join('\n…\n');
}

function sourceOrigin(role: ProvidedRetainCandidate['attribution']['source_role']): PendingSupport['origin'] {
  return role === 'user' || role === 'assistant' ? role : 'unknown';
}

function dependencyOrder(candidates: readonly ProvidedRetainCandidate[]): {
  candidates: ProvidedRetainCandidate[];
  blocked: Set<string>;
} {
  const byId = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const ordered: ProvidedRetainCandidate[] = [];
  const blocked = new Set<string>();
  const visited = new Set<string>();
  const visiting: string[] = [];

  const visit = (candidate: ProvidedRetainCandidate): boolean => {
    if (visited.has(candidate.candidate_id)) return !blocked.has(candidate.candidate_id);
    const cycleAt = visiting.indexOf(candidate.candidate_id);
    if (cycleAt >= 0) {
      for (const id of visiting.slice(cycleAt)) blocked.add(id);
      return false;
    }
    visiting.push(candidate.candidate_id);
    let ready = true;
    for (const relation of candidate.relations ?? []) {
      if (!('candidate_id' in relation.target)) continue;
      const target = byId.get(relation.target.candidate_id);
      if (!target || !visit(target)) ready = false;
    }
    visiting.pop();
    visited.add(candidate.candidate_id);
    if (!ready) blocked.add(candidate.candidate_id);
    else ordered.push(candidate);
    return ready;
  };

  for (const candidate of candidates) visit(candidate);
  return { candidates: ordered, blocked };
}

function spanKey(span: RetainSourceSpan): string {
  return `${span.item_id ?? ''}\0${span.quote}`;
}

function occurrences(text: string, needle: string): number {
  let count = 0;
  let at = 0;
  while ((at = text.indexOf(needle, at)) >= 0) {
    count += 1;
    at += Math.max(1, needle.length);
  }
  return count;
}

function newManagedPage(title: string): string {
  return `---\ntitle: ${serializeYamlString(title, 'title')}\nakno:\n  role: knowledge\n  management:\n    remember: integrate\n---\n\n# ${title}\n`;
}

function slugTitle(slug: string): string {
  const name = slug.slice(slug.lastIndexOf('/') + 1).replaceAll('-', ' ');
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeTitle(value: string): string {
  return value
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('\0', ' ')
    .replaceAll('#', ' ')
    .replaceAll('[', ' ')
    .replaceAll(']', ' ')
    .replaceAll('<', ' ')
    .replaceAll('>', ' ')
    .replaceAll('`', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
