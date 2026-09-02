import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  AknoError,
  RetainInput,
  type DegradedReason,
  type ProvidedRetainCandidate,
  type RetainCandidateResult,
  type RetainHoldReason,
  type RetainModelCallReceipt,
  type RetainOutput,
  type RetainRetraction,
  type RetainSourceResult,
  type RetainSourceSpan,
  type RetainSourceInput,
  type RetainUpsertSource,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { ModelClient } from '../models/client.ts';
import { folderCatalog } from '../kb/folders.ts';
import { parseFrontmatter, serializeYamlString } from '../kb/frontmatter.ts';
import { parsePage } from '../kb/page.ts';
import { contentWords } from '../kb/words.ts';
import { declaringRule, effectiveRule } from '../rules/compile.ts';
import { isReserved } from '../reserved.ts';
import {
  hasInlineMergeConflict,
  matchesConflictPath,
  quarantineReasonsForPath,
} from '../index/page-quarantine.ts';
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
import { appendManagedBlock, managedSourceReference, placeManagedItems } from '../write/placement.ts';
import {
  modelCallReceipt,
  runRetain,
  type RetainCandidate,
  type RetainHeldCandidate,
} from '../write/retain.ts';
import { resolveRememberFallback } from '../write/remember-fallback.ts';
import { pruneRetainEvidence, reconcileRetainManagedSources } from '../write/retain-supports.ts';
import { routeAutomaticCandidate } from './remember.ts';
import { read } from './read.ts';
import { normalizeSlug, titleFromSlug } from './write.ts';

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

type InlineRetainInput = Extract<RetainSourceInput, { text: string } | { items: unknown[] }>;
type ResolvedRetainUpsertSource = Omit<RetainUpsertSource, 'input'> & { input: InlineRetainInput };

interface RetainSourceBinding {
  kind: 'text' | 'items' | 'page' | 'document';
  availability: 'available' | 'degraded';
  reextractable: boolean;
  reference?: string;
  preservedSlug?: string;
}

interface ResolvedRetainSource {
  source: ResolvedRetainUpsertSource;
  requested: RetainUpsertSource;
  sourceHash: string;
  sourceRef: string;
  binding: RetainSourceBinding;
  degraded: DegradedReason[];
}

type PendingSupport = Omit<SupportRow, 'retracted_by' | 'forgotten_by'>;

interface ManagedBlockLocation {
  marker: ManagedMemoryMarker;
  markerIndex: number;
  payloadIndex: number;
  payload: string;
}

type ResolvedRetainCandidate = (ProvidedRetainCandidate | RetainCandidate) & {
  destination: { slug: string; section?: string };
};

