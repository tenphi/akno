import {
  GraphInput,
  type DegradedReason,
  type GraphAmbiguity,
  type GraphEdgeRef,
  type GraphEvidenceLocator,
  type GraphNodeRef,
  type GraphOutput,
  type GraphPath,
  type GraphRelation,
  type GraphSeed,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { normalizeEntityName, resolveExactEntity } from '../index/graph.ts';
import { documentAvailability, type AvailabilityPart } from '../ingest/availability.ts';

const DEFAULT_HOPS = 2;
const DEFAULT_PATH_LIMIT = 30;
const FAN_OUT_LIMIT = 50;
const QUERY_SEED_LIMIT = 8;

interface EdgeRow {
  id: string;
  from_node: string;
  to_node: string;
  relation: GraphRelation;
  predicate: string | null;
  source_kind: GraphEvidenceLocator['kind'];
  source_document: string | null;
  source_event: string | null;
  source_fact: string | null;
  source_slug: string | null;
  line_start: number | null;
  line_end: number | null;
  source_field: string | null;
  derivation: 'structural' | 'fact';
  resolution: 'exact' | 'contextual';
  confidence: number;
  valid_from: string | null;
  valid_to: string | null;
}

interface NodeRow {
  id: string;
  kind: GraphNodeRef['kind'];
  source_id: string;
  page_slug: string | null;
  page_title: string | null;
  page_role: GraphNodeRef['role'] | null;
  entity_id: string | null;
  entity_type: GraphNodeRef['entity_type'] | null;
  entity_label: string | null;
  entity_slug: string | null;
  document_id: string | null;
  document_label: string | null;
  document_path: string | null;
  document_group: string | null;
  document_text: string | null;
  document_availability: 'available' | 'missing' | null;
  document_missing_since: string | null;
  document_owner: string | null;
  fact_id: string | null;
  fact_slug: string | null;
  fact_line_start: number | null;
  fact_line_end: number | null;
  event_id: string | null;
  event_date: string | null;
  event_source: string | null;
  event_line: number | null;
  observation_id: string | null;
  observation_slug: string | null;
  observation_line: number | null;
}

interface RawAmbiguity {
  mention: string;
  normalized: string;
  entityIds: string[];
}

/**
 * Inspect graph structure without returning the evidence text itself.
 *
 * Exact seeding and bounded traversal are intentional correctness boundaries: this operation explains
 * relationships already indexed from evidence, but does not invent a relationship from lexical similarity.
 */
export async function graph(ctx: AknoContext, rawInput: unknown): Promise<GraphOutput> {
  const input = GraphInput.parse(rawInput);

  try {
    if (!tableExists(ctx, 'graph_nodes') || !tableExists(ctx, 'graph_edges')) {
      return unavailable();
    }

    const entityIndexAvailable = tableExists(ctx, 'graph_entities') && tableExists(ctx, 'graph_entity_names');
    if (!entityIndexAvailable) {
      return {
        status: 'degraded',
        degraded: ['no_entity_index'],
        note: 'the structural graph exists, but exact entity seeds cannot be resolved; absence is inconclusive',
        seeds: [],
        nodes: [],
        edges: [],
        paths: [],
        ambiguities: [],
        total: 0,
        truncated: false,
        reason: 'seed_not_found',
      };
    }

    const degraded = new Set<DegradedReason>();
    const factStatusAvailable = tableExists(ctx, 'graph_fact_status');
    if (!factStatusAvailable || graphIsPartial(ctx)) degraded.add('partial_graph_index');

    const resolved = resolveSeeds(ctx, input);
    for (const reason of resolved.degraded) degraded.add(reason);

    const pathLimit = input.limit ?? DEFAULT_PATH_LIMIT;
    const maxHops = input.max_hops ?? DEFAULT_HOPS;
    const traversed = traverse(ctx, resolved.seeds, {
      direction: input.direction ?? 'both',
      relations: input.relations,
      maxHops,
      pathLimit,
      includeHistory: input.include_history ?? false,
      factStatusAvailable,
    });
    if (traversed.truncated) degraded.add('graph_traversal_limited');

    const ambiguityNodeIds = resolved.ambiguities.flatMap((ambiguity) =>
      ambiguity.entityIds.flatMap((entityId) => {
        const node = entityNode(ctx, entityId);
        return node ? [node] : [];
      }),
    );
    const allNodeIds = new Set([
      ...resolved.seeds.map((seed) => seed.node),
      ...traversed.nodeIds,
      ...ambiguityNodeIds,
    ]);
    const nodes = loadNodes(ctx, [...allNodeIds]);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    if (nodes.length !== allNodeIds.size) degraded.add('partial_graph_index');
    if (nodes.some((node) => node.availability && node.availability !== 'available')) {
      degraded.add('document_source_missing');
    }

    const ambiguities: GraphAmbiguity[] = resolved.ambiguities.map((ambiguity) => ({
      mention: ambiguity.mention,
      normalized: ambiguity.normalized,
      candidates: ambiguity.entityIds.flatMap((entityId) => {
        const nodeId = entityNode(ctx, entityId);
        const node = nodeId ? nodeById.get(nodeId) : undefined;
        return node ? [node] : [];
      }),
    }));

    const truncated = traversed.truncated || resolved.degraded.includes('graph_traversal_limited');
    const status =
      degraded.size > 0
        ? 'degraded'
        : resolved.seeds.length === 0 || traversed.paths.length === 0
          ? 'empty'
          : 'ok';
    const reason =
      resolved.seeds.length === 0 ? 'seed_not_found' : traversed.paths.length === 0 ? 'no_paths' : undefined;

    return {
      status,
      ...(degraded.size > 0 ? { degraded: [...degraded] } : {}),
      ...(reason === 'seed_not_found'
        ? {
            note:
              ambiguities.length > 0
                ? 'one or more exact names are ambiguous; choose an entity id instead of treating this as absence'
                : 'the graph was available, but no exact seed matched',
          }
        : reason === 'no_paths'
          ? { note: 'the seed exists, but no eligible path matched these bounds and filters' }
          : truncated
            ? { note: 'the result hit a traversal safety cap; it is not proof that no other path exists' }
            : {}),
      seeds: resolved.seeds,
      nodes,
      edges: traversed.edges,
      paths: traversed.paths,
      ambiguities,
      total: traversed.paths.length,
      truncated,
      ...(reason ? { reason } : {}),
    };
  } catch {
    // A database error must not collapse into an empty result: an agent is allowed to say "not recorded"
    // only after a complete read, and this operation could not complete one.
    return unavailable();
  }
}

function unavailable(): GraphOutput {
  return {
    status: 'unavailable',
    note: 'the graph index could not be read; absence is unknown',
    seeds: [],
    nodes: [],
    edges: [],
    paths: [],
    ambiguities: [],
    total: 0,
    truncated: false,
    reason: 'graph_index_unreadable',
  };
}

function tableExists(ctx: AknoContext, table: string): boolean {
  const row = ctx.store.db
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { present: number } | undefined;
  return row?.present === 1;
}

function graphIsPartial(ctx: AknoContext): boolean {
  const counts = ctx.store.db
    .prepare(
      `SELECT
         (SELECT count(*) FROM pages) AS pages,
         (SELECT count(*) FROM graph_nodes WHERE kind = 'page') AS graph_pages,
         (SELECT count(*) FROM documents WHERE renders IS NULL) AS documents,
         (SELECT count(*) FROM graph_nodes WHERE kind = 'document') AS graph_documents,
         (SELECT count(*) FROM events) AS events,
         (SELECT count(*) FROM graph_nodes WHERE kind = 'event') AS graph_events,
         (SELECT count(*) FROM facts f JOIN pages p ON p.id = f.page_id
            WHERE p.role = 'knowledge' AND p.derived_hash = p.body_hash) AS facts,
         (SELECT count(*) FROM graph_nodes WHERE kind = 'fact') AS graph_facts,
         (SELECT count(*) FROM pages WHERE role = 'knowledge') AS knowledge_pages,
         (SELECT count(*) FROM graph_entities) AS entities,
         (SELECT count(*) FROM graph_nodes WHERE kind = 'entity') AS graph_entities`,
    )
    .get() as Record<string, number>;
  return (
    counts.pages !== counts.graph_pages ||
    counts.documents !== counts.graph_documents ||
    counts.events !== counts.graph_events ||
    counts.facts !== counts.graph_facts ||
    counts.knowledge_pages !== counts.entities ||
    counts.entities !== counts.graph_entities
  );
}

function resolveSeeds(
  ctx: AknoContext,
  input: ReturnType<typeof GraphInput.parse>,
): { seeds: GraphSeed[]; ambiguities: RawAmbiguity[]; degraded: DegradedReason[] } {
  if (input.slug) return resolveSlugSeed(ctx, input.slug);
  if (input.entity) return resolveEntitySeed(ctx, input.entity);
  return resolveQuerySeeds(ctx, input.query!);
}

function resolveSlugSeed(
  ctx: AknoContext,
  slug: string,
): { seeds: GraphSeed[]; ambiguities: RawAmbiguity[]; degraded: DegradedReason[] } {
  const page = ctx.store.db.prepare('SELECT id, role FROM pages WHERE slug = ?').get(slug) as
    { id: string; role: string } | undefined;
  if (!page) return { seeds: [], ambiguities: [], degraded: [] };

  const node = graphNode(ctx, 'page', page.id);
  return {
    seeds: node ? [{ form: 'slug', value: slug, node }] : [],
    ambiguities: [],
    degraded: node ? [] : ['partial_graph_index'],
  };
}

function resolveEntitySeed(
  ctx: AknoContext,
  entityId: string,
): { seeds: GraphSeed[]; ambiguities: RawAmbiguity[]; degraded: DegradedReason[] } {
  const node = entityNode(ctx, entityId);
  return { seeds: node ? [{ form: 'entity', value: entityId, node }] : [], ambiguities: [], degraded: [] };
}

function resolveQuerySeeds(
  ctx: AknoContext,
  query: string,
): { seeds: GraphSeed[]; ambiguities: RawAmbiguity[]; degraded: DegradedReason[] } {
  const ambiguities: RawAmbiguity[] = [];
  const seedNodes: string[] = [];
  const exact = resolveExactEntity(ctx.store.db, query);

  if (exact.status === 'resolved') {
    const node = entityNode(ctx, exact.entityId);
    if (node) seedNodes.push(node);
  } else if (exact.status === 'ambiguous') {
    ambiguities.push({ mention: query, normalized: exact.normalized, entityIds: exact.candidates });
  } else {
    for (const match of queryEntityMatches(ctx, query)) {
      const resolution = resolveExactEntity(ctx.store.db, match.name);
      if (resolution.status === 'resolved') {
        const node = entityNode(ctx, resolution.entityId);
        if (node && !seedNodes.includes(node)) seedNodes.push(node);
      } else if (resolution.status === 'ambiguous') {
        ambiguities.push({
          mention: match.name,
          normalized: resolution.normalized,
          entityIds: resolution.candidates,
        });
      }
    }
  }

  // Source and inference pages do not anchor entities. An exact slug or unique exact title remains a useful
  // page seed, but only as a fallback; phrase similarity never chooses a page here.
  if (seedNodes.length === 0 && ambiguities.length === 0) {
    const normalized = normalizeEntityName(query);
    const pages = ctx.store.db.prepare("SELECT id, slug, title FROM pages WHERE role != 'ignored'").all() as {
      id: string;
      slug: string;
      title: string;
    }[];
    const matches = pages.filter(
      (page) =>
        normalizeEntityName(page.slug) === normalized || normalizeEntityName(page.title) === normalized,
    );
    if (matches.length === 1) {
      const node = graphNode(ctx, 'page', matches[0]!.id);
      if (node) seedNodes.push(node);
    } else if (matches.length > 1) {
      ambiguities.push({ mention: query, normalized, entityIds: [] });
    }
  }

  const unique = [...new Set(seedNodes)];
  const truncated = unique.length > QUERY_SEED_LIMIT;
  return {
    seeds: unique.slice(0, QUERY_SEED_LIMIT).map((node) => ({ form: 'query', value: query, node })),
    ambiguities,
    degraded: [
      ...(ambiguities.length > 0 ? (['entity_resolution_failed'] as const) : []),
      ...(truncated ? (['graph_traversal_limited'] as const) : []),
    ],
  };
}

function queryEntityMatches(ctx: AknoContext, query: string): { name: string; start: number; end: number }[] {
  const normalizedQuery = normalizeEntityName(query);
  if (!normalizedQuery) return [];
  const rows = ctx.store.db
    .prepare(
      `SELECT normalized_name, min(name) AS name
         FROM graph_entity_names
        WHERE length(normalized_name) >= 3
        GROUP BY normalized_name
        ORDER BY length(normalized_name) DESC, normalized_name`,
    )
    .all() as { normalized_name: string; name: string }[];

  const occupied: { start: number; end: number }[] = [];
  const matches: { name: string; start: number; end: number }[] = [];
  for (const row of rows) {
    let at = normalizedQuery.indexOf(row.normalized_name);
    while (at !== -1) {
      const end = at + row.normalized_name.length;
      const atBoundary =
        (at === 0 || normalizedQuery[at - 1] === ' ') &&
        (end === normalizedQuery.length || normalizedQuery[end] === ' ');
      const overlaps = occupied.some((span) => at < span.end && end > span.start);
      if (atBoundary && !overlaps) {
        occupied.push({ start: at, end });
        matches.push({ name: row.name, start: at, end });
        break;
      }
      at = normalizedQuery.indexOf(row.normalized_name, at + 1);
    }
  }
  return matches.sort((a, b) => a.start - b.start || a.end - b.end);
}

function graphNode(ctx: AknoContext, kind: GraphNodeRef['kind'], sourceId: string): string | null {
  const row = ctx.store.db
    .prepare('SELECT id FROM graph_nodes WHERE kind = ? AND source_id = ?')
    .get(kind, sourceId) as { id: string } | undefined;
  return row?.id ?? null;
}

function entityNode(ctx: AknoContext, entityId: string): string | null {
  return graphNode(ctx, 'entity', entityId);
}

function traverse(
  ctx: AknoContext,
  seeds: GraphSeed[],
  options: {
    direction: 'out' | 'in' | 'both';
    relations?: GraphRelation[];
    maxHops: 1 | 2 | 3;
    pathLimit: number;
    includeHistory: boolean;
    factStatusAvailable: boolean;
  },
): { paths: GraphPath[]; edges: GraphEdgeRef[]; nodeIds: Set<string>; truncated: boolean } {
  const paths: GraphPath[] = [];
  const edges = new Map<string, GraphEdgeRef>();
  const nodeIds = new Set<string>();
  let truncated = false;

  seedLoop: for (const seed of seeds) {
    nodeIds.add(seed.node);
    const visited = new Set([seed.node]);
    const queue: { node: string; nodes: string[]; edgeIds: string[]; confidence: number }[] = [
      { node: seed.node, nodes: [seed.node], edgeIds: [], confidence: 1 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.edgeIds.length >= options.maxHops) continue;
      const adjacent = adjacentEdges(ctx, current.node, options);
      if (adjacent.truncated) truncated = true;

      for (const row of adjacent.rows) {
        const next = row.from_node === current.node ? row.to_node : row.from_node;
        if (visited.has(next)) {
          // Keep non-tree edges between nodes already reached by another branch. Without this,
          // entity→fact traversal hides observation→fact lineage merely because the fact node was
          // discovered first, even though both endpoints are in the returned subgraph.
          if (!current.nodes.includes(next)) {
            const edge = edgeRef(row);
            edges.set(edge.id, edge);
          }
          continue;
        }
        if (paths.length >= options.pathLimit) {
          truncated = true;
          break seedLoop;
        }
        visited.add(next);
        nodeIds.add(next);
        const edge = edgeRef(row);
        edges.set(edge.id, edge);
        const edgeIds = [...current.edgeIds, edge.id];
        const pathNodes = [...current.nodes, next];
        const confidence = roundConfidence(current.confidence * edge.confidence);
        const path: GraphPath = {
          seed: seed.node,
          nodes: pathNodes,
          edges: edgeIds,
          hops: edgeIds.length,
          confidence,
          evidence: edgeIds.map((id) => edges.get(id)!.evidence),
        };
        paths.push(path);
        queue.push({ node: next, nodes: pathNodes, edgeIds, confidence });
      }
    }
  }

  return { paths, edges: [...edges.values()], nodeIds, truncated };
}

function adjacentEdges(
  ctx: AknoContext,
  node: string,
  options: {
    direction: 'out' | 'in' | 'both';
    relations?: GraphRelation[];
    includeHistory: boolean;
    factStatusAvailable: boolean;
  },
): { rows: EdgeRow[]; truncated: boolean } {
  const incident =
    options.direction === 'out'
      ? 'e.from_node = ?'
      : options.direction === 'in'
        ? 'e.to_node = ?'
        : '(e.from_node = ? OR e.to_node = ?)';
  const params: unknown[] = options.direction === 'both' ? [node, node] : [node];
  const relationClause = options.relations?.length
    ? ` AND e.relation IN (${options.relations.map(() => '?').join(',')})`
    : '';
  if (options.relations) params.push(...options.relations);
  const eligibility = options.includeHistory
    ? ''
    : options.factStatusAvailable
      ? ' AND (e.source_fact IS NULL OR (s.traversable = 1 AND e.valid_to IS NULL))'
      : ' AND e.source_fact IS NULL';

  const rows = ctx.store.db
    .prepare(
      `SELECT e.id, e.from_node, e.to_node, e.relation, e.predicate, e.source_kind,
              e.source_document, e.source_event, e.source_fact, p.slug AS source_slug,
              e.line_start, e.line_end, e.source_field, e.derivation, e.resolution,
              e.confidence, e.valid_from, e.valid_to
         FROM graph_edges e
         LEFT JOIN pages p ON p.id = e.source_page
         ${options.factStatusAvailable ? 'LEFT JOIN graph_fact_status s ON s.fact_id = e.source_fact' : ''}
        WHERE ${incident}${relationClause}${eligibility}
        ORDER BY e.confidence DESC, e.relation, e.id
        LIMIT ?`,
    )
    .all(...params, FAN_OUT_LIMIT + 1) as EdgeRow[];
  return { rows: rows.slice(0, FAN_OUT_LIMIT), truncated: rows.length > FAN_OUT_LIMIT };
}

function edgeRef(row: EdgeRow): GraphEdgeRef {
  const evidence: GraphEvidenceLocator = {
    kind: row.source_kind,
    ...(row.source_slug ? { slug: row.source_slug } : {}),
    ...(row.source_document ? { document: row.source_document } : {}),
    ...(row.source_event ? { event: row.source_event } : {}),
    ...(row.source_fact ? { fact: row.source_fact } : {}),
    ...(row.line_start ? { line_start: row.line_start } : {}),
    ...(row.line_end ? { line_end: row.line_end } : {}),
    ...(row.source_field ? { field: row.source_field } : {}),
  };
  return {
    id: row.id,
    from: row.from_node,
    to: row.to_node,
    relation: row.relation,
    ...(row.predicate ? { predicate: row.predicate } : {}),
    confidence: row.confidence,
    derivation: row.derivation,
    resolution: row.resolution,
    evidence,
    ...(row.valid_from ? { valid_from: row.valid_from } : {}),
    ...(row.valid_to ? { valid_to: row.valid_to } : {}),
    historical: row.valid_to !== null,
  };
}

function loadNodes(ctx: AknoContext, ids: string[]): GraphNodeRef[] {
  if (ids.length === 0) return [];
  const rows = ctx.store.db
    .prepare(
      `SELECT n.id, n.kind, n.source_id,
              p.slug AS page_slug, p.title AS page_title, p.role AS page_role,
              ge.id AS entity_id, ge.entity_type, ge.label AS entity_label, ep.slug AS entity_slug,
              d.id AS document_id, d.label AS document_label, d.rel_path AS document_path,
              d.group_key AS document_group, d.text AS document_text,
              d.availability AS document_availability, d.missing_since AS document_missing_since,
              dp.slug AS document_owner,
              f.id AS fact_id, fp.slug AS fact_slug,
              f.line_start AS fact_line_start, f.line_end AS fact_line_end,
              ev.id AS event_id, ev.date AS event_date, ev.source_slug AS event_source, ev.line AS event_line,
              oe.id AS observation_id, oe.source_slug AS observation_slug,
              oe.payload_line AS observation_line
         FROM graph_nodes n
         LEFT JOIN pages p ON n.kind = 'page' AND p.id = n.source_id
         LEFT JOIN graph_entities ge ON n.kind = 'entity' AND ge.id = n.source_id
         LEFT JOIN pages ep ON ep.id = ge.canonical_page
         LEFT JOIN documents d ON n.kind = 'document' AND d.id = n.source_id
         LEFT JOIN pages dp ON dp.id = d.page_id
         LEFT JOIN facts f ON n.kind = 'fact' AND f.id = n.source_id
         LEFT JOIN pages fp ON fp.id = f.page_id
         LEFT JOIN events ev ON n.kind = 'event' AND ev.id = n.source_id
         LEFT JOIN observation_entries oe ON n.kind = 'observation' AND oe.id = n.source_id
        WHERE n.id IN (${ids.map(() => '?').join(',')})`,
    )
    .all(...ids) as NodeRow[];
  const byId = new Map(rows.map((row) => [row.id, nodeRef(ctx, row)]));
  return ids.flatMap((id) => {
    const node = byId.get(id);
    return node ? [node] : [];
  });
}

function nodeRef(ctx: AknoContext, row: NodeRow): GraphNodeRef {
  switch (row.kind) {
    case 'entity':
      return {
        id: row.id,
        kind: row.kind,
        entity: row.entity_id!,
        entity_type: row.entity_type!,
        label: row.entity_label!,
        slug: row.entity_slug!,
      };
    case 'page':
      return {
        id: row.id,
        kind: row.kind,
        slug: row.page_slug!,
        label: row.page_title!,
        role: row.page_role!,
      };
    case 'document': {
      const availability = availabilityForDocument(ctx, row);
      return {
        id: row.id,
        kind: row.kind,
        document: row.document_id!,
        ...(row.document_label ? { label: row.document_label } : {}),
        ...(row.document_owner ? { slug: row.document_owner } : {}),
        availability: availability.status,
      };
    }
    case 'fact':
      return {
        id: row.id,
        kind: row.kind,
        fact: row.fact_id!,
        slug: row.fact_slug!,
        line_start: row.fact_line_start!,
        line_end: row.fact_line_end!,
      };
    case 'event':
      return {
        id: row.id,
        kind: row.kind,
        event: row.event_id!,
        date: row.event_date!,
        slug: row.event_source!,
        ...(row.event_line ? { line_start: row.event_line, line_end: row.event_line } : {}),
      };
    case 'observation':
      return {
        id: row.id,
        kind: row.kind,
        observation: row.observation_id!,
        slug: row.observation_slug!,
        line_start: row.observation_line!,
        line_end: row.observation_line!,
      };
  }
}

function availabilityForDocument(ctx: AknoContext, row: NodeRow) {
  const parts = ctx.store.db
    .prepare(
      `SELECT rel_path, text, availability, missing_since
         FROM documents
        WHERE group_key = ? AND renders IS NULL
        ORDER BY part`,
    )
    .all(row.document_group ?? row.document_path) as AvailabilityPart[];
  const source: AvailabilityPart = {
    rel_path: row.document_path!,
    text: row.document_text,
    availability: row.document_availability!,
    missing_since: row.document_missing_since,
  };
  return documentAvailability(ctx.store.db, parts.length > 0 ? parts : [source]);
}

function roundConfidence(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}
