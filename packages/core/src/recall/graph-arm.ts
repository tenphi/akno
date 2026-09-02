import type {
  DegradedReason,
  GraphEvidenceLocator,
  GraphNodeRef,
  GraphOutput,
  RecallGraphPath,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { graph } from '../ops/graph.ts';
import type { ChunkHit } from './search.ts';

const MAX_PAGE_SEEDS = 3;
// Explore beyond the smaller final candidate window so a moderately connected seed does not report
// truncation merely because recall still returns only the strongest thirty graph candidates.
const MAX_GRAPH_PATHS_PER_SEED = 100;
const MAX_GRAPH_CANDIDATES = 30;
const MAX_PATHS_PER_CANDIDATE = 3;

export interface GraphRecallResult {
  hits: ChunkHit[];
  degraded: DegradedReason[];
  notes: string[];
}

interface CandidateRow {
  chunkId: number;
  pageId: string | null;
  documentId: string | null;
}

/**
 * Produce a third retrieval arm from bounded graph paths.
 *
 * Query names are exact graph seeds. A few strong lexical page hits may also seed traversal, which is what
 * lets a descriptive query reach a related page whose own words never overlap the query. Graph confidence
 * orders this arm only; recall later combines it with lexical and vector results by reciprocal rank.
 */
export async function graphRecallCandidates(
  ctx: AknoContext,
  query: string,
  firstStageHits: ChunkHit[],
  chunkIds?: Set<number>,
): Promise<GraphRecallResult> {
  const degraded = new Set<DegradedReason>();
  const notes: string[] = [];
  const outputs: GraphOutput[] = [];

  const queryOutput = await graph(ctx, {
    query,
    max_hops: 2,
    limit: MAX_GRAPH_PATHS_PER_SEED,
  });
  if (queryOutput.status === 'unavailable') {
    return {
      hits: [],
      degraded: ['no_graph_index'],
      notes: ['the structural graph candidate arm was unavailable'],
    };
  }
  outputs.push(queryOutput);
  addDegradation(degraded, queryOutput);

  const pageSeeds = queryOutput.degraded?.includes('entity_resolution_failed')
    ? []
    : qualifiedPageSeeds(ctx, query, firstStageHits);
  for (const slug of pageSeeds) {
    const output = await graph(ctx, {
      slug,
      max_hops: 2,
      limit: MAX_GRAPH_PATHS_PER_SEED,
    });
    if (output.status === 'unavailable') {
      degraded.add('no_graph_index');
      break;
    }
    outputs.push(output);
    addDegradation(degraded, output);
  }

  if (degraded.size > 0) notes.push('the structural graph candidate arm was incomplete');
  return {
    hits: candidatesFromOutputs(ctx, outputs, chunkIds),
    degraded: [...degraded],
    notes,
  };
}

function addDegradation(degraded: Set<DegradedReason>, output: GraphOutput): void {
  for (const reason of output.degraded ?? []) degraded.add(reason);
}

/** Page-hit seeds are deliberately conservative: lexical evidence plus two meaningful query terms. */
function qualifiedPageSeeds(ctx: AknoContext, query: string, hits: ChunkHit[]): string[] {
  const terms = contentTerms(query);
  if (terms.length === 0) return [];
  const wantedMatches = Math.min(2, terms.length);
  const page = ctx.store.db.prepare('SELECT slug, title FROM pages WHERE id = ?');
  const chunk = ctx.store.db.prepare('SELECT text, heading_path FROM chunks WHERE id = ?');
  const seen = new Set<string>();
  const seeds: string[] = [];

  for (const hit of hits) {
    if (seeds.length >= MAX_PAGE_SEEDS) break;
    if (
      !hit.pageId ||
      !hit.from.includes('lexical') ||
      (hit.relevance !== undefined && hit.relevance < 0.5)
    ) {
      continue;
    }
    const pageRow = page.get(hit.pageId) as { slug: string; title: string } | undefined;
    const chunkRow = chunk.get(hit.chunkId) as { text: string; heading_path: string } | undefined;
    if (!pageRow || !chunkRow || seen.has(pageRow.slug)) continue;
    const haystack = new Set(
      normalize(`${pageRow.title} ${chunkRow.heading_path} ${chunkRow.text}`).split(' '),
    );
    if (terms.filter((term) => haystack.has(term)).length < wantedMatches) continue;
    seen.add(pageRow.slug);
    seeds.push(pageRow.slug);
  }
  return seeds;
}

function contentTerms(query: string): string[] {
  const stop = new Set([
    'about',
    'after',
    'before',
    'does',
    'eventually',
    'from',
    'have',
    'into',
    'lead',
    'related',
    'that',
    'their',
    'there',
    'these',
    'this',
    'through',
    'what',
    'when',
    'where',
    'which',
    'with',
  ]);
  return [
    ...new Set(
      normalize(query)
        .split(' ')
        .filter((term) => term.length > 2 && !stop.has(term)),
    ),
  ];
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function candidatesFromOutputs(ctx: AknoContext, outputs: GraphOutput[], chunkIds?: Set<number>): ChunkHit[] {
  const candidates = new Map<string, ChunkHit>();

  for (const output of outputs) {
    const nodes = new Map(output.nodes.map((node) => [node.id, node]));
    const edges = new Map(output.edges.map((edge) => [edge.id, edge]));
    for (const path of output.paths) {
      const seed = nodes.get(path.nodes[0]!);
      const target = nodes.get(path.nodes.at(-1)!);
      if (!seed || !target) continue;
      const pathNodes = path.nodes.flatMap((nodeId) => {
        const node = nodes.get(nodeId);
        return node ? [node] : [];
      });
      if (pathNodes.length !== path.nodes.length) continue;
      const relations = path.edges.flatMap((edgeId) => {
        const edge = edges.get(edgeId);
        return edge ? [edge.relation] : [];
      });
      if (relations.length !== path.hops) continue;

      const explanation: RecallGraphPath = {
        seed,
        target,
        nodes: pathNodes,
        relations,
        hops: path.hops,
        confidence: path.confidence,
        evidence: path.evidence,
      };
      const row = candidateForTarget(ctx, target, path.evidence, chunkIds);
      if (!row) continue;
      const identity = row.pageId ? `page:${row.pageId}` : `document:${row.documentId}`;
      const existing = candidates.get(identity);
      if (existing) {
        existing.score = Math.max(existing.score, path.confidence);
        existing.graphPaths = mergePaths(existing.graphPaths ?? [], explanation);
      } else {
        candidates.set(identity, {
          chunkId: row.chunkId,
          pageId: row.pageId,
          documentId: row.documentId,
          score: path.confidence,
          from: ['graph'],
          graphPaths: [explanation],
        });
      }
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_GRAPH_CANDIDATES);
}

function candidateForTarget(
  ctx: AknoContext,
  target: GraphNodeRef,
  evidence: GraphEvidenceLocator[],
  chunkIds?: Set<number>,
): CandidateRow | null {
  if (target.kind === 'document' && target.document) {
    return documentChunk(ctx, target.document, chunkIds);
  }

  const slug = target.slug;
  if (!slug) return null;
  const line =
    target.line_start ?? evidence.find((locator) => locator.slug === slug && locator.line_start)?.line_start;
  return pageChunk(ctx, slug, line, chunkIds);
}

function pageChunk(
  ctx: AknoContext,
  slug: string,
  line: number | undefined,
  allowed?: Set<number>,
): CandidateRow | null {
  const rows = ctx.store.db
    .prepare(
      `SELECT c.id AS chunk_id, c.page_id, c.document_id
         FROM chunks c
         JOIN pages p ON p.id = c.page_id
        WHERE p.slug = ? AND c.document_id IS NULL
        ORDER BY CASE WHEN ? BETWEEN c.line_start AND c.line_end THEN 0 ELSE 1 END, c.ord`,
    )
    .all(slug, line ?? -1) as { chunk_id: number; page_id: string | null; document_id: string | null }[];
  const row = rows.find((candidate) => !allowed || allowed.has(candidate.chunk_id));
  return row ? { chunkId: row.chunk_id, pageId: row.page_id, documentId: row.document_id } : null;
}

function documentChunk(ctx: AknoContext, documentId: string, allowed?: Set<number>): CandidateRow | null {
  const rows = ctx.store.db
    .prepare(
      `SELECT id AS chunk_id, page_id, document_id
         FROM chunks
        WHERE document_id = ?
        ORDER BY ord`,
    )
    .all(documentId) as { chunk_id: number; page_id: string | null; document_id: string | null }[];
  const row = rows.find((candidate) => !allowed || allowed.has(candidate.chunk_id));
  return row ? { chunkId: row.chunk_id, pageId: row.page_id, documentId: row.document_id } : null;
}

function mergePaths(paths: RecallGraphPath[], addition: RecallGraphPath): RecallGraphPath[] {
  const key = graphPathKey(addition);
  if (paths.some((path) => graphPathKey(path) === key)) return paths;
  return [...paths, addition].slice(0, MAX_PATHS_PER_CANDIDATE);
}

function graphPathKey(path: RecallGraphPath): string {
  return `${path.seed.id}\0${path.target.id}\0${path.relations.join('\0')}\0${path.evidence
    .map((locator) =>
      [
        locator.kind,
        locator.slug,
        locator.document,
        locator.event,
        locator.fact,
        locator.memory,
        locator.line_start,
      ].join('\0'),
    )
    .join('\0')}`;
}
