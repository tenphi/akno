import fsp from 'node:fs/promises';
import path from 'node:path';
import type { DegradedReason } from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { parsePage } from '../kb/page.ts';
import type { ModelFailure } from '../models/client.ts';
import { sha256 } from '../store/ids.ts';
import {
  judgeSemanticMergeCandidate,
  SEMANTIC_MERGE_MAX_PAGE_CHARS,
  SEMANTIC_MERGE_EMBEDDING_VERSION,
  SEMANTIC_MERGE_PREFILTER_THRESHOLD,
  SEMANTIC_MERGE_PROMPT_VERSION,
  SEMANTIC_MERGE_SIGNATURE_VERSION,
  type SemanticMergePage,
} from './merge-classifier.ts';

export interface SemanticMergeDiscoveryPage {
  id: string;
  slug: string;
  relPath: string;
  title: string;
  bodyHash: string;
  bytes: number;
}

interface SemanticMergeQualifiedPair {
  canonical: SemanticMergeDiscoveryPage;
  duplicate: SemanticMergeDiscoveryPage;
  score: number;
  decisionSource: 'cache' | 'model';
}

export interface SemanticMergeDiscoveryDegradation {
  reason: DegradedReason;
  failure: ModelFailure | null;
}

export interface SemanticMergeDiscoveryResult {
  pairs: SemanticMergeQualifiedPair[];
  degraded: SemanticMergeDiscoveryDegradation[];
  warnings: string[];
  metrics: SemanticMergeDiscoveryMetrics;
}

/** Aggregate only: safe for durable receipts and support output. */
export interface SemanticMergeDiscoveryMetrics {
  pagesConsidered: number;
  pagesPrepared: number;
  pagesSkipped: number;
  embeddingCacheHits: number;
  embeddingInputs: number;
  embeddingCalls: number;
  pairsCompared: number;
  prefilteredPairs: number;
  classifierCandidates: number;
  classifierCacheHits: number;
  classifierCalls: number;
  qualifiedPairs: number;
}

interface PreparedPage {
  source: SemanticMergeDiscoveryPage;
  modelPage: SemanticMergePage;
  embeddingText: string;
  embeddingFingerprint: string;
  semanticInputHash: string;
}

interface ScoredPair {
  left: PreparedPage;
  right: PreparedPage;
  score: number;
}

interface CachedVerdict {
  outcome: 'same_subject' | 'keep_separate';
}

interface CachedEmbedding {
  dimensions: number;
  embedding: Buffer;
}

/**
 * Similarity creates a bounded queue; only the strict classifier can emit a candidate. Exact
 * content/model/prompt fingerprints cache both outcomes without retaining text or rationale.
 */
