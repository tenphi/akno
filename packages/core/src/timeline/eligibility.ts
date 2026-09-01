import type { MemoryQualification } from '@tenphi/akno-protocol';

export type QualifiedMemory = Extract<MemoryQualification, { status: 'qualified' }>;

export interface TemporalQueryIntent {
  current: boolean;
  future: boolean;
  history: boolean;
  sourceReport: boolean;
}

/** Keep temporal question interpretation identical across context activation and answering. */
export function temporalQueryIntent(query: string): TemporalQueryIntent {
  return {
    current: /\b(current|currently|active|now|today)\b/i.test(query),
    future:
      /\b(next|upcoming|future|due|overdue|schedule|scheduled|scheduling|deadline|plan|plans|planned|planning)\b/i.test(
        query,
      ),
    history:
      /\b(past|history|historical|happened|occurred|previously|when did|cancelled|completed|superseded|rejected|resolved|former)\b/i.test(
        query,
      ),
    sourceReport: /\b(report|reported|said|according to)\b/i.test(query),
  };
}

export function futureMemoryEligible(memory: QualifiedMemory): boolean {
  return (
    memory.temporal?.actionable === true &&
    memory.commitment === 'asserted' &&
    memory.basis !== 'source_report' &&
    (memory.kind === 'plan' || memory.kind === 'event') &&
    (memory.disposition === 'active' || memory.disposition === 'accepted')
  );
}

export function canonicalMemoryEligibleNow(memory: QualifiedMemory): boolean {
  if (memory.temporal?.time.relation === 'valid') return memory.current_eligible;
  return memory.answer_eligible;
}

export function historicalMemoryEligible(memory: QualifiedMemory, sourceReport: boolean): boolean {
  if (memory.answer_eligible) return true;
  return (
    memory.temporal !== undefined &&
    memory.commitment === 'asserted' &&
    (memory.basis !== 'source_report' || sourceReport) &&
    ['plan', 'event', 'decision'].includes(memory.kind) &&
    ['cancelled', 'completed', 'superseded', 'rejected', 'resolved'].includes(memory.disposition)
  );
}