export async function retain(ctx: AknoContext, rawInput: unknown): Promise<RetainOutput> {
  const input = RetainInput.parse(rawInput);
  const results: RetainSourceResult[] = [];
  for (const source of input.sources) {
    try {
      if (!('input' in source)) {
        results.push(await retractSource(ctx, source, input.dry_run ?? false));
        continue;
      }
      const resolved = await resolveRetainSource(ctx, source);
      if ('result' in resolved) {
        results.push(resolved.result);
        continue;
      }
      results.push(
        source.retention.mode === 'extract'
          ? await retainExtracted(ctx, resolved, input.dry_run ?? false)
          : await retainCandidates(ctx, resolved, source.retention.candidates, {
              dryRun: input.dry_run ?? false,
              selection: 'provided',
              placement: source.retention.placement,
              initialResults: [],
              modelUsage: { extraction: null, verification: null, placement: [] },
            }),
      );
    } catch (error) {
      results.push({
        source_id: source.source_id,
        revision: source.revision,
        outcome: 'held',
        status: 'degraded',
        degraded: ['retain_apply_failed'],
        reason_code: 'apply_failed',
        candidates: [],
        note: `source apply failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
  const incomplete = results.some(
    (result) =>
      result.outcome === 'held' ||
      result.outcome === 'revision_conflict' ||
      result.candidates.some(
        (candidate) => candidate.outcome === 'held' || candidate.outcome === 'not_found',
      ),
  );
  const effective = results.filter((result) => result.outcome === 'ok').length;
  const degraded = [...new Set(results.flatMap((result) => result.degraded ?? []))];
  const allEmpty = results.length > 0 && results.every((result) => result.status === 'empty');
  const allUnavailable = results.length > 0 && results.every((result) => result.status === 'unavailable');
  return {
    status: allUnavailable ? 'unavailable' : degraded.length > 0 ? 'degraded' : allEmpty ? 'empty' : 'ok',
    ...(degraded.length > 0 ? { degraded } : {}),
    outcome: incomplete && effective > 0 ? 'partial' : effective > 0 ? 'ok' : 'noop',
    sources: results,
  };
}

async function resolveRetainSource(
  ctx: AknoContext,
  requested: RetainUpsertSource,
): Promise<ResolvedRetainSource | { result: RetainSourceResult }> {
  const input = requested.input;
  if ('text' in input || 'items' in input) {
    const kind = 'text' in input ? 'text' : 'items';
    return {
      source: { ...requested, input },
      requested,
      sourceHash: sha256(JSON.stringify(input)),
      sourceRef: requested.locator ?? requested.source_id,
      binding: {
        kind,
        availability: 'available',
        reextractable: requested.preserve_source !== undefined,
        ...(requested.preserve_source
          ? { preservedSlug: normalizeSlug(requested.preserve_source.slug) }
          : {}),
      },
      degraded: [],
    };
  }

  if ('page_slug' in input) {
    const slug = normalizeSlug(input.page_slug);
    const row = ctx.store.db.prepare('SELECT rel_path, role FROM pages WHERE slug = ?').get(slug) as
      { rel_path: string; role: string } | undefined;
    if (!row)
      return { result: unavailableSourceResult(requested, 'page', slug, 'source page is not indexed') };
    if (row.role !== 'source') {
      return {
        result: unavailableSourceResult(
          requested,
          'page',
          slug,
          'page_slug accepts only a page whose effective role is source',
          'validation_failed',
        ),
      };
    }
    const bytes = await fsp.readFile(path.join(ctx.config.aknoPath, row.rel_path), 'utf8').catch(() => null);
    if (bytes === null) {
      return { result: unavailableSourceResult(requested, 'page', slug, 'source page is unreadable') };
    }
    const sourceText = parsePage(row.rel_path, bytes).body;
    if (!sourceText.trim()) {
      return { result: unavailableSourceResult(requested, 'page', slug, 'source page has no readable body') };
    }
    return {
      source: { ...requested, input: { text: sourceText } },
      requested,
      sourceHash: sha256(bytes),
      sourceRef: requested.locator ?? slug,
      binding: { kind: 'page', availability: 'available', reextractable: true, reference: slug },
      degraded: [],
    };
  }

  try {
    const output = await read(ctx, { document: input.document_id });
    if (!output.document) {
      return {
        result: unavailableSourceResult(
          requested,
          'document',
          input.document_id,
          'document reference did not resolve to readable document state',
        ),
      };
    }
    const document = output.document;
    if (!document.text) {
      return {
        result: unavailableSourceResult(
          requested,
          'document',
          document.id,
          output.note ?? 'document has no readable extraction or rendition',
        ),
      };
    }
    const degraded = output.status === 'ok' ? [] : (output.degraded ?? ['no_document_text']);
    const documentParts = ctx.store.db
      .prepare(
        `SELECT rel_path, sha256 FROM documents
          WHERE group_key = (
            SELECT group_key FROM documents WHERE id = ?
          ) AND renders IS NULL
          ORDER BY part`,
      )
      .all(document.id) as { rel_path: string; sha256: string }[];
    return {
      source: { ...requested, input: { text: document.text } },
      requested,
      sourceHash: sha256(JSON.stringify({ id: document.id, parts: documentParts, text: document.text })),
      sourceRef: requested.locator ?? document.rel_path,
      binding: {
        kind: 'document',
        availability: output.status === 'ok' ? 'available' : 'degraded',
        reextractable: true,
        reference: document.id,
      },
      degraded,
    };
  } catch (error) {
    const note = error instanceof AknoError ? error.message : `document source failed: ${String(error)}`;
    return { result: unavailableSourceResult(requested, 'document', input.document_id, note) };
  }
}

function unavailableSourceResult(
  source: RetainUpsertSource,
  kind: 'page' | 'document',
  reference: string,
  note: string,
  reasonCode: RetainHoldReason = 'source_unavailable',
): RetainSourceResult {
  return {
    source_id: source.source_id,
    revision: source.revision,
    outcome: 'held',
    status: 'unavailable',
    reason_code: reasonCode,
    candidates: [],
    source: { kind, availability: 'unavailable', reextractable: true, reference },
    note,
  };
}

function sourceResultBinding(binding: RetainSourceBinding): NonNullable<RetainSourceResult['source']> {
  return {
    kind: binding.kind,
    availability: binding.availability,
    reextractable: binding.reextractable,
    ...(binding.reference ? { reference: binding.reference } : {}),
    ...(binding.preservedSlug ? { preserved_slug: binding.preservedSlug } : {}),
  };
}

async function retainExtracted(
  ctx: AknoContext,
  resolved: ResolvedRetainSource,
  dryRun: boolean,
): Promise<RetainSourceResult> {
  const source = resolved.source;
  if (source.retention.mode !== 'extract') throw new Error('retain extract received a provided source');
  const sourceHash = resolved.sourceHash;
  const requestHash = sha256(JSON.stringify(resolved.requested));
  const replay = replayResult(ctx, source.source_id, source.revision, requestHash, sourceHash);
  if (replay) return replay;
  const groupIssue = sourceGroupIssue(ctx, source.source_id, source.source_group);
  if (groupIssue) return conflictResult(source.source_id, source.revision, groupIssue);
  const correctionIssue = validateCorrectionTarget(ctx, source);
  if (correctionIssue) return correctionHoldResult(resolved, correctionIssue);

  const curator = retentionModel(ctx);
  const text =
    'text' in source.input ? source.input.text : source.input.items.map((item) => item.text).join('\n');
  const extracted = await runRetain(text, curator, {
    ...(source.mentioned_at ? { mentionedAt: source.mentioned_at } : {}),
    ...(source.timezone ? { timezone: source.timezone } : {}),
    ...(source.retention.mission ? { mission: source.retention.mission } : {}),
    ...('items' in source.input ? { sourceItems: source.input.items } : {}),
    folders: folderCatalog(ctx.config, ctx.store),
    sourceId: source.source_id,
    revision: source.revision,
  });
  if (extracted.sourceHold) {
    return retainCandidates(ctx, resolved, [], {
      dryRun,
      selection: 'extracted',
      placement: 'automatic',
      initialResults: [],
      modelUsage: { ...extracted.modelUsage, placement: [] },
      sourceHold: extracted.sourceHold,
    });
  }
  const initialResults = extracted.held.map(heldCandidateResult);
  if (extracted.error) {
    return retainCandidates(ctx, resolved, [], {
      dryRun,
      selection: 'extracted',
      placement: 'automatic',
      initialResults,
      modelUsage: { ...extracted.modelUsage, placement: [] },
      additionalDegraded: [extracted.degradedReason ?? 'derive_failed'],
      sourceHold: {
        reason_code: initialResults[0]?.reason_code ?? 'apply_failed',
        reason: `automatic retention could not complete: ${extracted.error}`,
      },
    });
  }

  return retainCandidates(ctx, resolved, extracted.candidates, {
    dryRun,
    selection: 'extracted',
    placement: 'automatic',
    initialResults,
    modelUsage: { ...extracted.modelUsage, placement: [] },
  });
}

async function retainCandidates(
  ctx: AknoContext,
  resolvedSource: ResolvedRetainSource,
  suppliedCandidates: readonly (ProvidedRetainCandidate | RetainCandidate)[],
  options: {
    dryRun: boolean;
    selection: 'provided' | 'extracted';
    placement: 'exact' | 'automatic';
    initialResults: RetainCandidateResult[];
    modelUsage: {
      extraction: RetainModelCallReceipt | null;
      verification: RetainModelCallReceipt | null;
      placement: RetainModelCallReceipt[];
    };
    sourceHold?: { reason_code: RetainHoldReason; reason: string };
    additionalDegraded?: DegradedReason[];
    skipAutomaticRouting?: boolean;
    journalOp?: 'retain' | 'remember';
    onIndexed?: (factsDerived: number) => void;
  },
): Promise<RetainSourceResult> {
  const source = resolvedSource.source;
  const sourceHash = resolvedSource.sourceHash;
  const requestHash = sha256(JSON.stringify(resolvedSource.requested));
  const replay = replayResult(ctx, source.source_id, source.revision, requestHash, sourceHash);
  if (replay) return replay;
  const groupIssue = sourceGroupIssue(ctx, source.source_id, source.source_group);
  if (groupIssue) return conflictResult(source.source_id, source.revision, groupIssue);
  const correctionIssue = validateCorrectionTarget(ctx, source);
  if (correctionIssue) return correctionHoldResult(resolvedSource, correctionIssue);

  const resolved =
    options.placement === 'automatic' && !options.skipAutomaticRouting
      ? await resolveAutomaticCandidates(ctx, suppliedCandidates)
      : {
          candidates: suppliedCandidates.filter(hasDestination),
          held: suppliedCandidates
            .filter((candidate) => !candidate.destination)
            .map((candidate) => ({
              candidate_id: candidate.candidate_id,
              outcome: 'held' as const,
              reason_code: 'validation_failed' as const,
              reason: 'provided exact candidates require a destination',
            })),
        };
  const candidates = resolved.candidates;

  const receiptFingerprint = managedMemoryFingerprint(
    `receipt:${source.source_id}:${source.revision}:${requestHash}`,
  );
  const proofGroup = managedMemoryFingerprint(`proof:${source.source_group ?? source.source_id}`);
  const stages = new Map<string, PageStage>();
  const effectiveBinding: RetainSourceBinding =
    options.sourceHold && resolvedSource.binding.preservedSlug
      ? {
          kind: resolvedSource.binding.kind,
          availability: resolvedSource.binding.availability,
          reextractable: false,
          ...(resolvedSource.binding.reference ? { reference: resolvedSource.binding.reference } : {}),
        }
      : resolvedSource.binding;
  if (effectiveBinding.preservedSlug) {
    if (
      candidates.some(
        (candidate) => normalizeSlug(candidate.destination.slug) === effectiveBinding.preservedSlug,
      )
    ) {
      return {
        source_id: source.source_id,
        revision: source.revision,
        outcome: 'held',
        status: 'ok',
        reason_code: 'validation_failed',
        candidates: [],
        source: sourceResultBinding({
          kind: effectiveBinding.kind,
          availability: effectiveBinding.availability,
          reextractable: false,
          ...(effectiveBinding.reference ? { reference: effectiveBinding.reference } : {}),
        }),
        note: 'a preserved source page cannot also be a retained-memory destination',
      };
    }
    const preserved = await preservedSourceStage(
      ctx,
      stages,
      effectiveBinding.preservedSlug,
      resolvedSource.requested.input,
    );
    if ('issue' in preserved) {
      return {
        source_id: source.source_id,
        revision: source.revision,
        outcome: 'held',
        status: 'ok',
        reason_code: preserved.reasonCode,
        candidates: [],
        source: sourceResultBinding({
          kind: resolvedSource.binding.kind,
          availability: resolvedSource.binding.availability,
          reextractable: false,
          ...(resolvedSource.binding.reference ? { reference: resolvedSource.binding.reference } : {}),
        }),
        note: preserved.issue,
      };
    }
  }
  const correction = source.retracts
    ? await stageRetractions(
        ctx,
        source.source_id,
        source.retracts.target_revision,
        source.retracts.candidate_ids,
        stages,
      )
    : { results: [] as RetainCandidateResult[], removed: [] as SupportRow[], valid: true };
  if (!correction.valid) {
    return {
      source_id: source.source_id,
      revision: source.revision,
      outcome: 'held',
      status: 'ok',
      reason_code: 'conflict',
      candidates: correction.results,
      source: sourceResultBinding(effectiveBinding),
      note: 'correction targets no longer match their owned memory blocks; nothing was changed',
    };
  }
  const pendingSupports: PendingSupport[] = [];
  const suppliedCandidateIds = new Set(suppliedCandidates.map((candidate) => candidate.candidate_id));
  const candidateResults: RetainCandidateResult[] = [
    ...correction.results.filter((result) => !suppliedCandidateIds.has(result.candidate_id)),
    ...options.initialResults,
    ...resolved.held,
  ];
  const candidateIds = suppliedCandidateIds;
  const candidateOrder = new Map(
    [
      ...options.initialResults.map((result) => result.candidate_id),
      ...suppliedCandidates.map((candidate) => candidate.candidate_id),
    ].map((candidateId, index) => [candidateId, index]),
  );
  const candidateMemoryIds = new Map<string, string>();
  const ordered = dependencyOrder(candidates);

  for (const candidate of candidates) {
    if (ordered.blocked.has(candidate.candidate_id)) {
      candidateResults.push({
        candidate_id: candidate.candidate_id,
        outcome: 'held',
        reason_code: 'validation_failed',
        reason: 'candidate relation cycle or blocked dependency',
      });
    }
  }

  for (const candidate of ordered.candidates) {
    const issue = candidateIssue(ctx, source, candidate, candidateIds);
    if (issue) {
      candidateResults.push({
        candidate_id: candidate.candidate_id,
        outcome: 'held',
        reason_code: candidateIssueReasonCode(issue),
        reason: issue,
      });
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
        reason_code: 'validation_failed',
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
        reason_code: stage.issue.includes('unreadable') ? 'source_unavailable' : 'no_writable_destination',
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
      selection: options.selection,
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
          reason_code: 'support_limit',
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
        options.placement === 'exact' &&
        stage.before !== null &&
        candidate.destination.section &&
        countSection(stage.after, candidate.destination.section) !== 1
      ) {
        candidateResults.push({
          candidate_id: candidate.candidate_id,
          outcome: 'held',
          slug,
          reason_code: 'validation_failed',
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
            reason_code: 'conflict',
            reason: conflict.existing,
          });
          continue;
        }
      }
      if (options.placement === 'automatic') {
        const curator = retentionModel(ctx);
        const placed = await placeManagedItems(
          stage.after,
          [{ id: memoryId, marker, text: payload }],
          curator,
        );
        stage.after = placed.content;
        if (placed.modelOutcome)
          options.modelUsage.placement.push(modelCallReceipt(curator, placed.modelOutcome));
        if (placed.error) {
          candidateResults.push({
            candidate_id: candidate.candidate_id,
            outcome,
            memory_id: memoryId,
            slug,
            reason_code: 'placement_degraded',
            reason: `written under Unsorted because semantic section placement degraded: ${placed.error}`,
          });
        }
      } else {
        stage.after = appendBlock(
          stage.after,
          candidate.destination.section ?? 'Unsorted',
          managedMemoryBlock(marker, payload),
        );
      }
    }

    const evidence = sourceEvidence(candidate);
    pendingSupports.push({
      receipt_fingerprint: receiptFingerprint,
      candidate_id: candidate.candidate_id,
      candidate_fingerprint: candidateFingerprint,
      proof_group: proofGroup,
      memory_id: memoryId,
      slug,
      selection: options.selection,
      evidence,
      evidence_hash: sha256(evidence),
      source_ref: managedSourceReference(resolvedSource.sourceRef),
      origin: sourceOrigin(candidate.attribution.source_role),
      input_hash: sourceHash,
    });
    if (!candidateResults.some((result) => result.candidate_id === candidate.candidate_id)) {
      candidateResults.push({ candidate_id: candidate.candidate_id, outcome, memory_id: memoryId, slug });
    }
    candidateMemoryIds.set(candidate.candidate_id, memoryId);
  }

  candidateResults.sort(
    (left, right) =>
      (candidateOrder.get(left.candidate_id) ?? Number.MAX_SAFE_INTEGER) -
      (candidateOrder.get(right.candidate_id) ?? Number.MAX_SAFE_INTEGER),
  );

  const changed = [...stages.values()].filter((stage) => stage.before !== stage.after);
  const placementDegraded = candidateResults.some((result) => result.reason_code === 'placement_degraded');
  const degraded: DegradedReason[] = [
    ...resolvedSource.degraded,
    ...(options.additionalDegraded ?? []),
    ...(placementDegraded
      ? ([retentionModel(ctx).available ? 'derive_failed' : 'no_derive_model'] as DegradedReason[])
      : []),
  ];
  const acceptedCandidateIds = new Set(
    candidateResults
      .filter((result) => ['written', 'support_added', 'duplicate'].includes(result.outcome))
      .map((result) => result.candidate_id),
  );
  const correctionAdmissionFailed =
    source.retracts !== undefined &&
    (suppliedCandidateIds.size === 0 ||
      [...suppliedCandidateIds].some((candidateId) => !acceptedCandidateIds.has(candidateId)) ||
      candidateResults.some((result) => result.outcome === 'held' || result.outcome === 'not_found'));
  if (correctionAdmissionFailed) {
    return {
      source_id: source.source_id,
      revision: source.revision,
      outcome: 'held',
      status: degraded.length > 0 ? 'degraded' : 'ok',
      reason_code: 'validation_failed',
      candidates: candidateResults.map((result) =>
        result.outcome === 'held' || result.outcome === 'not_found'
          ? result
          : {
              candidate_id: result.candidate_id,
              outcome: 'held',
              ...(result.memory_id ? { memory_id: result.memory_id } : {}),
              ...(result.slug ? { slug: result.slug } : {}),
              reason_code: 'validation_failed',
              reason: 'not applied because the compound correction was not fully admissible',
            },
      ),
      source: sourceResultBinding(effectiveBinding),
      ...(degraded.length > 0 ? { degraded } : {}),
      note: 'compound correction was not fully admissible; neither removal nor replacement was written',
    };
  }
  const preview: RetainSourceResult = {
    source_id: source.source_id,
    revision: source.revision,
    outcome: options.sourceHold
      ? 'held'
      : changed.length > 0
        ? 'ok'
        : candidateResults.some((item) => item.outcome === 'held')
          ? 'held'
          : 'noop',
    candidates: candidateResults,
    source: sourceResultBinding(effectiveBinding),
    ...(options.sourceHold ? { reason_code: options.sourceHold.reason_code } : {}),
    status:
      degraded.length > 0
        ? 'degraded'
        : options.sourceHold
          ? 'ok'
          : candidateResults.length === 0
            ? 'empty'
            : 'ok',
    ...(degraded.length > 0 ? { degraded } : {}),
    ...(options.placement === 'automatic' ? { model_usage: options.modelUsage } : {}),
    ...(options.sourceHold ? { note: options.sourceHold.reason } : {}),
    ...(options.dryRun
      ? {
          note: options.sourceHold
            ? `${options.sourceHold.reason}; dry run — no replay receipt was created`
            : 'dry run — nothing was written and no replay receipt was created',
        }
      : {}),
  };
  if (options.dryRun) return preview;

  const committed = await commitStages(
    ctx,
    changed,
    `${options.journalOp === 'remember' ? 'remembered' : 'retained'} ${candidateResults.filter((item) => ['written', 'support_added'].includes(item.outcome)).length} item(s) from one source revision`,
    options.journalOp,
  );
  const changeId = committed?.changeId ?? null;
  const result = { ...preview, ...(changeId ? { change_id: changeId } : {}) };
  try {
    persistReceipt(ctx, {
      source,
      sourceHash,
      requestHash,
      receiptFingerprint,
      mode:
        options.selection === 'extracted'
          ? 'extract_automatic'
          : options.placement === 'automatic'
            ? 'provided_automatic'
            : 'provided_exact',
      result,
      changeId,
      supports: pendingSupports,
      retracted: correction.removed,
      binding: effectiveBinding,
    });
  } catch (error) {
    await rollbackCommittedStages(ctx, committed, error);
  }
  options.onIndexed?.(await reindexStages(ctx, changed));
  return result;
}

/**
 * Compatibility adapter entrypoint: remember keeps its public routing/action response, while
 * validation, owned-block staging, source archives, journaling, receipts, and indexing execute
 * through the same engine as keyed retain.
 */
export async function retainRememberCandidates(
  ctx: AknoContext,
  input: {
    text: string;
    source?: string;
    mentionedAt?: string;
    timezone?: string;
    mission?: string;
    dryRun: boolean;
    candidates: readonly ResolvedRetainCandidate[];
    held: readonly RetainCandidateResult[];
    modelUsage: {
      extraction: RetainModelCallReceipt | null;
      verification: RetainModelCallReceipt | null;
    };
  },
): Promise<{ result: RetainSourceResult; factsAdded: number }> {
  const inputHash = sha256(input.text);
  const sourceId = `remember:${newPrefixedId('src')}`;
  const requested: RetainUpsertSource = {
    source_id: sourceId,
    revision: '1',
    source_group: `remember:${managedMemoryFingerprint(`${input.source ?? 'remember'}:${inputHash}`)}`,
    source_kind: 'conversation',
    ...(input.mentionedAt ? { mentioned_at: input.mentionedAt } : {}),
    ...(input.timezone ? { timezone: input.timezone } : {}),
    ...(input.source ? { locator: input.source } : {}),
    input: { text: input.text },
    retention: { mode: 'extract', ...(input.mission ? { mission: input.mission } : {}) },
  };
  const resolved: ResolvedRetainSource = {
    source: requested as ResolvedRetainUpsertSource,
    requested,
    sourceHash: inputHash,
    sourceRef: input.source ?? 'remember',
    binding: { kind: 'text', availability: 'available', reextractable: false },
    degraded: [],
  };
  let factsAdded = 0;
  const result = await retainCandidates(ctx, resolved, input.candidates, {
    dryRun: input.dryRun,
    selection: 'extracted',
    placement: 'automatic',
    skipAutomaticRouting: true,
    journalOp: 'remember',
    onIndexed: (factsDerived) => {
      factsAdded = factsDerived;
    },
    initialResults: [...input.held],
    modelUsage: { ...input.modelUsage, placement: [] },
  });
  return { result, factsAdded };
}

async function resolveAutomaticCandidates(
  ctx: AknoContext,
  candidates: readonly (ProvidedRetainCandidate | RetainCandidate)[],
): Promise<{ candidates: ResolvedRetainCandidate[]; held: RetainCandidateResult[] }> {
  const resolved: ResolvedRetainCandidate[] = [];
  const held: RetainCandidateResult[] = [];
  const catalog = folderCatalog(ctx.config, ctx.store);
  const fallback = await resolveRememberFallback(ctx, catalog);

  for (const candidate of candidates) {
    const suggested = candidate.destination?.slug;
    const routed = await routeAutomaticCandidate(
      ctx,
      {
        ...candidate,
        ...(suggested ? { page: suggested } : {}),
      } as RetainCandidate,
      { constrainToSuggestedFolder: suggested !== undefined },
    );
    let slug = routed.slug;
    if (!slug && suggested && !pageExists(ctx, suggested) && admittedAutomaticSlug(catalog, suggested)) {
      slug = suggested;
    }
    if (!slug && fallback && fallback.status !== 'unavailable') slug = fallback.slug;

    if (!slug) {
      const reasonCode =
        routed.blocked || (!suggested && routed.nearest.length === 0)
          ? 'no_writable_destination'
          : 'routing_uncertain';
      held.push({
        candidate_id: candidate.candidate_id,
        outcome: 'held',
        reason_code: reasonCode,
        reason: routed.blocked
          ? `the strongest semantic destination is read-only: ${routed.blocked}`
          : suggested && pageExists(ctx, suggested)
            ? 'the suggested existing page was not judged a safe semantic destination'
            : 'no admitted writable destination could be established',
      });
      continue;
    }
    resolved.push({ ...candidate, destination: { slug } });
  }
  return { candidates: resolved, held };
}

function hasDestination(
  candidate: ProvidedRetainCandidate | RetainCandidate,
): candidate is ResolvedRetainCandidate {
  return candidate.destination !== undefined;
}

function pageExists(ctx: AknoContext, slug: string): boolean {
  return ctx.store.db.prepare('SELECT 1 FROM pages WHERE slug = ?').get(slug) !== undefined;
}

function admittedAutomaticSlug(catalog: ReturnType<typeof folderCatalog>, slug: string): boolean {
  const parent = slug.slice(0, slug.lastIndexOf('/'));
  return catalog.some(
    (folder) =>
      folder.path === parent &&
      folder.role === 'knowledge' &&
      folder.remember === 'integrate' &&
      folder.creatable,
  );
}

function retentionModel(ctx: AknoContext): ModelClient {
  return ctx.config.maintenance.model ? new ModelClient(ctx.config.maintenance.model) : ctx.models.derive;
}

function heldCandidateResult(candidate: RetainHeldCandidate): RetainCandidateResult {
  return {
    candidate_id: candidate.candidate_id,
    outcome: 'held',
    reason_code: candidate.reason_code,
    reason: candidate.reason,
  };
}

function validateCorrectionTarget(ctx: AknoContext, source: ResolvedRetainUpsertSource): string | null {
  if (!source.retracts) return null;
  const target = ctx.store.db
    .prepare('SELECT receipt_fingerprint FROM retain_receipts WHERE source_id = ? AND revision = ?')
    .get(source.source_id, source.retracts.target_revision) as { receipt_fingerprint: string } | undefined;
  if (!target) return 'correction target_revision was not retained for this source';
  const active = new Set(
    (
      ctx.store.db
        .prepare(
          `SELECT candidate_id FROM retain_supports
           WHERE receipt_fingerprint = ? AND retracted_by IS NULL AND forgotten_by IS NULL`,
        )
        .all(target.receipt_fingerprint) as { candidate_id: string }[]
    ).map((row) => row.candidate_id),
  );
  const missing = source.retracts.candidate_ids.find((candidateId) => !active.has(candidateId));
  return missing ? `correction target candidate ${missing} is not active` : null;
}

function correctionHoldResult(source: ResolvedRetainSource, note: string): RetainSourceResult {
  return {
    source_id: source.source.source_id,
    revision: source.source.revision,
    outcome: 'held',
    status: 'ok',
    reason_code: 'conflict',
    candidates: [],
    source: sourceResultBinding(source.binding),
    note,
  };
}

async function stageRetractions(
  ctx: AknoContext,
  sourceId: string,
  targetRevision: string,
  candidateIds: readonly string[] | undefined,
  stages: Map<string, PageStage>,
): Promise<{ results: RetainCandidateResult[]; removed: SupportRow[]; valid: boolean }> {
  const target = ctx.store.db
    .prepare('SELECT * FROM retain_receipts WHERE source_id = ? AND revision = ?')
    .get(sourceId, targetRevision) as ReceiptRow | undefined;
  if (!target) return { results: [], removed: [], valid: false };
  const selected = ctx.store.db
    .prepare(
      `SELECT * FROM retain_supports
       WHERE receipt_fingerprint = ? AND retracted_by IS NULL AND forgotten_by IS NULL
       ORDER BY candidate_id`,
    )
    .all(target.receipt_fingerprint) as SupportRow[];
  const wanted = candidateIds ?? selected.map((row) => row.candidate_id);
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
      results.push({
        candidate_id: candidateId,
        outcome: 'held',
        reason_code: 'source_unavailable',
        reason: stage.issue,
      });
      continue;
    }
    const block = managedBlocks(stage.after).find((entry) => entry.marker.id === support.memory_id);
    if (!block) {
      results.push({
        candidate_id: candidateId,
        outcome: 'held',
        reason_code: 'conflict',
        reason: 'owned memory block changed',
      });
      continue;
    }
    const nextSupports = block.marker.supports.filter(
      (entry) =>
        !(entry.receipt === support.receipt_fingerprint && entry.candidate === support.candidate_fingerprint),
    );
    if (nextSupports.length === block.marker.supports.length) {
      results.push({
        candidate_id: candidateId,
        outcome: 'held',
        reason_code: 'conflict',
        reason: 'support marker changed',
      });
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
  return {
    results,
    removed,
    valid: results.length === wanted.length && results.every((result) => result.outcome === 'retracted'),
  };
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
  const targetExists = ctx.store.db
    .prepare('SELECT 1 FROM retain_receipts WHERE source_id = ? AND revision = ?')
    .get(source.source_id, source.retention.target_revision);
  if (!targetExists) {
    return {
      source_id: source.source_id,
      revision: source.revision,
      outcome: 'held',
      reason_code: 'source_unavailable',
      candidates: [],
      note: 'target_revision was not retained',
    };
  }

  const stages = new Map<string, PageStage>();
  const staged = await stageRetractions(
    ctx,
    source.source_id,
    source.retention.target_revision,
    source.retention.candidate_ids,
    stages,
  );
  const results = staged.results;
  const removed = staged.removed;

  if (!staged.valid) {
    return {
      source_id: source.source_id,
      revision: source.revision,
      outcome: 'held',
      status: 'ok',
      reason_code: 'conflict',
      candidates: results,
      note: 'one or more retraction targets no longer match owned memory; nothing was changed',
    };
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
  source: ResolvedRetainUpsertSource,
  candidate: ResolvedRetainCandidate,
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
  if (RELATIVE_TIME.test(sourceEvidence(candidate))) {
    const sourceItems = 'items' in source.input ? source.input.items : [];
    const supportedMentionTimes = new Set([
      ...(source.mentioned_at ? [source.mentioned_at] : []),
      ...candidate.discourse_frame.flatMap((span) => {
        const item = sourceItems.find((entry) => entry.item_id === span.item_id);
        return item?.mentioned_at ? [item.mentioned_at] : [];
      }),
    ]);
    if (
      !source.timezone ||
      !candidate.time?.mentioned_at ||
      candidate.time.timezone !== source.timezone ||
      !supportedMentionTimes.has(candidate.time.mentioned_at)
    ) {
      return 'relative time is unresolved without the exact source mention time and timezone';
    }
  }
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

function candidateIssueReasonCode(issue: string): RetainHoldReason {
  if (issue.startsWith('relative time is unresolved')) return 'time_unresolved';
  return /(?:support|discourse_frame|source|evidence).*(?:missing|ambiguous|unavailable)/i.test(issue)
    ? 'source_unavailable'
    : 'validation_failed';
}

const RELATIVE_TIME =
  /\b(today|tomorrow|yesterday|tonight|next\s+(?:day|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|last\s+(?:night|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:morning|afternoon|evening|week|month|year))\b/i;

function structuredAttributionIssue(
  source: ResolvedRetainUpsertSource,
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

function spansIssue(source: ResolvedRetainUpsertSource, spans: readonly RetainSourceSpan[]): string | null {
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
  const title = managedPageTitle(subject, slug);
  const stage: PageStage = {
    slug,
    relPath,
    before,
    after: before ?? newManagedPage(title),
  };
  stages.set(slug, stage);
  return stage;
}

async function preservedSourceStage(
  ctx: AknoContext,
  stages: Map<string, PageStage>,
  slug: string,
  input: RetainSourceInput,
): Promise<PageStage | { issue: string; reasonCode: RetainHoldReason }> {
  if (!('text' in input || 'items' in input)) {
    return { issue: 'only inline source input can be preserved', reasonCode: 'validation_failed' };
  }
  if (isReserved(slug, ctx.config)) {
    return { issue: 'preserved source destination is reserved', reasonCode: 'no_writable_destination' };
  }
  const content = serializePreservedSource(slug, input);
  const row = ctx.store.db
    .prepare('SELECT rel_path, role, remember_management FROM pages WHERE slug = ?')
    .get(slug) as { rel_path: string; role: string; remember_management: string } | undefined;
  if (row && (row.role !== 'source' || row.remember_management !== 'deny')) {
    return {
      issue: 'preserved source destination must be source + remember: deny',
      reasonCode: 'no_writable_destination',
    };
  }
  const relPath = row?.rel_path ?? `${slug}.md`;
  const absolute = path.join(ctx.config.aknoPath, relPath);
  if (row) {
    const before = await fsp.readFile(absolute, 'utf8').catch(() => null);
    if (before === null) {
      return { issue: 'preserved source destination is unreadable', reasonCode: 'source_unavailable' };
    }
    if (before !== content) {
      return {
        issue: 'preserved source destination already contains different bytes',
        reasonCode: 'conflict',
      };
    }
    const stage = { slug, relPath, before, after: before };
    stages.set(slug, stage);
    return stage;
  }
  if (await fsp.stat(absolute).catch(() => null)) {
    return { issue: 'an unindexed page exists at the preserved source destination', reasonCode: 'conflict' };
  }
  const policy = effectiveRule(slug, ctx.config.rules);
  const roleRule = declaringRule(slug, ctx.config.rules, 'role');
  const rememberRule = declaringRule(slug, ctx.config.rules, 'remember');
  if (policy.role !== 'source' || policy.remember !== 'deny' || !roleRule || !rememberRule) {
    return {
      issue: 'preserved source folder must explicitly declare role: source and remember: deny',
      reasonCode: 'no_writable_destination',
    };
  }
  const gate = ctx.gate.check(slug, ctx.actor);
  if (!gate.allowed) {
    return {
      issue: `preserved source folder is not declared: ${gate.requiresFolder.folder}`,
      reasonCode: 'no_writable_destination',
    };
  }
  const stage = { slug, relPath, before: null, after: content };
  stages.set(slug, stage);
  return stage;
}

function serializePreservedSource(slug: string, input: InlineRetainInput): string {
  const title = slugTitle(slug);
  const body =
    'text' in input
      ? input.text
      : input.items
          .map((item) => {
            const attributes = [
              `id=${encodeURIComponent(item.item_id)}`,
              ...(item.role ? [`role=${item.role}`] : []),
              ...(item.speaker ? [`speaker=${encodeURIComponent(item.speaker)}`] : []),
              ...(item.mentioned_at ? [`mentioned-at=${encodeURIComponent(item.mentioned_at)}`] : []),
            ];
            return `<!-- akno:source-item ${attributes.join(' ')} -->\n${item.text}`;
          })
          .join('\n\n');
  return `---\ntitle: ${serializeYamlString(title, 'title')}\nakno:\n  role: source\n  management:\n    remember: deny\n---\n\n# ${title}\n\n## Source\n\n${body}\n`;
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
  op: 'retain' | 'remember' = 'retain',
): Promise<{ changeId: string; files: ChangeFile[] } | null> {
  if (stages.length === 0) return null;
  for (const stage of stages) {
    if (
      quarantineReasonsForPath(ctx.store, stage.relPath).length > 0 ||
      matchesConflictPath(stage.relPath, ctx.config.index.conflictPathPatterns) ||
      hasInlineMergeConflict(stage.after)
    ) {
      throw new AknoError('conflict', 'retain destination is quarantined by Markdown conflict', {
        reason: 'source_conflict',
      });
    }
  }
  const files: ChangeFile[] = [];
  try {
    for (const stage of stages) {
      files.push(fileEntry(await writeFileAtomic(ctx.config.aknoPath, stage.relPath, stage.after)));
    }
    const changeId = ctx.journal.record({ actor: ctx.actor, op, summary, files });
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

async function reindexStages(ctx: AknoContext, stages: readonly PageStage[]): Promise<number> {
  if (stages.length === 0) return 0;
  const paths = stages.map((stage) => stage.relPath);
  const report = await ctx.indexer.runForeground({ only: paths, modelPaths: [] });
  ctx.derive.schedule(paths);
  return report.factsDerived;
}

function persistReceipt(
  ctx: AknoContext,
  input: {
    source: RetainUpsertSource | RetainRetraction;
    sourceHash: string;
    requestHash: string;
    receiptFingerprint: string;
    mode: 'provided_exact' | 'provided_automatic' | 'extract_automatic' | 'retract';
    result: RetainSourceResult;
    changeId: string | null;
    supports: readonly PendingSupport[];
    retracted: readonly SupportRow[];
    binding?: RetainSourceBinding;
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
    if (input.binding) {
      ctx.store.db
        .prepare(
          `INSERT INTO retain_source_bindings(
             receipt_fingerprint, input_kind, input_ref, preserved_slug,
             availability, reextractable, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.receiptFingerprint,
          input.binding.kind,
          input.binding.reference ?? null,
          input.binding.preservedSlug ?? null,
          input.binding.availability,
          input.binding.reextractable ? 1 : 0,
          now,
        );
    }
  });
  reconcileRetainManagedSources(ctx, [
    ...input.supports.map((support) => support.memory_id),
    ...input.retracted.map((support) => support.memory_id),
  ]);
  if (input.retracted.length > 0) pruneRetainEvidence(ctx, { apply: true });
}

function sourceEvidence(candidate: ProvidedRetainCandidate): string {
  return candidate.discourse_frame.map((span) => span.quote).join('\n…\n');
}

function sourceOrigin(role: ProvidedRetainCandidate['attribution']['source_role']): PendingSupport['origin'] {
  return role === 'user' || role === 'assistant' ? role : 'unknown';
}

function dependencyOrder<T extends ProvidedRetainCandidate>(
  candidates: readonly T[],
): {
  candidates: T[];
  blocked: Set<string>;
} {
  const byId = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const ordered: T[] = [];
  const blocked = new Set<string>();
  const visited = new Set<string>();
  const visiting: string[] = [];

  const visit = (candidate: T): boolean => {
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

function managedPageTitle(subject: string, slug: string): string {
  const cleaned = safeTitle(subject);
  if (!cleaned) return titleFromSlug(slug);
  const named = contentWords(slug.slice(slug.lastIndexOf('/') + 1));
  for (const word of contentWords(cleaned)) {
    if (named.has(word)) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return titleFromSlug(slug);
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
