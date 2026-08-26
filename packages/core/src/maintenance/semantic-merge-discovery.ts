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
  classifierCalls: number;
  cacheHits: number;
}

interface PreparedPage {
  source: SemanticMergeDiscoveryPage;
  modelPage: SemanticMergePage;
  embeddingText: string;
}

interface ScoredPair {
  left: PreparedPage;
  right: PreparedPage;
  score: number;
}

interface CachedVerdict {
  outcome: 'same_subject' | 'keep_separate';
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
  const empty = (): SemanticMergeDiscoveryResult => ({
    pairs: [],
    degraded: [],
    warnings: [],
    classifierCalls: 0,
    cacheHits: 0,
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
    prepared.push({
      source,
      embeddingText,
      modelPage: { slug: source.slug, title: source.title, content: body },
    });
  }
  const warnings = [
    ...(oversize > 0
      ? [
          `semantic merge discovery skipped ${oversize} page(s) outside the ${SEMANTIC_MERGE_MAX_PAGE_CHARS}-character complete-page limit`,
        ]
      : []),
    ...(unreadable > 0 ? [`semantic merge discovery could not read ${unreadable} eligible page(s)`] : []),
  ];
  if (prepared.length < 2) return { ...empty(), warnings };

  const vectors: Float32Array[] = [];
  const batchSize = Math.max(1, ctx.config.models.embedding.batch ?? 32);
  for (let offset = 0; offset < prepared.length; offset += batchSize) {
    const batch = prepared.slice(offset, offset + batchSize);
    const embedded = await ctx.models.embedding.embed(batch.map((entry) => entry.embeddingText));
    if (!embedded.ok || !embedded.value) {
      return {
        ...empty(),
        warnings,
        degraded: [
          {
            reason: ctx.models.embedding.degradedReason(embedded),
            failure: embedded.reason ?? 'request_failed',
          },
        ],
      };
    }
    vectors.push(...embedded.value);
  }

  const scored: ScoredPair[] = [];
  for (let leftIndex = 0; leftIndex < prepared.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < prepared.length; rightIndex++) {
      const left = prepared[leftIndex]!;
      const right = prepared[rightIndex]!;
      if (path.posix.dirname(left.source.slug) !== path.posix.dirname(right.source.slug)) continue;
      if (options.excludedPairKeys.has(semanticMergePairKey(left.source.id, right.source.id))) continue;
      const score = cosine(vectors[leftIndex]!, vectors[rightIndex]!);
      if (Number.isFinite(score) && score >= SEMANTIC_MERGE_PREFILTER_THRESHOLD) {
        scored.push({ left, right, score });
      }
    }
  }
  scored.sort(
    (left, right) =>
      right.score - left.score ||
      semanticMergePairKey(left.left.source.id, left.right.source.id).localeCompare(
        semanticMergePairKey(right.left.source.id, right.right.source.id),
      ),
  );

  const embeddingEndpoint = ctx.models.embedding.endpointFingerprint!;
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
  const pairs: SemanticMergeQualifiedPair[] = [];
  const degraded: SemanticMergeDiscoveryDegradation[] = [];
  let classifierCalls = 0;
  let cacheHits = 0;
  for (const pair of scored.slice(0, options.candidateLimit)) {
    const ordered = [pair.left.source, pair.right.source].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const fingerprint = verdictFingerprint(ordered[0]!, ordered[1]!, embeddingEndpoint, classifierEndpoint);
    const cached = readCached.get(fingerprint) as CachedVerdict | undefined;
    let outcome = cached?.outcome ?? null;
    let decisionSource: SemanticMergeQualifiedPair['decisionSource'] = 'cache';
    if (outcome) {
      cacheHits++;
    } else {
      decisionSource = 'model';
      classifierCalls++;
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
      writeCached?.run(
        fingerprint,
        ordered[0]!.id,
        ordered[1]!.id,
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
    const [canonical, duplicate] = [pair.left.source, pair.right.source].sort(
      (left, right) => right.bytes - left.bytes || left.slug.localeCompare(right.slug),
    );
    pairs.push({ canonical: canonical!, duplicate: duplicate!, score: pair.score, decisionSource });
  }
  return { pairs, degraded, warnings, classifierCalls, cacheHits };
}

export function semanticMergePairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join('|');
}

function verdictFingerprint(
  left: SemanticMergeDiscoveryPage,
  right: SemanticMergeDiscoveryPage,
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
        { id: left.id, bodyHash: left.bodyHash },
        { id: right.id, bodyHash: right.bodyHash },
      ],
    }),
  );
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
