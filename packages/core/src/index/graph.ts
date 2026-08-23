import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';

export const STRUCTURAL_GRAPH_VERSION = 'structural-v1';
export const ENTITY_RESOLUTION_VERSION = 'entity-exact-v1';

export interface StructuralGraphReport {
  nodes: number;
  edges: number;
  entities: number;
  mentions: number;
  ambiguousMentions: number;
  unresolvedMentions: number;
}

export type EntityNameSignal = 'canonical_slug' | 'alias' | 'title' | 'basename';

export type ExactEntityResolution =
  | {
      status: 'resolved';
      normalized: string;
      entityId: string;
      candidates: string[];
      signal: EntityNameSignal;
    }
  | {
      status: 'ambiguous';
      normalized: string;
      candidates: string[];
      signal: EntityNameSignal;
    }
  | { status: 'unresolved'; normalized: string; candidates: [] };

type NodeKind = 'entity' | 'page' | 'document' | 'event';
type EntityType = 'person' | 'organization' | 'place' | 'product' | 'event' | 'concept' | 'other';

interface PageRow {
  id: string;
  slug: string;
  title: string;
  type: string | null;
  role: string;
  about: string;
  aliases: string;
  source_hash: string;
}

interface EntityRow {
  id: string;
  canonicalPage: string;
  type: EntityType;
  label: string;
  sourceHash: string;
}

interface DocumentRow {
  id: string;
  page_id: string | null;
  sha256: string;
}

interface EventRow {
  id: string;
  target_slug: string | null;
  source_page: string;
  line: number | null;
  source_hash: string;
}

interface LinkRow {
  from_page: string;
  to_slug: string;
  to_page: string;
  kind: string;
  line: number | null;
  source_hash: string;
}

interface NameRow {
  entity_id: string;
  signal: EntityNameSignal;
}

/**
 * Replace the complete model-free graph from canonical index rows.
 *
 * At the corpus size Akno targets, a complete transactional rebuild is simpler and safer than
 * trying to patch generic incident edges after every page move, link resolution, or document
 * ownership change. Nothing here reads or writes knowledge-base files.
 */