export async function discoverSemanticMergeCandidates(
  ctx: AknoContext,
  sources: SemanticMergeDiscoveryPage[],
  options: { excludedPairKeys: ReadonlySet<string>; candidateLimit: number },
): Promise<SemanticMergeDiscoveryResult> {
  const metrics = emptySemanticMergeDiscoveryMetrics(sources.length);
  const empty = (): SemanticMergeDiscoveryResult => ({
    pairs: [],
    degraded: [],
    warnings: [],
    metrics,
  });
  if (sources.length < 2 || options.candidateLimit <= 0) return empty();
  if (!ctx.models.embedding.available) {
    return {
      ...empty(),
      degraded: [{ reason: 'no_embedding_model', failure: 'unavailable' }],
    };
  }
  if (!ctx.models.derive.available) {
    return {
      ...empty(),
      degraded: [{ reason: 'no_derive_model', failure: 'unavailable' }],
    };
  }

  const embeddingEndpoint = ctx.models.embedding.endpointFingerprint!;
  const prepared: PreparedPage[] = [];
  let oversize = 0;
  let unreadable = 0;
  for (const source of sources) {
    if (source.bytes > SEMANTIC_MERGE_MAX_PAGE_CHARS * 4) {
      oversize++;
      continue;
    }
    const content = await fsp
      .readFile(path.join(ctx.config.aknoPath, source.relPath), 'utf8')
      .catch(() => null);
    if (content === null) {
      unreadable++;
      continue;
    }
    const parsed = parsePage(source.relPath, content);
    const body = parsed.body.trim();
    if (body.length === 0 || body.length > SEMANTIC_MERGE_MAX_PAGE_CHARS) {
      oversize++;
      continue;
    }
    const embeddingText = /^#\s+/m.test(body) ? body : `# ${source.title}\n\n${body}`;
    const modelPage = { slug: source.slug, title: source.title, content: body };
    const sourceHash = sha256(embeddingText);
    prepared.push({
      source,
      embeddingText,
      embeddingFingerprint: embeddingFingerprint(source.id, sourceHash, embeddingEndpoint),
      semanticInputHash: sha256(JSON.stringify(modelPage)),
      modelPage,
    });
  }
  metrics.pagesPrepared = prepared.length;
  metrics.pagesSkipped = oversize + unreadable;
  const warnings = [
    ...(oversize > 0
      ? [
          `semantic merge discovery skipped ${oversize} page(s) outside the ${SEMANTIC_MERGE_MAX_PAGE_CHARS}-character complete-page limit`,
        ]
      : []),
    ...(unreadable > 0 ? [`semantic merge discovery could not read ${unreadable} eligible page(s)`] : []),
  ];
  if (prepared.length < 2) return { ...empty(), warnings };

  const vectors = new Array<Float32Array>(prepared.length);
  const missingIndexes: number[] = [];
  const readEmbedding = ctx.store.db.prepare(
    'SELECT dimensions, embedding FROM semantic_merge_embeddings WHERE fingerprint = ?',
  );
  const expectedDimensions = ctx.config.models.embedding.dimensions ?? ctx.store.vectors.dimensions;
  for (const [index, entry] of prepared.entries()) {
    const cached = readEmbedding.get(entry.embeddingFingerprint) as CachedEmbedding | undefined;
    const vector = cached ? decodeEmbedding(cached, expectedDimensions) : null;
    if (vector) {
      vectors[index] = vector;
      metrics.embeddingCacheHits++;
    } else {
      missingIndexes.push(index);
    }
  }

  metrics.embeddingInputs = missingIndexes.length;
  const batchSize = Math.max(1, ctx.config.models.embedding.batch ?? 32);
  const writeEmbedding = ctx.store.readOnly
    ? null
    : ctx.store.db.prepare(
        `INSERT OR REPLACE INTO semantic_merge_embeddings(
           fingerprint, page_id, source_hash, embedding_endpoint, signature_version,
           dimensions, embedding, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
  const deleteStaleEmbedding = ctx.store.readOnly
    ? null
    : ctx.store.db.prepare('DELETE FROM semantic_merge_embeddings WHERE page_id = ? AND fingerprint != ?');
  for (let offset = 0; offset < missingIndexes.length; offset += batchSize) {
    const batchIndexes = missingIndexes.slice(offset, offset + batchSize);
    const batch = batchIndexes.map((index) => prepared[index]!);
    metrics.embeddingCalls++;
    const embedded = await ctx.models.embedding.embed(batch.map((entry) => entry.embeddingText));
    if (!embedded.ok || !embedded.value) {
      return {
        pairs: [],
        warnings,
        metrics,
        degraded: [
          {
            reason: ctx.models.embedding.degradedReason(embedded),
            failure: embedded.reason ?? 'request_failed',
          },
        ],
      };
    }
    const returnedVectors = Array.from({ length: batch.length }, (_, index) => embedded.value![index]);
    if (
      embedded.value.length !== batch.length ||
      returnedVectors.some((vector) => !vector || vector.length !== expectedDimensions)
    ) {
      ctx.models.embedding.reportInvalidResponse();
      return {
        pairs: [],
        warnings,
        metrics,
        degraded: [{ reason: 'embedding_failed', failure: 'bad_response' }],
      };
    }
    const createdAt = new Date().toISOString();
    const retainBatch = (): void => {
      for (const [batchIndex, returnedVector] of returnedVectors.entries()) {
        const vector = returnedVector!;
        const preparedIndex = batchIndexes[batchIndex]!;
        const entry = prepared[preparedIndex]!;
        vectors[preparedIndex] = vector;
        deleteStaleEmbedding?.run(entry.source.id, entry.embeddingFingerprint);
        writeEmbedding?.run(
          entry.embeddingFingerprint,
          entry.source.id,
          sha256(entry.embeddingText),
          embeddingEndpoint,
          SEMANTIC_MERGE_EMBEDDING_VERSION,
          vector.length,
          encodeEmbedding(vector),
          createdAt,
        );
      }
    };
    if (writeEmbedding) ctx.store.transaction(retainBatch);
    else retainBatch();
  }

  const scored: ScoredPair[] = [];
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex++) {
      const left = prepared[leftIndex]!;
      const right = prepared[rightIndex]!;
      if (path.posix.dirname(left.source.slug) !== path.posix.dirname(right.source.slug)) continue;
      if (options.excludedPairKeys.has(semanticMergePairKey(left.source.id, right.source.id))) continue;
      metrics.pairsCompared++;
      const score = cosine(vectors[leftIndex]!, vectors[rightIndex]!);
      if (Number.isFinite(score) && score >= SEMANTIC_MERGE_PREFILTER_THRESHOLD) {
        scored.push({ left, right, score });
      }
    }
  }
  metrics.prefilteredPairs = scored.length;
  scored.sort(
    (left, right) =>
      right.score - left.score ||
      semanticMergePairKey(left.left.source.id, left.right.source.id).localeCompare(
        semanticMergePairKey(right.left.source.id, right.right.source.id),
      ),
  );

  const classifierEndpoint = ctx.models.derive.endpointFingerprint!;
  const readCached = ctx.store.db.prepare(
    'SELECT outcome FROM semantic_merge_verdicts WHERE fingerprint = ?',
  );
  const writeCached = ctx.store.readOnly
    ? null
    : ctx.store.db.prepare(
        `INSERT OR REPLACE INTO semantic_merge_verdicts(
           fingerprint, left_page, right_page, score, outcome, embedding_endpoint,
           classifier_endpoint, prompt_version, signature_version, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
  const deleteStaleVerdict = ctx.store.readOnly
    ? null
    : ctx.store.db.prepare(
        `DELETE FROM semantic_merge_verdicts
          WHERE left_page = ? AND right_page = ? AND fingerprint != ?`,
      );
  const pairs: SemanticMergeQualifiedPair[] = [];
  const degraded: SemanticMergeDiscoveryDegradation[] = [];
  const classifierCandidates = scored.slice(0, options.candidateLimit);
  metrics.classifierCandidates = classifierCandidates.length;
  for (const pair of classifierCandidates) {
    const ordered = [pair.left, pair.right].sort((left, right) =>
      left.source.id.localeCompare(right.source.id),
    );
    const fingerprint = verdictFingerprint(ordered[0]!, ordered[1]!, embeddingEndpoint, classifierEndpoint);
    const cached = readCached.get(fingerprint) as CachedVerdict | undefined;
    let outcome = cached?.outcome ?? null;
    let decisionSource: SemanticMergeQualifiedPair['decisionSource'] = 'cache';
    if (outcome) {
      metrics.classifierCacheHits++;
    } else {
      decisionSource = 'model';
      metrics.classifierCalls++;
      const judged = await judgeSemanticMergeCandidate(
        ctx.models.derive,
        pair.left.modelPage,
        pair.right.modelPage,
      );
      if (!judged.ok || !judged.value) {
        degraded.push({
          reason: ctx.models.derive.degradedReason(judged),
          failure: judged.reason ?? 'bad_response',
        });
        continue;
      }
      outcome = judged.value.outcome;
      deleteStaleVerdict?.run(ordered[0]!.source.id, ordered[1]!.source.id, fingerprint);
      writeCached?.run(
        fingerprint,
        ordered[0]!.source.id,
        ordered[1]!.source.id,
        pair.score,
        outcome,
        embeddingEndpoint,
        classifierEndpoint,
        SEMANTIC_MERGE_PROMPT_VERSION,
        SEMANTIC_MERGE_SIGNATURE_VERSION,
        new Date().toISOString(),
      );
    }
    if (outcome !== 'same_subject') continue;
    metrics.qualifiedPairs++;
    const [canonical, duplicate] = [pair.left.source, pair.right.source].sort(
      (left, right) => right.bytes - left.bytes || left.slug.localeCompare(right.slug),
    );
    pairs.push({ canonical: canonical!, duplicate: duplicate!, score: pair.score, decisionSource });
  }
  return { pairs, degraded, warnings, metrics };
}

function emptySemanticMergeDiscoveryMetrics(pagesConsidered = 0): SemanticMergeDiscoveryMetrics {
  return {
    pagesConsidered,
    pagesPrepared: 0,
    pagesSkipped: 0,
    embeddingCacheHits: 0,
    embeddingInputs: 0,
    embeddingCalls: 0,
    pairsCompared: 0,
    prefilteredPairs: 0,
    classifierCandidates: 0,
    classifierCacheHits: 0,
    classifierCalls: 0,
    qualifiedPairs: 0,
  };
}

export function addSemanticMergeDiscoveryMetrics(
  current: SemanticMergeDiscoveryMetrics | null,
  next: SemanticMergeDiscoveryMetrics | null,
): SemanticMergeDiscoveryMetrics | null {
  if (!current) return next ? { ...next } : null;
  if (!next) return { ...current };
  return {
    pagesConsidered: current.pagesConsidered + next.pagesConsidered,
    pagesPrepared: current.pagesPrepared + next.pagesPrepared,
    pagesSkipped: current.pagesSkipped + next.pagesSkipped,
    embeddingCacheHits: current.embeddingCacheHits + next.embeddingCacheHits,
    embeddingInputs: current.embeddingInputs + next.embeddingInputs,
    embeddingCalls: current.embeddingCalls + next.embeddingCalls,
    pairsCompared: current.pairsCompared + next.pairsCompared,
    prefilteredPairs: current.prefilteredPairs + next.prefilteredPairs,
    classifierCandidates: current.classifierCandidates + next.classifierCandidates,
    classifierCacheHits: current.classifierCacheHits + next.classifierCacheHits,
    classifierCalls: current.classifierCalls + next.classifierCalls,
    qualifiedPairs: current.qualifiedPairs + next.qualifiedPairs,
  };
}

export function semanticMergePairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join('|');
}

function verdictFingerprint(
  left: PreparedPage,
  right: PreparedPage,
  embeddingEndpoint: string,
  classifierEndpoint: string,
): string {
  return sha256(
    JSON.stringify({
      signatureVersion: SEMANTIC_MERGE_SIGNATURE_VERSION,
      promptVersion: SEMANTIC_MERGE_PROMPT_VERSION,
      threshold: SEMANTIC_MERGE_PREFILTER_THRESHOLD,
      embeddingEndpoint,
      classifierEndpoint,
      pages: [
        { id: left.source.id, semanticInputHash: left.semanticInputHash },
        { id: right.source.id, semanticInputHash: right.semanticInputHash },
      ],
    }),
  );
}

function embeddingFingerprint(pageId: string, sourceHash: string, embeddingEndpoint: string): string {
  return sha256(
    JSON.stringify({
      signatureVersion: SEMANTIC_MERGE_EMBEDDING_VERSION,
      embeddingEndpoint,
      pageId,
      sourceHash,
    }),
  );
}

function encodeEmbedding(vector: Float32Array): Buffer {
  const buffer = Buffer.allocUnsafe(vector.length * 4);
  for (let index = 0; index < vector.length; index++) buffer.writeFloatLE(vector[index]!, index * 4);
  return buffer;
}

function decodeEmbedding(row: CachedEmbedding, expectedDimensions: number): Float32Array | null {
  if (
    row.dimensions !== expectedDimensions ||
    !Buffer.isBuffer(row.embedding) ||
    row.embedding.byteLength !== expectedDimensions * 4
  ) {
    return null;
  }
  const vector = new Float32Array(expectedDimensions);
  for (let index = 0; index < expectedDimensions; index++) {
    const value = row.embedding.readFloatLE(index * 4);
    if (!Number.isFinite(value)) return null;
    vector[index] = value;
  }
  return vector;
}

function cosine(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! * left[index]!;
    rightNorm += right[index]! * right[index]!;
  }
  return leftNorm === 0 || rightNorm === 0 ? 0 : dot / Math.sqrt(leftNorm * rightNorm);
}
