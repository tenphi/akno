import type { ProvidedRetainCandidate } from '@tenphi/akno-protocol';
import { normalizeEntityName, resolveExactEntity } from '../index/graph.ts';
import type { Store } from '../store/db.ts';

interface EntityNameRow {
  entity_id: string;
  normalized_name: string;
}

/**
 * Resolve only identity text the caller or extractor already supplied. The model never writes an
 * entity id, and a topic merely mentioned in the readable sentence cannot become its subject.
 */
export function resolveRetainedSubject(
  store: Store,
  candidate: Pick<ProvidedRetainCandidate, 'subject' | 'subject_ref'>,
): ProvidedRetainCandidate['subject_ref'] | undefined {
  if (candidate.subject_ref) return candidate.subject_ref;
  const exact = resolveExactEntity(store.db, candidate.subject);
  if (exact.status === 'resolved') return { entity_id: exact.entityId };

  const normalized = normalizeEntityName(candidate.subject);
  if (!normalized) return undefined;
  const padded = ` ${normalized} `;
  const matches = new Set<string>();
  const rows = store.db
    .prepare(
      `SELECT DISTINCT entity_id, normalized_name FROM graph_entity_names
        WHERE instr(normalized_name, ' ') > 0 ORDER BY length(normalized_name) DESC`,
    )
    .all() as EntityNameRow[];
  for (const row of rows) {
    if (padded.includes(` ${row.normalized_name} `)) matches.add(row.entity_id);
  }
  return matches.size === 1 ? { entity_id: [...matches][0]! } : undefined;
}
