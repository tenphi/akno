import type { Store } from '../store/db.ts';
import { sha256 } from '../store/ids.ts';
import type { EntityNameSignal } from '../index/graph.ts';

export type GraphMaintenanceCandidateKind = 'identity_collision' | 'unresolved_about' | 'traversal_hub';

/**
 * A graph finding worth inspecting, not authority to edit anything.
 *
 * These records deliberately contain no operation or target path. Future planners may consume a
 * fingerprint as candidate evidence, but still have to pass the transformation's ordinary identity,
 * ownership, policy, and preservation guards before they can produce a diff.
 */
export interface GraphMaintenanceCandidate {
  kind: GraphMaintenanceCandidateKind;
  subject: string;
  related: string[];
  occurrences: number;
  reason: string;
  fingerprint: string;
}

interface NameRow {
  normalized_name: string;
  signal: EntityNameSignal;
  entity_id: string;
  slug: string;
}

interface MentionCountRow {
  normalized_mention: string;
  resolution: 'exact' | 'contextual' | 'ambiguous' | 'unresolved';
  count: number;
}

interface UnresolvedAboutRow {
  mention: string;
  normalized_mention: string;
  source_hash: string;
  slug: string;
}

interface HubRow {
  node_id: string;
  entity_id: string;
  slug: string;
  degree: number;
}

const SIGNAL_PRIORITY: EntityNameSignal[] = ['canonical_slug', 'alias', 'title', 'basename'];
/** Matches graph traversal's per-node fan-out cap; a greater degree makes path absence incomplete. */
export const GRAPH_MAINTENANCE_HUB_DEGREE = 50;

export function discoverGraphMaintenanceCandidates(store: Store): GraphMaintenanceCandidate[] {
  const requiredTables = [
    'graph_entities',
    'graph_entity_names',
    'graph_mentions',
    'graph_nodes',
    'graph_edges',
  ];
  if (requiredTables.some((table) => !tableExists(store, table))) return [];
  return [...identityCollisions(store), ...unresolvedAboutReferences(store), ...traversalHubs(store)].sort(
    (left, right) => left.kind.localeCompare(right.kind) || left.subject.localeCompare(right.subject),
  );
}

function identityCollisions(store: Store): GraphMaintenanceCandidate[] {
  const rows = store.db
    .prepare(
      `SELECT n.normalized_name, n.signal, n.entity_id, p.slug
         FROM graph_entity_names n
         JOIN graph_entities e ON e.id = n.entity_id
         JOIN pages p ON p.id = e.canonical_page
        ORDER BY n.normalized_name, n.signal, p.slug`,
    )
    .all() as NameRow[];
  const mentions = store.db
    .prepare(
      `SELECT normalized_mention, resolution, count(*) AS count
         FROM graph_mentions
        GROUP BY normalized_mention, resolution`,
    )
    .all() as MentionCountRow[];
  const mentionCounts = new Map<string, Map<MentionCountRow['resolution'], number>>();
  for (const row of mentions) {
    const bucket = mentionCounts.get(row.normalized_mention) ?? new Map();
    bucket.set(row.resolution, row.count);
    mentionCounts.set(row.normalized_mention, bucket);
  }

  const byName = new Map<string, Map<EntityNameSignal, NameRow[]>>();
  for (const row of rows) {
    const signals = byName.get(row.normalized_name) ?? new Map();
    const bucket = signals.get(row.signal) ?? [];
    bucket.push(row);
    signals.set(row.signal, bucket);
    byName.set(row.normalized_name, signals);
  }

  const candidates: GraphMaintenanceCandidate[] = [];
  for (const [name, signals] of byName) {
    const collision = SIGNAL_PRIORITY.flatMap((signal) => {
      const matches = uniqueEntities(signals.get(signal) ?? []);
      return matches.length > 1 ? [{ signal, matches }] : [];
    })[0];
    if (!collision) continue;
    const related = collision.matches.map((row) => row.slug).sort();
    const counts = mentionCounts.get(name);
    const ambiguous = counts?.get('ambiguous') ?? 0;
    const contextual = counts?.get('contextual') ?? 0;
    const occurrences = ambiguous + contextual;
    const reason =
      ambiguous > 0
        ? `the exact ${collision.signal} blocks ${ambiguous} mention(s); clarify identity declarations before considering a merge`
        : contextual > 0
          ? `the shared ${collision.signal} required contextual resolution for ${contextual} mention(s); review whether the names or page purposes should be clearer`
          : `the exact ${collision.signal} maps to ${related.length} canonical pages; review the identity declarations before recall encounters an ambiguity`;
    candidates.push(candidate('identity_collision', name, related, occurrences, reason));
  }
  return candidates;
}

