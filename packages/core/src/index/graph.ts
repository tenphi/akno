import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';

export const STRUCTURAL_GRAPH_VERSION = 'structural-v1';

export interface StructuralGraphReport {
  nodes: number;
  edges: number;
}

type NodeKind = 'page' | 'document' | 'event';

interface PageRow {
  id: string;
  slug: string;
  about: string;
  source_hash: string;
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
  to_page: string;
  kind: string;
  line: number | null;
  source_hash: string;
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
    store.db.prepare('DELETE FROM graph_nodes').run();

    const insertNode = store.db.prepare(
      `INSERT INTO graph_nodes(id, kind, source_id, source_hash, derivation_version)
       VALUES(?, ?, ?, ?, ?)`,
    );
    const insertEdge = store.db.prepare(
      `INSERT INTO graph_edges(
         id, from_node, to_node, relation, predicate, source_kind,
         source_page, source_document, source_event, line_start, line_end, source_field,
         source_hash, derivation, resolution, confidence, derivation_version
       ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'structural', 'exact', 1, ?)`,
    );

    const pages = store.db
      .prepare(
        `SELECT p.id, p.slug, p.about,
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
    const addNode = (kind: NodeKind, sourceId: string, sourceHash: string): void => {
      const id = graphNodeId(kind, sourceId);
      nodeIds.set(nodeKey(kind, sourceId), id);
      insertNode.run(id, kind, sourceId, sourceHash, STRUCTURAL_GRAPH_VERSION);
    };
    for (const page of pages) addNode('page', page.id, page.source_hash);
    for (const document of documents) addNode('document', document.id, document.sha256);
    for (const event of events) addNode('event', event.id, event.source_hash);

    const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
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
      insertEdge.run(
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
        STRUCTURAL_GRAPH_VERSION,
      );
      edges++;
    };

    const links = store.db
      .prepare(
        `SELECT l.from_page, l.to_page, l.kind, l.line,
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
    }

    for (const page of pages) {
      for (const targetSlug of new Set(parseStringArray(page.about))) {
        const target = pageBySlug.get(targetSlug);
        if (!target) continue;
        addEdge({
          from: requiredNode(nodeIds, 'page', page.id),
          to: requiredNode(nodeIds, 'page', target.id),
          relation: 'about',
          predicate: null,
          sourceKind: 'frontmatter',
          sourcePage: page.id,
          sourceDocument: null,
          sourceEvent: null,
          line: null,
          sourceField: 'akno.about',
          sourceHash: page.source_hash,
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

    return { nodes: nodeIds.size, edges };
  });
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
