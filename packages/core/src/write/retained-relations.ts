import type { ProvidedRetainCandidate } from '@tenphi/akno-protocol';

/** Shared by extraction validation and staged writes so malformed dependencies are held before verification. */
export function dependencyOrder<T extends ProvidedRetainCandidate>(
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