function unresolvedAboutReferences(store: Store): GraphMaintenanceCandidate[] {
  const rows = store.db
    .prepare(
      `SELECT m.mention, m.normalized_mention, m.source_hash, p.slug
         FROM graph_mentions m
         JOIN pages p ON p.id = m.source_page
        WHERE m.source_field = 'akno.about' AND m.resolution = 'unresolved'
        ORDER BY p.slug, m.normalized_mention`,
    )
    .all() as UnresolvedAboutRow[];
  return rows.map((row) =>
    candidate(
      'unresolved_about',
      row.slug,
      [row.mention],
      1,
      'an authored akno.about target has no canonical entity; repair the reference or create the intended page explicitly',
      row.source_hash,
    ),
  );
}

function traversalHubs(store: Store): GraphMaintenanceCandidate[] {
  const rows = store.db
    .prepare(
      `WITH current_incident(node_id, edge_id) AS (
         SELECT from_node, id FROM graph_edges WHERE valid_to IS NULL
         UNION ALL
         SELECT to_node, id FROM graph_edges WHERE valid_to IS NULL
       )
       SELECT n.id AS node_id, n.source_id AS entity_id, p.slug, count(DISTINCT i.edge_id) AS degree
         FROM graph_nodes n
         JOIN current_incident i ON i.node_id = n.id
         JOIN graph_entities e ON e.id = n.source_id
         JOIN pages p ON p.id = e.canonical_page
        WHERE n.kind = 'entity'
        GROUP BY n.id, n.source_id, p.slug
       HAVING count(DISTINCT i.edge_id) > ?
        ORDER BY degree DESC, p.slug`,
    )
    .all(GRAPH_MAINTENANCE_HUB_DEGREE) as HubRow[];
  const edgeIds = store.db.prepare(
    `SELECT id FROM graph_edges
      WHERE (from_node = ? OR to_node = ?) AND valid_to IS NULL
      ORDER BY id`,
  );
  return rows.map((row) => {
    const edges = (edgeIds.all(row.node_id, row.node_id) as { id: string }[]).map((edge) => edge.id);
    return candidate(
      'traversal_hub',
      row.slug,
      [],
      row.degree,
      `this entity has ${row.degree} current incident edges and can hit the graph traversal fan-out cap; review whether it is a useful identity or an overly generic hub`,
      sha256(JSON.stringify(edges)),
    );
  });
}

function uniqueEntities(rows: NameRow[]): NameRow[] {
  return [...new Map(rows.map((row) => [row.entity_id, row])).values()];
}

function candidate(
  kind: GraphMaintenanceCandidateKind,
  subject: string,
  related: string[],
  occurrences: number,
  reason: string,
  evidenceFingerprint = '',
): GraphMaintenanceCandidate {
  return {
    kind,
    subject,
    related,
    occurrences,
    reason,
    fingerprint: sha256(JSON.stringify({ kind, subject, related, occurrences, reason, evidenceFingerprint })),
  };
}

function tableExists(store: Store, name: string): boolean {
  const row = store.db
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { present: number } | undefined;
  return row?.present === 1;
}