export function rebuildStructuralGraph(store: Store): StructuralGraphReport {
  return store.transaction(() => {
    // Mention rows use SET NULL for a removed resolution so they can survive an ordinary entity
    // deletion. A graph rebuild replaces them, so remove them explicitly before their entities.
    store.db.prepare('DELETE FROM graph_mentions').run();
    store.db.prepare('DELETE FROM graph_entity_names').run();
    store.db.prepare('DELETE FROM graph_entities').run();
    store.db.prepare('DELETE FROM graph_nodes').run();

    const insertNode = store.db.prepare(
      `INSERT INTO graph_nodes(id, kind, source_id, source_hash, derivation_version)
       VALUES(?, ?, ?, ?, ?)`,
    );
    const insertEntity = store.db.prepare(
      `INSERT INTO graph_entities(
         id, canonical_page, entity_type, label, normalized_label, source_hash, derivation_version
       ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertName = store.db.prepare(
      `INSERT OR IGNORE INTO graph_entity_names(
         entity_id, name, normalized_name, signal, source_page, source_hash, derivation_version
       ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertMention = store.db.prepare(
      `INSERT OR IGNORE INTO graph_mentions(
         id, mention, normalized_mention, source_page, source_field, source_line, source_hash,
         resolved_entity, resolution, signal, candidates, derivation_version
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEdge = store.db.prepare(
      `INSERT OR IGNORE INTO graph_edges(
         id, from_node, to_node, relation, predicate, source_kind,
         source_page, source_document, source_event, line_start, line_end, source_field,
         source_hash, derivation, resolution, confidence, derivation_version
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'structural', 'exact', 1, ?)`,
    );

    const pages = store.db
      .prepare(
        `SELECT p.id, p.slug, p.title, p.type, p.role, p.about, p.aliases,
                COALESCE(
                  (SELECT f.sha256 FROM files f
                    WHERE f.page_id = p.id AND f.kind = 'page'
                    ORDER BY f.rel_path LIMIT 1),
                  p.body_hash
                ) AS source_hash
           FROM pages p
          ORDER BY p.id`,
      )
      .all() as PageRow[];
    const documents = store.db
      .prepare(
        `SELECT id, page_id, sha256 FROM documents
          WHERE renders IS NULL
          ORDER BY id`,
      )
      .all() as DocumentRow[];
    const events = store.db
      .prepare(
        `SELECT e.id, e.target_slug, e.source_page, e.line,
                COALESCE(
                  (SELECT f.sha256 FROM files f
                    WHERE f.page_id = p.id AND f.kind = 'page'
                    ORDER BY f.rel_path LIMIT 1),
                  p.body_hash
                ) AS source_hash
           FROM events e
           JOIN pages p ON p.id = e.source_page
          ORDER BY e.id`,
      )
      .all() as EventRow[];

    const nodeIds = new Map<string, string>();
    const addNode = (
      kind: NodeKind,
      sourceId: string,
      sourceHash: string,
      version = STRUCTURAL_GRAPH_VERSION,
    ): void => {
      const id = graphNodeId(kind, sourceId);
      nodeIds.set(nodeKey(kind, sourceId), id);
      insertNode.run(id, kind, sourceId, sourceHash, version);
    };
    for (const page of pages) addNode('page', page.id, page.source_hash);
    for (const document of documents) addNode('document', document.id, document.sha256);
    for (const event of events) addNode('event', event.id, event.source_hash);

    const entities: EntityRow[] = pages
      .filter((page) => page.role === 'knowledge')
      .map((page) => ({
        id: entityId(page.id),
        canonicalPage: page.id,
        type: entityType(page.type),
        label: page.title,
        sourceHash: page.source_hash,
      }));
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const entityByPage = new Map(entities.map((entity) => [entity.canonicalPage, entity]));
    for (const entity of entities) {
      const page = pageById.get(entity.canonicalPage)!;
      insertEntity.run(
        entity.id,
        entity.canonicalPage,
        entity.type,
        entity.label,
        normalizeEntityName(entity.label),
        entity.sourceHash,
        ENTITY_RESOLUTION_VERSION,
      );
      addNode('entity', entity.id, entity.sourceHash, ENTITY_RESOLUTION_VERSION);
      for (const name of entityNames(page)) {
        insertName.run(
          entity.id,
          name.name,
          name.normalized,
          name.signal,
          page.id,
          page.source_hash,
          ENTITY_RESOLUTION_VERSION,
        );
      }
    }

    let edges = 0;
    const addEdge = (edge: {
      from: string;
      to: string;
      relation: string;
      predicate: string | null;
      sourceKind: 'page_line' | 'frontmatter' | 'document';
      sourcePage: string | null;
      sourceDocument: string | null;
      sourceEvent: string | null;
      line: number | null;
      sourceField: string | null;
      sourceHash: string;
      version?: string;
    }): void => {
      const locator = [
        edge.sourceKind,
        edge.sourcePage,
        edge.sourceDocument,
        edge.sourceEvent,
        edge.line,
        edge.sourceField,
      ].join('\0');
      const id = `ged_${sha256(
        `${edge.from}\0${edge.to}\0${edge.relation}\0${edge.predicate ?? ''}\0${locator}`,
      ).slice(0, 24)}`;
      const result = insertEdge.run(
        id,
        edge.from,
        edge.to,
        edge.relation,
        edge.predicate,
        edge.sourceKind,
        edge.sourcePage,
        edge.sourceDocument,
        edge.sourceEvent,
        edge.line,
        edge.line,
        edge.sourceField,
        edge.sourceHash,
        edge.version ?? STRUCTURAL_GRAPH_VERSION,
      );
      edges += result.changes;
    };

    for (const entity of entities) {
      addEdge({
        from: requiredNode(nodeIds, 'entity', entity.id),
        to: requiredNode(nodeIds, 'page', entity.canonicalPage),
        relation: 'canonical_record',
        predicate: entity.type,
        sourceKind: 'frontmatter',
        sourcePage: entity.canonicalPage,
        sourceDocument: null,
        sourceEvent: null,
        line: null,
        sourceField: 'entity.identity',
        sourceHash: entity.sourceHash,
        version: ENTITY_RESOLUTION_VERSION,
      });
    }

    let mentions = 0;
    let ambiguousMentions = 0;
    let unresolvedMentions = 0;
    const addMention = (input: {
      mention: string;
      sourcePage: string;
      sourceField: string;
      sourceLine: number | null;
      sourceHash: string;
      resolution: ExactEntityResolution;
    }): void => {
      const { resolution } = input;
      const id = `gmn_${sha256(
        `${input.sourcePage}\0${input.sourceField}\0${input.sourceLine ?? ''}\0${resolution.normalized}`,
      ).slice(0, 24)}`;
      const result = insertMention.run(
        id,
        input.mention,
        resolution.normalized,
        input.sourcePage,
        input.sourceField,
        input.sourceLine,
        input.sourceHash,
        resolution.status === 'resolved' ? resolution.entityId : null,
        resolution.status === 'resolved' ? 'exact' : resolution.status,
        resolution.status === 'unresolved' ? null : resolution.signal,
        JSON.stringify(resolution.candidates),
        ENTITY_RESOLUTION_VERSION,
      );
      mentions += result.changes;
      if (result.changes === 0) return;
      if (resolution.status === 'ambiguous') ambiguousMentions++;
      if (resolution.status === 'unresolved') unresolvedMentions++;
    };

    const links = store.db
      .prepare(
        `SELECT l.from_page, l.to_slug, l.to_page, l.kind, l.line,
                COALESCE(
                  (SELECT f.sha256 FROM files f
                    WHERE f.page_id = p.id AND f.kind = 'page'
                    ORDER BY f.rel_path LIMIT 1),
                  p.body_hash
                ) AS source_hash
           FROM links l
           JOIN pages p ON p.id = l.from_page
          WHERE l.broken = 0 AND l.to_page IS NOT NULL AND l.kind != 'embed'
          ORDER BY l.from_page, l.to_page, l.kind`,
      )
      .all() as LinkRow[];
    for (const link of links) {
      addEdge({
        from: requiredNode(nodeIds, 'page', link.from_page),
        to: requiredNode(nodeIds, 'page', link.to_page),
        relation: 'links_to',
        predicate: link.kind,
        sourceKind: 'page_line',
        sourcePage: link.from_page,
        sourceDocument: null,
        sourceEvent: null,
        line: link.line,
        sourceField: link.kind,
        sourceHash: link.source_hash,
      });
      const targetEntity = entityByPage.get(link.to_page);
      if (!targetEntity) continue;
      const resolution: ExactEntityResolution = {
        status: 'resolved',
        normalized: normalizeEntityName(link.to_slug),
        entityId: targetEntity.id,
        candidates: [targetEntity.id],
        signal: 'canonical_slug',
      };
      addMention({
        mention: link.to_slug,
        sourcePage: link.from_page,
        sourceField: link.kind,
        sourceLine: link.line,
        sourceHash: link.source_hash,
        resolution,
      });
      addEdge({
        from: requiredNode(nodeIds, 'page', link.from_page),
        to: requiredNode(nodeIds, 'entity', targetEntity.id),
        relation: 'mentions',
        predicate: link.kind,
        sourceKind: 'page_line',
        sourcePage: link.from_page,
        sourceDocument: null,
        sourceEvent: null,
        line: link.line,
        sourceField: link.kind,
        sourceHash: link.source_hash,
        version: ENTITY_RESOLUTION_VERSION,
      });
    }

    for (const page of pages) {
      for (const mention of new Set(parseStringArray(page.about))) {
        const resolution = resolveExactEntity(store.db, mention);
        addMention({
          mention,
          sourcePage: page.id,
          sourceField: 'akno.about',
          sourceLine: null,
          sourceHash: page.source_hash,
          resolution,
        });
        if (resolution.status !== 'resolved') continue;
        addEdge({
          from: requiredNode(nodeIds, 'page', page.id),
          to: requiredNode(nodeIds, 'entity', resolution.entityId),
          relation: 'about',
          predicate: null,
          sourceKind: 'frontmatter',
          sourcePage: page.id,
          sourceDocument: null,
          sourceEvent: null,
          line: null,
          sourceField: 'akno.about',
          sourceHash: page.source_hash,
          version: ENTITY_RESOLUTION_VERSION,
        });
      }
    }

    for (const document of documents) {
      if (!document.page_id) continue;
      addEdge({
        from: requiredNode(nodeIds, 'document', document.id),
        to: requiredNode(nodeIds, 'page', document.page_id),
        relation: 'owns_document',
        predicate: null,
        sourceKind: 'document',
        sourcePage: null,
        sourceDocument: document.id,
        sourceEvent: null,
        line: null,
        sourceField: 'documents.page_id',
        sourceHash: document.sha256,
      });
    }

    const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
    for (const event of events) {
      const eventNode = requiredNode(nodeIds, 'event', event.id);
      addEdge({
        from: requiredNode(nodeIds, 'page', event.source_page),
        to: eventNode,
        relation: 'participates_in',
        predicate: 'source',
        sourceKind: 'page_line',
        sourcePage: event.source_page,
        sourceDocument: null,
        sourceEvent: event.id,
        line: event.line,
        sourceField: 'event.source',
        sourceHash: event.source_hash,
      });
      const target = event.target_slug ? pageBySlug.get(event.target_slug) : null;
      if (!target) continue;
      addEdge({
        from: requiredNode(nodeIds, 'page', target.id),
        to: eventNode,
        relation: 'participates_in',
        predicate: 'target',
        sourceKind: 'page_line',
        sourcePage: event.source_page,
        sourceDocument: null,
        sourceEvent: event.id,
        line: event.line,
        sourceField: 'event.target',
        sourceHash: event.source_hash,
      });
    }

    return {
      nodes: nodeIds.size,
      edges,
      entities: entities.length,
      mentions,
      ambiguousMentions,
      unresolvedMentions,
    };
  });
}

/** Resolve only evidence-declared identities. Similarity and model judgment are intentionally absent. */
export function resolveExactEntity(db: Store['db'], mention: string): ExactEntityResolution {
  const normalized = normalizeEntityName(canonicalMention(mention));
  if (!normalized) return { status: 'unresolved', normalized, candidates: [] };
  const rows = db
    .prepare(
      `SELECT entity_id, signal
         FROM graph_entity_names
        WHERE normalized_name = ?
        ORDER BY entity_id`,
    )
    .all(normalized) as NameRow[];
  const priorities: EntityNameSignal[] = ['canonical_slug', 'alias', 'title', 'basename'];
  for (const signal of priorities) {
    const candidates = [...new Set(rows.filter((row) => row.signal === signal).map((row) => row.entity_id))];
    if (candidates.length === 1) {
      return { status: 'resolved', normalized, entityId: candidates[0]!, candidates, signal };
    }
    if (candidates.length > 1) return { status: 'ambiguous', normalized, candidates, signal };
  }
  return { status: 'unresolved', normalized, candidates: [] };
}

export function normalizeEntityName(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('und')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalMention(value: string): string {
  let result = value.trim();
  if (result.startsWith('[[') && result.endsWith(']]')) result = result.slice(2, -2).split('|', 1)[0]!;
  result = result.split('#', 1)[0]!.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\//, '');
  return result.replace(/\.md$/i, '');
}

function entityNames(page: PageRow): { name: string; normalized: string; signal: EntityNameSignal }[] {
  const raw: { name: string; signal: EntityNameSignal }[] = [
    { name: page.slug, signal: 'canonical_slug' },
    ...parseStringArray(page.aliases).map((name) => ({ name, signal: 'alias' as const })),
    { name: page.title, signal: 'title' },
    { name: page.slug.split('/').at(-1) ?? page.slug, signal: 'basename' },
  ];
  const seen = new Set<string>();
  return raw.flatMap((entry) => {
    const normalized = normalizeEntityName(entry.name);
    const key = `${entry.signal}\0${normalized}`;
    if (!normalized || seen.has(key)) return [];
    seen.add(key);
    return [{ ...entry, normalized }];
  });
}

function entityType(value: string | null): EntityType {
  switch (normalizeEntityName(value ?? '')) {
    case 'person':
      return 'person';
    case 'organization':
    case 'organisation':
    case 'company':
    case 'business':
      return 'organization';
    case 'place':
    case 'location':
    case 'city':
    case 'country':
      return 'place';
    case 'product':
    case 'device':
      return 'product';
    case 'event':
      return 'event';
    case 'concept':
    case 'topic':
      return 'concept';
    default:
      return 'other';
  }
}

function entityId(pageId: string): string {
  return `ent_${sha256(`page\0${pageId}`).slice(0, 24)}`;
}

function graphNodeId(kind: NodeKind, sourceId: string): string {
  return `gnd_${sha256(`${kind}\0${sourceId}`).slice(0, 24)}`;
}

function nodeKey(kind: NodeKind, sourceId: string): string {
  return `${kind}\0${sourceId}`;
}

function requiredNode(nodes: Map<string, string>, kind: NodeKind, sourceId: string): string {
  const id = nodes.get(nodeKey(kind, sourceId));
  if (!id) throw new Error(`structural graph is missing its ${kind} node`);
  return id;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}
