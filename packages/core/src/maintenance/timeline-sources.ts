import fsp from 'node:fs/promises';
import path from 'node:path';
import { ProvidedRetainCandidate as ProvidedRetainCandidateSchema } from '@tenphi/akno-protocol';
import type {
  DegradedReason,
  RetainModelCallReceipt,
  RetainUpsertSource,
  TimelineDescriptor,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { indexScanIgnore } from '../config/load.ts';
import {
  prepareTimelineRetention,
  commitTimelineRetention,
  type PreparedTimelineRetention,
} from '../ops/retain.ts';
import { read } from '../ops/read.ts';
import { parsePage, resolvePagePolicy } from '../kb/page.ts';
import { declaringRule, effectiveRule } from '../rules/compile.ts';
import {
  hasInlineMergeConflict,
  quarantineReasonsForPath,
  matchesConflictPath,
} from '../index/page-quarantine.ts';
import { isReserved } from '../reserved.ts';
import { sha256 } from '../store/ids.ts';
import { owningTimeline, timelineCatalog } from '../timeline/boundaries.ts';
import {
  runRetain,
  verifyRetainTextRevision,
  RETAIN_PROMPT_VERSION,
  RETAIN_VERIFIER_VERSION,
  type RetainCandidate,
  type RetainResult,
} from '../write/retain.ts';
import type { MaintenanceOperation } from './plans.ts';
import type { TimelineHistoryDraft, TimelineHistoryReport } from './timeline-history.ts';
import { dependencyOrder } from '../write/retained-relations.ts';

interface SourceReference {
  slug: string;
  relPath: string;
  documentId?: string;
}
interface SourceSnapshot {
  text: string;
  files: { path: string; hash: string }[];
  hash: string;
}
interface SourceProgress {
  fingerprint: string;
  source?: SourceReference;
  sourceHash?: string;
  status: 'extracted' | 'pending' | 'complete' | 'held' | 'rejected' | 'undone';
  attemptedAt: number;
  candidates?: RetainCandidate[];
  accepted?: string[];
  memories?: Record<string, string>;
  incomplete?: boolean;
  changeId?: string;
  modelUsage?: RetainResult['modelUsage'];
  rejected?: string[];
  curatorContract?: string;
  ownerRejected?: string[];
  recoveredFrames?: { itemId: string; candidateIds: string[] }[];
  reason?: string;
  planId?: string;
  itemId?: string;
  sizeHold?: { reason: string; limits: string };
  revisionHold?: { feedback: string; reason: string; context: string };
}

const SOURCE_TEXT_LIMIT = 60_000;
const SEALED_SOURCE_LIMIT = 80_000;
export const SOURCE_TIMELINE_CURATOR_CONTRACT = 'scoped-source-temporal-items-v2';

export interface TimelineSourceProof {
  source: SourceReference;
  snapshot: SourceSnapshot;
  owner: string;
  destination: string;
  prepared: Pick<PreparedTimelineRetention, 'receipt'> & {
    // Earlier releases sealed full stages here; retain validation of those pending plans.
    stages: (
      | PreparedTimelineRetention['stages'][number]
      | {
          slug: string;
          relPath: string;
          beforeHash: string | null;
          afterHash: string;
        }
    )[];
  };
  extraction: { verifierVersion: string; verifiedCandidateIds: string[]; unfinishedSource: boolean };
  progressKey: string;
  progress: SourceProgress;
}

function sourceFingerprint(
  ctx: AknoContext,
  current: SourceSnapshot,
  source: SourceReference,
  owner: TimelineDescriptor,
): string {
  return sha256(
    JSON.stringify([
      current.hash,
      source,
      owner,
      ctx.config.rules,
      ctx.config.ignore,
      ctx.config.index.conflictPathPatterns,
      ctx.models.derive.endpointFingerprint,
      RETAIN_PROMPT_VERSION,
      RETAIN_VERIFIER_VERSION,
      'source-timeline-v2',
    ]),
  );
}

function progressKey(source: SourceReference): string {
  return `timeline-source:v1:${sha256(source.documentId ?? source.relPath)}`;
}
function progress(ctx: AknoContext, key: string): SourceProgress | null {
  try {
    return JSON.parse(ctx.store.meta(key) ?? 'null') as SourceProgress | null;
  } catch {
    return null;
  }
}
function record(ctx: AknoContext, key: string, value: SourceProgress, enabled: boolean): void {
  if (enabled && ctx.writable) ctx.store.setMeta(key, JSON.stringify(value));
}

function sourceDecisionChanged(state: SourceProgress | null): boolean {
  return Boolean(
    state &&
    (state.status === 'rejected' ||
      state.rejected?.length ||
      (state.curatorContract && ['held', 'complete'].includes(state.status) && !state.candidates?.length)) &&
    state.curatorContract !== SOURCE_TIMELINE_CURATOR_CONTRACT,
  );
}

/** Old rejection cursors omitted their item ID; sealed receipts still identify each decision. */
function legacyOwnerRejections(ctx: AknoContext, key: string, state: SourceProgress): string[] {
  const actors = new Map<string, Set<string>>();
  const rows = ctx.store.db
    .prepare(
      `
    SELECT item.decision_actor, evidence.value AS proof
    FROM maintenance_items AS item, json_each(item.evidence) AS evidence
    WHERE item.decision_outcome = 'reject'
      AND json_extract(evidence.value, '$.timelineHistory.retention.progressKey') = ?
      AND json_extract(evidence.value, '$.timelineHistory.retention.progress.fingerprint') = ?
  `,
    )
    .all(key, state.fingerprint) as { decision_actor: string | null; proof: string }[];
  for (const row of rows) {
    const proof = JSON.parse(row.proof).timelineHistory.retention as TimelineSourceProof;
    for (const candidate of proof.prepared.receipt.result.candidates) {
      if (!['written', 'support_added', 'duplicate'].includes(candidate.outcome)) continue;
      const known = actors.get(candidate.candidate_id) ?? new Set<string>();
      known.add(row.decision_actor ?? 'unknown');
      actors.set(candidate.candidate_id, known);
    }
  }
  // Only positively identified curator rejections may be retried. Any human or unknown
  // decision stays closed, including mixed batches and missing historical metadata.
  return (state.rejected ?? []).filter((id) => {
    const known = actors.get(id);
    return !known || known.has('human') || known.has('unknown') || !known.has('curator');
  });
}

/** Reuse only the exact frames already verified against this unchanged source revision. */
function verifiedRejectedFrames(
  ctx: AknoContext,
  key: string,
  state: SourceProgress,
  current: SourceSnapshot,
  owner: TimelineDescriptor,
) {
  const rows = ctx.store.db
    .prepare(
      `
    SELECT item.id, item.decision_actor, evidence.value AS proof
    FROM maintenance_items AS item, json_each(CASE WHEN json_valid(item.evidence) THEN item.evidence ELSE '[]' END) AS evidence
    WHERE item.kind = 'timeline_history' AND item.decision_outcome = 'reject'
      AND json_extract(CASE WHEN evidence.type = 'object' THEN evidence.value ELSE '{}' END, '$.timelineHistory.retention.progressKey') = ?
      AND json_extract(CASE WHEN evidence.type = 'object' THEN evidence.value ELSE '{}' END, '$.timelineHistory.retention.snapshot.hash') = ?
    ORDER BY item.rowid DESC
  `,
    )
    .all(key, current.hash) as { id: string; decision_actor: string | null; proof: string }[];
  const blocked = new Set([...(state.ownerRejected ?? []), ...(state.accepted ?? [])]);
  const ownerRejected = new Set(state.ownerRejected ?? []);
  const frames = new Map<string, { candidate: RetainCandidate; itemId: string }>();
  let modelUsage: RetainResult['modelUsage'] | undefined;
  for (const row of rows) {
    const proof = JSON.parse(row.proof).timelineHistory.retention as TimelineSourceProof;
    if (proof.owner !== owner.slug || proof.snapshot.text !== current.text) continue;
    if (!Array.isArray(proof.prepared?.receipt?.result?.candidates)) continue;
    const admitted = proof.prepared.receipt.result.candidates
      .filter((item) => ['written', 'support_added', 'duplicate'].includes(item.outcome))
      .map((item) => item.candidate_id);
    if (
      row.decision_actor !== 'curator' ||
      (proof.progress?.curatorContract === SOURCE_TIMELINE_CURATOR_CONTRACT &&
        proof.progress.fingerprint === state.fingerprint)
    ) {
      for (const id of admitted) {
        blocked.add(id);
        if (row.decision_actor !== 'curator') ownerRejected.add(id);
      }
      continue;
    }
    const source = proof.prepared.receipt.source;
    if (
      proof.snapshot.hash !== current.hash ||
      proof.snapshot.text !== current.text ||
      proof.extraction?.verifierVersion !== RETAIN_VERIFIER_VERSION ||
      !source ||
      !('input' in source) ||
      source.retention?.mode !== 'provided' ||
      !Array.isArray(source.retention.candidates) ||
      !Array.isArray(proof.extraction?.verifiedCandidateIds) ||
      typeof proof.progress?.fingerprint !== 'string'
    )
      continue;
    const sealed = source.retention.candidates;
    // Initial preparation adds exact placement after hashing; prose revisions hash those
    // destinations too. In either format the unchanged revision must seal every frame field.
    const revision = (sealedFrames: typeof sealed) =>
      sha256(JSON.stringify([proof.progress.fingerprint, sealedFrames]));
    if (
      source.revision !== revision(sealed) &&
      source.revision !== revision(sealed.map((frame) => ({ ...frame, destination: undefined })))
    )
      continue;
    const verified = new Set(proof.extraction.verifiedCandidateIds);
    for (const value of source.retention.candidates) {
      const parsed = ProvidedRetainCandidateSchema.safeParse(value);
      if (
        !parsed.success ||
        !admitted.includes(parsed.data.candidate_id) ||
        !verified.has(parsed.data.candidate_id) ||
        !parsed.data.time ||
        parsed.data.time.precision === 'unknown' ||
        !(parsed.data.time.start || parsed.data.time.until) ||
        /[\r\n]|<!--|\[\[/u.test(parsed.data.text) ||
        parsed.data.epistemic.basis !== 'source_report'
      )
        continue;
      const id = parsed.data.candidate_id;
      if (!frames.has(id)) frames.set(id, { candidate: { ...value, ...parsed.data }, itemId: row.id });
      modelUsage ??= {
        extraction: proof.prepared.receipt.result.model_usage?.extraction ?? null,
        verification: proof.prepared.receipt.result.model_usage?.verification ?? null,
      };
    }
  }
  const candidates: RetainCandidate[] = [];
  const provenance = new Map<string, string[]>();
  for (const [id, frame] of frames) {
    if (blocked.has(id)) continue;
    candidates.push(frame.candidate);
    const ids = provenance.get(frame.itemId) ?? [];
    ids.push(id);
    provenance.set(frame.itemId, ids);
  }
  return {
    candidates,
    closed: [...blocked],
    ownerRejected: [...ownerRejected],
    modelUsage,
    provenance: [...provenance].map(([itemId, candidateIds]) => ({ itemId, candidateIds })),
  };
}

/** This is the ledger's narrow canonical companion, not a grant over other source pages. */
async function destinationAllowed(ctx: AknoContext, owner: TimelineDescriptor): Promise<boolean> {
  const slug = `${owner.slug}-memories`;
  if (
    isReserved(slug, ctx.config) ||
    owningTimeline(timelineCatalog(ctx.config, ctx.store), slug).slug !== owner.slug
  )
    return false;
  for (const field of ['role', 'remember'] as const) {
    const rule = declaringRule(slug, ctx.config.rules, field);
    if (
      rule &&
      !/^[*?]+$/u.test(path.posix.basename(rule.glob)) &&
      (field === 'role' ? rule.role !== 'knowledge' : rule.remember === 'deny')
    )
      return false;
  }
  if (effectiveRule(slug, ctx.config.rules).role === 'ignored' || ignoredPath(ctx, `${slug}.md`))
    return false;
  const bytes = await safeBytes(ctx, `${slug}.md`);
  if (bytes === null) {
    // Missing is admitted, but an unreadable/symlink/unindexed collision is not.
    return !(await fsp.lstat(path.join(ctx.config.aknoPath, `${slug}.md`)).catch(() => null));
  }
  const page = parsePage(`${slug}.md`, bytes.toString('utf8'));
  const policy = resolvePagePolicy(
    page,
    effectiveRule(slug, ctx.config.rules),
    ctx.config.paths.observations,
  );
  return (
    bytes.toString('utf8').includes('<!-- akno:timeline-memories -->') &&
    policy.role === 'knowledge' &&
    policy.remember === 'integrate' &&
    !hasInlineMergeConflict(page.body)
  );
}

function ignoredPath(ctx: AknoContext, relPath: string): boolean {
  const ignored = new Set(indexScanIgnore(ctx.config.ignore).map((item) => item.replace(/\/+$/u, '')));
  const parts = relPath.split('/');
  return parts.some(
    (part, index) =>
      part.startsWith('.') || ignored.has(part) || ignored.has(parts.slice(0, index + 1).join('/')),
  );
}

async function safeBytes(ctx: AknoContext, relPath: string): Promise<Buffer | null> {
  if (path.isAbsolute(relPath) || relPath.split(/[\\/]/u).some((part) => part === '..')) return null;
  if (
    quarantineReasonsForPath(ctx.store, relPath).length ||
    matchesConflictPath(relPath, ctx.config.index.conflictPathPatterns) ||
    ignoredPath(ctx, relPath)
  )
    return null;
  let current = ctx.config.aknoPath;
  for (const part of relPath.split('/')) {
    current = path.join(current, part);
    const stat = await fsp.lstat(current).catch(() => null);
    if (!stat || stat.isSymbolicLink()) return null;
  }
  return fsp.readFile(current).catch(() => null);
}

function sourceEligible(ctx: AknoContext, source: SourceReference, text?: string): boolean {
  if (isReserved(source.slug, ctx.config)) return false;
  const rule = effectiveRule(source.slug, ctx.config.rules);
  const page = parsePage(source.relPath, source.documentId ? '' : (text ?? ''));
  const policy = resolvePagePolicy(page, rule, ctx.config.paths.observations);
  return (
    policy.role === 'source' &&
    !/[\r\n[\]|#]/u.test(source.slug) &&
    !(text && (hasInlineMergeConflict(text) || /<!--\s*akno:item\b/u.test(text)))
  );
}

async function snapshot(ctx: AknoContext, source: SourceReference): Promise<SourceSnapshot | null> {
  if (!source.documentId) {
    const bytes = await safeBytes(ctx, source.relPath);
    if (!bytes || !sourceEligible(ctx, source, bytes.toString('utf8'))) return null;
    const text = bytes.toString('utf8');
    return { text, files: [{ path: source.relPath, hash: sha256(bytes) }], hash: sha256(bytes) };
  }
  if (!sourceEligible(ctx, source)) return null;
  const parts = ctx.store.db
    .prepare(
      `SELECT rel_path, sha256, extracted_sha FROM documents WHERE group_key =
    (SELECT group_key FROM documents WHERE id = ?) AND renders IS NULL ORDER BY part`,
    )
    .all(source.documentId) as { rel_path: string; sha256: string; extracted_sha: string | null }[];
  const files: SourceSnapshot['files'] = [];
  const catalog = timelineCatalog(ctx.config, ctx.store);
  const owner = owningTimeline(catalog, source.slug).slug;
  for (const part of parts) {
    const member = {
      slug: part.rel_path.replace(/\.[^.]+$/u, ''),
      relPath: part.rel_path,
      documentId: source.documentId,
    };
    if (!sourceEligible(ctx, member) || owningTimeline(catalog, member.slug).slug !== owner) return null;
    const bytes = await safeBytes(ctx, part.rel_path);
    if (!bytes || sha256(bytes) !== part.sha256 || (part.extracted_sha && part.extracted_sha !== part.sha256))
      return null;
    files.push({ path: part.rel_path, hash: sha256(bytes) });
  }
  if (!files.length) return null;
  const output = await read(ctx, { document: source.documentId });
  if (output.status !== 'ok' || !output.document?.text) return null;
  const text = output.document.text;
  if (hasInlineMergeConflict(text) || /<!--\s*akno:item\b/u.test(text)) return null;
  return { text, files, hash: sha256(JSON.stringify({ files, text })) };
}

/** Extract once per source revision; incomplete/held work never becomes a successful scan. */
export async function planTimelineSources(
  ctx: AknoContext,
  catalog: TimelineDescriptor[],
  options: { recordState?: boolean; protectedPaths?: ReadonlySet<string> },
): Promise<{ drafts: TimelineHistoryDraft[]; report: TimelineHistoryReport; degraded: DegradedReason[] }> {
  const report: TimelineHistoryReport = { inspected: 0, cached: 0, additions: 0, relocations: 0, held: {} };
  const degraded = new Set<DegradedReason>();
  const done = (drafts: TimelineHistoryDraft[] = []) => ({ drafts, report, degraded: [...degraded] });
  const hold = (reason: keyof TimelineHistoryReport['held']) => {
    report.held[reason] = (report.held[reason] ?? 0) + 1;
  };
  const pages = ctx.store.db
    .prepare("SELECT slug, rel_path AS relPath FROM pages WHERE role = 'source' ORDER BY rel_path")
    .all() as SourceReference[];
  const documents = ctx.store.db
    .prepare(
      `SELECT id AS documentId, rel_path AS relPath FROM documents
    WHERE renders IS NULL AND part = 1 AND availability = 'available' ORDER BY rel_path`,
    )
    .all() as Omit<SourceReference, 'slug'>[];
  const sources: SourceReference[] = [
    ...pages,
    ...documents.map((row) => ({ ...row, slug: row.relPath.replace(/\.[^.]+$/u, '') })),
  ];
  const known = new Set(sources.map((item) => progressKey(item)));
  const recorded = ctx.store.db
    .prepare("SELECT value FROM meta WHERE key LIKE 'timeline-source:v1:%'")
    .all() as { value: string }[];
  for (const row of recorded) {
    try {
      const stored = JSON.parse(row.value) as SourceProgress;
      if (stored.source && !known.has(progressKey(stored.source))) {
        sources.push(stored.source);
        known.add(progressKey(stored.source));
      }
    } catch {
      /* Corrupt private progress does not nominate new source paths. */
    }
  }
  // Give changed decision contracts one pass before the unprocessed backlog. Once marked
  // current, ordinary oldest-attempt ordering resumes; negative caches cannot hog the budget.
  const states = new Map(sources.map((source) => [progressKey(source), progress(ctx, progressKey(source))]));
  sources.sort((a, b) => {
    const left = states.get(progressKey(a)) ?? null;
    const right = states.get(progressKey(b)) ?? null;
    return (
      Number(sourceDecisionChanged(right)) - Number(sourceDecisionChanged(left)) ||
      (left?.attemptedAt ?? 0) - (right?.attemptedAt ?? 0) ||
      a.relPath.localeCompare(b.relPath)
    );
  });
  sourceLoop: for (const source of sources) {
    const owner = owningTimeline(catalog, source.slug);
    const destination = `${owner.slug}-memories`;
    if (owner.status !== 'ready' || !owner.writable) {
      hold('destination_unavailable');
      continue;
    }
    if (
      catalog.some((entry) => entry.path === source.relPath) ||
      options.protectedPaths?.has(source.relPath) ||
      options.protectedPaths?.has(owner.path) ||
      options.protectedPaths?.has(`${destination}.md`)
    )
      continue;
    if (report.inspected >= ctx.config.maintenance.curate.maxPages) {
      hold('limit');
      break;
    }
    const current = await snapshot(ctx, source);
    if (!current) {
      hold('source_unavailable');
      const old = progress(ctx, progressKey(source));
      if (old)
        record(
          ctx,
          progressKey(source),
          { ...old, status: 'held', reason: 'source is unavailable or no longer eligible' },
          options.recordState ?? false,
        );
      continue;
    }
    const fingerprint = sourceFingerprint(ctx, current, source, owner);
    const sizeLimits = sha256(
      JSON.stringify([SOURCE_TEXT_LIMIT, SEALED_SOURCE_LIMIT, ctx.config.maxPageBytes]),
    );
    const key = progressKey(source);
    let state = progress(ctx, key);
    if (
      state?.sourceHash === current.hash &&
      state.changeId &&
      (
        ctx.store.db.prepare('SELECT status FROM changes WHERE id = ?').get(state.changeId) as
          { status: string } | undefined
      )?.status === 'undone'
    ) {
      state = { ...state, status: 'undone', reason: 'owner undid the applied source retention' };
      record(ctx, key, state, options.recordState ?? false);
    }
    if (state?.status === 'undone' && state.sourceHash === current.hash) {
      report.cached++;
      continue;
    }
    if (state?.fingerprint !== fingerprint) state = null;
    if (!state) {
      const fresh: SourceProgress = {
        fingerprint,
        source,
        sourceHash: current.hash,
        status: 'extracted',
        attemptedAt: Date.now(),
        accepted: [],
        rejected: [],
        memories: {},
      };
      const recovered = verifiedRejectedFrames(ctx, key, fresh, current, owner);
      if (recovered.candidates.length || recovered.closed.length) {
        // Grounding belongs to the source/verifier revision. Fresh placement and curator
        // decisions still evaluate the current purpose and write policy before any admission.
        state = {
          ...fresh,
          candidates: recovered.candidates.length ? recovered.candidates : undefined,
          rejected: recovered.closed,
          ownerRejected: recovered.ownerRejected,
          recoveredFrames: recovered.provenance,
          modelUsage: recovered.modelUsage,
          incomplete: recovered.candidates.length > 0,
          curatorContract: SOURCE_TIMELINE_CURATOR_CONTRACT,
        };
        record(ctx, key, state, options.recordState ?? false);
      }
    }
    if (state && sourceDecisionChanged(state)) {
      // Reconsider old negative decisions under a changed decision contract. Completed sources
      // keep their extraction cache; older dropped frames can be recovered from sealed receipts.
      const recovered = verifiedRejectedFrames(ctx, key, state, current, owner);
      const ownerRejected = [
        ...new Set([
          ...(state.ownerRejected ?? legacyOwnerRejections(ctx, key, state)),
          ...recovered.ownerRejected,
        ]),
      ];
      const reconsider = (state.rejected ?? []).filter((id) => !ownerRejected.includes(id));
      const wanted = new Set([...reconsider, ...recovered.candidates.map((item) => item.candidate_id)]);
      state = { ...state, ownerRejected, curatorContract: SOURCE_TIMELINE_CURATOR_CONTRACT };
      if (wanted.size) {
        const frames = new Map((state.candidates ?? []).map((item) => [item.candidate_id, item]));
        for (const candidate of recovered.candidates)
          if (!frames.has(candidate.candidate_id)) frames.set(candidate.candidate_id, candidate);
        const missing = [...wanted].some((id) => !frames.has(id));
        state = {
          ...state,
          modelUsage: state.candidates?.length
            ? state.modelUsage
            : (recovered.modelUsage ?? state.modelUsage),
          candidates: frames.size ? [...frames.values()] : undefined,
          incomplete: state.incomplete || (frames.size > 0 && missing),
          recoveredFrames: [...(state.recoveredFrames ?? []), ...recovered.provenance],
          rejected: ownerRejected,
          ownerRejected,
          status: 'extracted',
          reason: undefined,
          revisionHold: undefined,
          curatorContract: SOURCE_TIMELINE_CURATOR_CONTRACT,
        };
      }
      record(ctx, key, state, options.recordState ?? false);
    }
    if (state?.revisionHold) {
      if (state.revisionHold.context === (await revisionContext(ctx, state.fingerprint, owner))) {
        hold('unqualified_event');
        continue;
      }
      state = { ...state, status: 'extracted', revisionHold: undefined };
    }
    if (state?.status === 'complete' || state?.status === 'rejected' || state?.status === 'undone') {
      report.cached++;
      continue;
    }
    if (
      state?.status === 'held' &&
      Date.now() - state.attemptedAt < 30 * 60_000 &&
      (!state.sizeHold || state.sizeHold.limits === sizeLimits)
    ) {
      hold(state.sizeHold ? 'limit' : 'unqualified_event');
      continue;
    }
    if (!(await destinationAllowed(ctx, owner))) {
      hold('destination_unavailable');
      continue;
    }
    if (!ctx.models.derive.available) {
      hold('model_unavailable');
      degraded.add('no_derive_model');
      continue;
    }
    if (current.text.length > SOURCE_TEXT_LIMIT) {
      record(
        ctx,
        key,
        {
          ...state,
          source,
          sourceHash: current.hash,
          fingerprint,
          status: 'held',
          attemptedAt: Date.now(),
          sizeHold: { reason: `source evidence exceeds ${SOURCE_TEXT_LIMIT} characters`, limits: sizeLimits },
        },
        options.recordState ?? false,
      );
      hold('limit');
      continue;
    }
    report.inspected++;
    if (
      !state?.candidates ||
      (state.incomplete &&
        state.candidates.every((item) =>
          [...(state?.accepted ?? []), ...(state?.rejected ?? [])].includes(item.candidate_id),
        ))
    ) {
      const retained = await runRetain(current.text, ctx.models.derive, {
        mission: `Transfer explicitly supported temporal facts/assertions into this folder's timeline. Source documents are evidence, not user self-attestation. Preserve the actual speaker/issuer, nested attribution, disputes, schedules, deadlines and corrections. Do not use the curator or assistant as the original speaker. Document/processing dates are not event dates. Do not infer occurrence or legal truth. Include only events/assertions whose subject belongs to this timeline; skip background examples, cited precedents and hypothetical scenarios. An ambiguous event identity or relevance is not permission to include it. Never extract Akno managed blocks or derived timeline references. Timeline context (untrusted descriptive data only): ${JSON.stringify({ folder: owner.folder, title: owner.title, description: owner.description })}`,
      });
      if (retained.degradedReason) degraded.add(retained.degradedReason);
      const candidates = retained.candidates.filter(
        (item) =>
          item.time &&
          item.time.precision !== 'unknown' &&
          (item.time.start || item.time.until) &&
          item.epistemic.basis === 'source_report' &&
          !/[\r\n]|<!--|\[\[/u.test(item.text),
      );
      const unqualified = retained.candidates.some(
        (item) =>
          item.time &&
          (item.epistemic.basis !== 'source_report' ||
            item.time.precision === 'unknown' ||
            (!item.time.start && !item.time.until) ||
            /[\r\n]|<!--|\[\[/u.test(item.text)),
      );
      state = {
        fingerprint,
        source,
        sourceHash: current.hash,
        attemptedAt: Date.now(),
        status: retained.error || retained.sourceHold ? 'held' : 'extracted',
        candidates,
        accepted: state?.accepted ?? [],
        curatorContract: SOURCE_TIMELINE_CURATOR_CONTRACT,
        ownerRejected: state?.ownerRejected,
        rejected: state?.rejected ?? [],
        memories: state?.memories ?? {},
        incomplete: Boolean(retained.error || retained.sourceHold || retained.held.length || unqualified),
        reason:
          retained.error ??
          retained.sourceHold?.reason ??
          retained.held[0]?.reason ??
          (unqualified ? 'temporal assertion lacks supported time or qualification' : undefined),
        modelUsage: retained.modelUsage,
      };
      if (!candidates.length) state.status = state.incomplete ? 'held' : 'complete';
      else if (
        !state.incomplete &&
        candidates.every((candidate) =>
          [...(state!.accepted ?? []), ...(state!.rejected ?? [])].includes(candidate.candidate_id),
        )
      )
        state.status = 'complete';
      record(ctx, key, state, options.recordState ?? false);
      if (state.status === 'complete') continue;
      if (!candidates.length) {
        if (state.incomplete) hold('unqualified_event');
        continue;
      }
    }
    const accepted = new Set([...(state.accepted ?? []), ...(state.rejected ?? [])]);
    const remaining = state
      .candidates!.filter((item) => !accepted.has(item.candidate_id))
      .map((item) => ({
        ...item,
        relations: (item.relations ?? []).map((relation) => {
          const memoryId =
            'candidate_id' in relation.target ? state?.memories?.[relation.target.candidate_id] : undefined;
          return memoryId ? { ...relation, target: { memory_id: memoryId } } : relation;
        }),
      }));
    let candidates = dependencyOrder(remaining).candidates.slice(
      0,
      Math.min(50, ctx.config.maintenance.curate.maxTimelineEvents),
    );
    if (!candidates.length) {
      hold('unqualified_event');
      continue;
    }
    // Dependency-ordered prefixes can be shortened without dropping a selected item's target.
    // Preparing a smaller batch is side-effect-free and reuses the verified extraction.
    while (candidates.length) {
      const revision = sha256(JSON.stringify([fingerprint, candidates]));
      const prior = ctx.store.db
        .prepare('SELECT source_group FROM retain_receipts WHERE source_id = ? LIMIT 1')
        .get(`akno:timeline:${sha256(source.documentId ?? source.relPath)}`) as
        { source_group: string } | undefined;
      const input: RetainUpsertSource = {
        source_id: `akno:timeline:${sha256(source.documentId ?? source.relPath)}`,
        revision,
        source_group: prior?.source_group ?? `timeline-evidence:${sha256(current.text)}`,
        source_kind: 'document',
        input: source.documentId ? { document_id: source.documentId } : { page_slug: source.slug },
        retention: {
          mode: 'provided',
          placement: 'exact',
          knowledge_language: ctx.config.knowledgeLanguage ?? undefined,
          candidates: candidates.map((item) => ({
            ...item,
            destination: { slug: destination, section: 'Temporal memories' },
          })),
        },
      };
      const result = await prepareTimelineRetention(
        ctx,
        input,
        input.retention.mode === 'provided' ? input.retention.candidates : [],
        destination,
        current.text,
      );
      const prepared = result.prepared;
      for (const reason of result.result.degraded ?? []) degraded.add(reason);
      if (prepared && state.modelUsage)
        prepared.receipt.result.model_usage = {
          ...state.modelUsage,
          placement: prepared.receipt.result.model_usage?.placement ?? [],
        };
      const successful = result.result.candidates
        .filter((item) => ['written', 'support_added', 'duplicate'].includes(item.outcome))
        .map((item) => item.candidate_id);
      if (
        !prepared ||
        !prepared.stages.length ||
        !successful.length ||
        prepared.stages.some((stage) => stage.before === stage.after)
      ) {
        record(
          ctx,
          key,
          {
            ...state,
            sizeHold: undefined,
            status: 'held',
            attemptedAt: Date.now(),
            reason: result.result.note ?? 'retention held',
          },
          options.recordState ?? false,
        );
        hold('unqualified_event');
        continue sourceLoop;
      }
      if (prepared.stages.some((stage) => options.protectedPaths?.has(stage.relPath))) {
        hold('limit');
        continue sourceLoop;
      }
      const nextAccepted = [...new Set([...(state.accepted ?? []), ...successful])];
      const allHandled = state.candidates!.every(
        (item) =>
          nextAccepted.includes(item.candidate_id) || (state.rejected ?? []).includes(item.candidate_id),
      );
      const complete = !state.incomplete && allHandled;
      const next: SourceProgress = {
        ...state,
        sizeHold: undefined,
        accepted: nextAccepted,
        memories: {
          ...state.memories,
          ...Object.fromEntries(
            result.result.candidates
              .filter((item) => item.memory_id && successful.includes(item.candidate_id))
              .map((item) => [item.candidate_id, item.memory_id!]),
          ),
        },
        status: complete ? 'complete' : state.incomplete && allHandled ? 'held' : 'extracted',
        attemptedAt: Date.now(),
        // Receipts retain completed assertions; the continuation cursor only needs unfinished ones.
        candidates: complete
          ? undefined
          : state.candidates!.filter(
              (item) =>
                !nextAccepted.includes(item.candidate_id) &&
                !(state.rejected ?? []).includes(item.candidate_id),
            ),
      };
      const proof: TimelineSourceProof = {
        source,
        snapshot: current,
        owner: owner.slug,
        destination,
        prepared: {
          receipt: prepared.receipt,
          // The exact before/after bytes already live in operations. Seal their identity once.
          stages: prepared.stages.map((stage) => ({
            slug: stage.slug,
            relPath: stage.relPath,
            beforeHash: stage.before === null ? null : sha256(stage.before),
            afterHash: sha256(stage.after),
          })),
        },
        extraction: {
          verifierVersion: RETAIN_VERIFIER_VERSION,
          verifiedCandidateIds: candidates.map((item) => item.candidate_id),
          unfinishedSource: Boolean(state.incomplete),
        },
        progressKey: key,
        progress: next,
      };
      const operations: MaintenanceOperation[] = prepared.stages.map((stage) =>
        stage.before === null
          ? { type: 'create', relPath: stage.relPath, after: stage.after, afterHash: sha256(stage.after) }
          : {
              type: 'replace',
              relPath: stage.relPath,
              before: stage.before,
              after: stage.after,
              beforeHash: sha256(stage.before),
              afterHash: sha256(stage.after),
            },
      );
      const pageTooLarge = operations.some(
        (op) => 'after' in op && Buffer.byteLength(op.after) > ctx.config.maxPageBytes,
      );
      const historyProof = { boundaries: '', catalog, sources: [], scans: [], actions: [], retention: proof };
      const sealedTooLarge = JSON.stringify({ proof: historyProof, operations }).length > SEALED_SOURCE_LIMIT;
      if (pageTooLarge || sealedTooLarge) {
        if (candidates.length > 1) {
          candidates = candidates.slice(0, Math.max(1, Math.floor(candidates.length / 2)));
          continue;
        }
        record(
          ctx,
          key,
          {
            ...state,
            status: 'held',
            attemptedAt: Date.now(),
            sizeHold: {
              reason: pageTooLarge
                ? `single-candidate retention exceeds the ${ctx.config.maxPageBytes}-byte page limit`
                : `single-candidate retention exceeds the ${SEALED_SOURCE_LIMIT}-character sealed evidence limit`,
              limits: sizeLimits,
            },
          },
          options.recordState ?? false,
        );
        hold('limit');
        continue sourceLoop;
      }
      operations.sort((a, b) => Number(a.type === 'create') - Number(b.type === 'create'));
      report.additions += result.result.candidates.filter((item) => item.outcome === 'written').length;
      return done([
        {
          slug: parsePage(operations[0]!.relPath, 'after' in operations[0]! ? operations[0]!.after : '').slug,
          inputHash: revision,
          operations,
          proof: historyProof,
        },
      ]);
    }
  }
  return done();
}

export async function timelineSourceIssue(
  ctx: AknoContext,
  proof: TimelineSourceProof,
  operations: MaintenanceOperation[],
  catalog: TimelineDescriptor[],
  validationStage: 'before' | 'after',
): Promise<string | null> {
  const owner = catalog.find((entry) => entry.slug === proof.owner);
  if (
    !owner?.writable ||
    owner.status !== 'ready' ||
    owningTimeline(catalog, proof.source.slug).slug !== owner.slug ||
    proof.destination !== `${owner.slug}-memories` ||
    !(await destinationAllowed(ctx, owner))
  )
    return 'source timeline authority or ownership changed';
  const current = await snapshot(ctx, proof.source);
  if (!current || current.hash !== proof.snapshot.hash)
    return 'timeline source evidence changed or became unavailable';
  if (
    validationStage === 'before' &&
    sourceFingerprint(ctx, current, proof.source, owner) !== proof.progress.fingerprint
  )
    return 'timeline source context, processing contract or policy changed';
  if (
    proof.extraction.verifierVersion !== RETAIN_VERIFIER_VERSION ||
    proof.prepared.receipt.result.candidates.some(
      (candidate) =>
        ['written', 'support_added', 'duplicate'].includes(candidate.outcome) &&
        !proof.extraction.verifiedCandidateIds.includes(candidate.candidate_id),
    )
  )
    return 'timeline source batch lacks independently verified candidate membership';
  if (
    operations.length !== proof.prepared.stages.length ||
    proof.prepared.stages.some(
      (stage) =>
        !operations.some(
          (op) =>
            op.relPath === stage.relPath &&
            'after' in op &&
            ('after' in stage
              ? op.after === stage.after &&
                (op.type === 'create'
                  ? stage.before === null
                  : op.type === 'replace' && op.before === stage.before)
              : sha256(op.after) === stage.afterHash &&
                (op.type === 'create'
                  ? stage.beforeHash === null
                  : op.type === 'replace' && sha256(op.before) === stage.beforeHash)),
        ),
    )
  )
    return 'timeline source operation exceeds sealed retention';
  if (
    proof.prepared.receipt.supports.some(
      (support) =>
        !operations.some(
          (op) =>
            op.relPath === proof.prepared.stages.find((stage) => stage.slug === support.slug)?.relPath &&
            'after' in op &&
            op.after.includes(`akno:item ${support.memory_id} `),
        ),
    )
  )
    return 'timeline support lost its canonical identity';
  return null;
}

export function recordTimelineSourceDecision(
  ctx: AknoContext,
  proof: TimelineSourceProof,
  changeId?: string,
  actor?: 'human' | 'curator',
): void {
  if (changeId) {
    // Receipt/support membership and the successful source cursor must advance together.
    ctx.store.db.transaction(() => {
      commitTimelineRetention(ctx, proof.prepared, changeId);
      const owner = owningTimeline(timelineCatalog(ctx.config, ctx.store), proof.source.slug);
      record(
        ctx,
        proof.progressKey,
        {
          ...proof.progress,
          fingerprint: sourceFingerprint(ctx, proof.snapshot, proof.source, owner),
          changeId,
        },
        true,
      );
    })();
  } else {
    const prior = progress(ctx, proof.progressKey);
    const selected = proof.prepared.receipt.result.candidates
      .filter((item) => ['written', 'support_added', 'duplicate'].includes(item.outcome))
      .map((item) => item.candidate_id);
    const rejected = [...new Set([...(prior?.rejected ?? []), ...selected])];
    const state = {
      ...proof.progress,
      planId: prior?.planId,
      itemId: prior?.itemId,
      candidates: prior?.candidates ?? proof.progress.candidates,
      accepted: prior?.accepted ?? [],
      memories: prior?.memories ?? {},
      rejected,
      curatorContract: SOURCE_TIMELINE_CURATOR_CONTRACT,
      ownerRejected: [...new Set([...(prior?.ownerRejected ?? []), ...(actor === 'human' ? selected : [])])],
      status: 'rejected' as SourceProgress['status'],
      attemptedAt: Date.now(),
      reason: 'curator rejected sealed source retention',
    };
    if (
      state.candidates &&
      state.candidates.some(
        (item) => !rejected.includes(item.candidate_id) && !state.accepted.includes(item.candidate_id),
      )
    )
      state.status = 'extracted';
    record(ctx, proof.progressKey, state, true);
  }
}

export function recordTimelineSourcePlan(
  ctx: AknoContext,
  proof: TimelineSourceProof,
  planId: string,
  itemId: string,
): void {
  const current = progress(ctx, proof.progressKey);
  if (current?.fingerprint === proof.progress.fingerprint)
    record(ctx, proof.progressKey, { ...current, status: 'pending', planId, itemId }, true);
}

const SOURCE_REVISION_CONTRACT = 'source-text-revision-v1';
async function revisionContext(
  ctx: AknoContext,
  fingerprint: string,
  owner: TimelineDescriptor,
): Promise<string> {
  return sha256(
    JSON.stringify([
      SOURCE_REVISION_CONTRACT,
      SOURCE_TIMELINE_CURATOR_CONTRACT,
      fingerprint,
      await safeBytes(ctx, owner.path),
      await safeBytes(ctx, `${owner.slug}-memories.md`),
    ]),
  );
}

/** A refused correction is unfinished work, not a rejection or an applied source cursor. */
export async function holdTimelineSourceRevision(
  ctx: AknoContext,
  proof: TimelineSourceProof,
  feedback: string,
  reason: string,
): Promise<void> {
  const current = progress(ctx, proof.progressKey);
  const owner = timelineCatalog(ctx.config, ctx.store).find((entry) => entry.slug === proof.owner);
  if (!current || current.fingerprint !== proof.progress.fingerprint || !owner) return;
  record(
    ctx,
    proof.progressKey,
    {
      ...current,
      status: 'held',
      attemptedAt: Date.now(),
      reason: 'source curator revision requires a supported correction',
      revisionHold: { feedback, reason, context: await revisionContext(ctx, current.fingerprint, owner) },
    },
    true,
  );
}

/** Rebuild the receipt and both projections from independently reverified statements. */
export async function reviseTimelineSource(
  ctx: AknoContext,
  proof: TimelineSourceProof,
  operations: MaintenanceOperation[],
  replacements: readonly { candidate_id: string; text: string }[],
  correctionReceipt: RetainModelCallReceipt,
): Promise<{ proof: TimelineSourceProof; operations: MaintenanceOperation[] }> {
  const catalog = timelineCatalog(ctx.config, ctx.store);
  const issue = await timelineSourceIssue(ctx, proof, operations, catalog, 'before');
  if (issue) throw new Error(issue);
  const originalSource = proof.prepared.receipt.source;
  if (!('input' in originalSource) || originalSource.retention.mode !== 'provided')
    throw new Error('source revision lacks provided candidates');
  const admitted = new Set(
    proof.prepared.receipt.result.candidates
      .filter((item) => ['written', 'support_added', 'duplicate'].includes(item.outcome))
      .map((item) => item.candidate_id),
  );
  const originals = originalSource.retention.candidates.filter((item) => admitted.has(item.candidate_id));
  const verified = await verifyRetainTextRevision(
    proof.snapshot.text,
    ctx.models.derive,
    originals,
    replacements,
  );
  const originalResults = new Map(
    proof.prepared.receipt.result.candidates.map((item) => [item.candidate_id, item]),
  );
  const candidates = verified.candidates.map((item) => {
    const result = originalResults.get(item.candidate_id);
    // An existing duplicate may live outside the companion. Keep its admitted exact path so a
    // rephrasing cannot create a new companion item instead of strengthening that same memory.
    return result?.slug && ['support_added', 'duplicate'].includes(result.outcome)
      ? { ...item, destination: { ...item.destination!, slug: result.slug } }
      : item;
  });
  const source: RetainUpsertSource = {
    ...originalSource,
    revision: sha256(JSON.stringify([proof.progress.fingerprint, candidates])),
    retention: { ...originalSource.retention, candidates },
  };
  const result = await prepareTimelineRetention(
    ctx,
    source,
    candidates,
    proof.destination,
    proof.snapshot.text,
  );
  const prepared = result.prepared;
  const successful = result.result.candidates.filter((item) =>
    ['written', 'support_added', 'duplicate'].includes(item.outcome),
  );
  if (!prepared?.stages.length || successful.length !== candidates.length)
    throw new Error('revised source retention did not admit the complete selected batch');
  if (
    successful.some((item) => {
      const original = originalResults.get(item.candidate_id);
      return (
        original &&
        ['support_added', 'duplicate'].includes(original.outcome) &&
        original.memory_id !== item.memory_id
      );
    })
  )
    throw new Error('source revision changed an existing canonical identity');
  const revisedOperations: MaintenanceOperation[] = prepared.stages.map((stage) =>
    stage.before === null
      ? { type: 'create', relPath: stage.relPath, after: stage.after, afterHash: sha256(stage.after) }
      : {
          type: 'replace',
          relPath: stage.relPath,
          before: stage.before,
          after: stage.after,
          beforeHash: sha256(stage.before),
          afterHash: sha256(stage.after),
        },
  );
  if (
    revisedOperations.length !== operations.length ||
    revisedOperations.some(
      (op) =>
        !operations.some(
          (old) =>
            op.type === old.type &&
            op.relPath === old.relPath &&
            (op.type === 'create' ||
              (op.type === 'replace' && old.type === 'replace' && op.before === old.before)),
        ),
    )
  )
    throw new Error('source revision changed the sealed path set or before-states');
  prepared.receipt.result.model_usage = {
    extraction: proof.prepared.receipt.result.model_usage?.extraction ?? null,
    repair: correctionReceipt,
    verification: verified.verification,
    placement: prepared.receipt.result.model_usage?.placement ?? [],
  };
  const revisedProof: TimelineSourceProof = {
    ...proof,
    prepared: {
      receipt: prepared.receipt,
      stages: prepared.stages.map((stage) => ({
        slug: stage.slug,
        relPath: stage.relPath,
        beforeHash: stage.before === null ? null : sha256(stage.before),
        afterHash: sha256(stage.after),
      })),
    },
    progress: {
      ...proof.progress,
      revisionHold: undefined,
      memories: {
        ...proof.progress.memories,
        ...Object.fromEntries(successful.map((item) => [item.candidate_id, item.memory_id!])),
      },
    },
  };
  if (
    revisedOperations.some((op) => 'after' in op && Buffer.byteLength(op.after) > ctx.config.maxPageBytes) ||
    JSON.stringify({
      proof: { boundaries: '', catalog, sources: [], scans: [], actions: [], retention: revisedProof },
      operations: revisedOperations,
    }).length > SEALED_SOURCE_LIMIT
  )
    throw new Error('source revision exceeds bounded sealed retention');
  // Detect evidence/policy drift across verification and receipt preparation too.
  const revisedIssue = await timelineSourceIssue(
    ctx,
    revisedProof,
    revisedOperations,
    timelineCatalog(ctx.config, ctx.store),
    'before',
  );
  if (revisedIssue) throw new Error(revisedIssue);
  return { proof: revisedProof, operations: revisedOperations };
}
