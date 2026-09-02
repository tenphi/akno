import type { MemoryQualification, MemoryView, RecallMode } from '@tenphi/akno-protocol';

export type QualifiedMemory = Extract<MemoryQualification, { status: 'qualified' }>;

/** The subset shared by protocol qualifications and the rebuildable SQL projection. */
export interface MemorySemantics {
  kind: QualifiedMemory['kind'];
  commitment: QualifiedMemory['commitment'];
  disposition: QualifiedMemory['disposition'];
  basis: QualifiedMemory['basis'];
  answerEligible: boolean;
  temporalStatus?: 'actual' | 'scheduled' | 'planned' | 'tentative' | null;
  temporalRelation?: 'occurred' | 'valid' | 'scheduled' | 'due' | null;
}

/**
 * Resolve only explicit, high-precision language. An ambiguous query gets factual memory rather
 * than broadening into reports or imagined alternatives merely because those words rank well.
 */
export function inferMemoryView(query: string, mode: RecallMode = 'lookup'): MemoryView {
  if (/\b(report|reported|reports|said|says|according to|told|claimed|claims)\b/i.test(query)) {
    return 'reports';
  }
  if (
    /\b(open question|open questions|unresolved question|unresolved questions|what remains (?:open|unanswered)|questions? remain)\b/i.test(
      query,
    )
  ) {
    return 'questions';
  }
  if (
    /\b(hypothetical|counterfactual|what if|suppose|scenario|scenarios|alternative|alternatives|ideas? considered|discussed options?)\b/i.test(
      query,
    )
  ) {
    return 'discussion';
  }
  if (
    /\b(history|historical|previously|formerly|rejected|cancelled|canceled|completed|superseded|resolved|what was decided|decision history)\b/i.test(
      query,
    )
  ) {
    return 'history';
  }
  if (
    /\b(plan|plans|planned|planning|schedule|scheduled|upcoming|due|overdue|deadline|next action|next actions)\b/i.test(
      query,
    )
  ) {
    return 'planning';
  }
  return mode === 'explore' ? 'all' : 'factual';
}

export function memoryEligibleForView(memory: MemorySemantics, view: MemoryView): boolean {
  if (view === 'all') return true;
  if (view === 'factual') return memory.answerEligible;
  if (view === 'reports') return memory.basis === 'source_report';
  if (view === 'questions') return memory.kind === 'question';
  if (view === 'planning') {
    return (
      (memory.kind === 'plan' ||
        memory.temporalStatus === 'planned' ||
        memory.temporalStatus === 'scheduled') &&
      ['active', 'proposed', 'accepted'].includes(memory.disposition)
    );
  }
  if (view === 'history') {
    return (
      ['rejected', 'cancelled', 'completed', 'superseded', 'resolved'].includes(memory.disposition) ||
      (memory.kind === 'decision' && memory.disposition === 'accepted')
    );
  }
  return (
    memory.commitment === 'tentative' ||
    memory.commitment === 'hypothetical' ||
    memory.commitment === 'counterfactual' ||
    memory.disposition === 'proposed' ||
    memory.disposition === 'rejected'
  );
}

export function qualificationEligibleForView(memory: QualifiedMemory, view: MemoryView): boolean {
  return memoryEligibleForView(
    {
      kind: memory.kind,
      commitment: memory.commitment,
      disposition: memory.disposition,
      basis: memory.basis,
      answerEligible: memory.answer_eligible,
      temporalStatus: memory.temporal?.time.status,
      temporalRelation: memory.temporal?.time.relation,
    },
    view,
  );
}
