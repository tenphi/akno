import type { MemoryQualification, MemoryView, RecallMode } from '@tenphi/akno-protocol';

export type QualifiedMemory = Extract<MemoryQualification, { status: 'qualified' }>;
export const MEMORY_VIEW_VERSION = 'memory-view-v6';

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
  const russian = russianMemoryView(query);
  if (russian) return russian;
  if (/\b(report|reported|reports|said|says|according to|told|claimed|claims)\b/i.test(query)) {
    return 'reports';
  }
  if (
    /\b((?:open|unresolved|unanswered) (?:[a-z-]+ ){0,3}questions?|what remains (?:open|unanswered)|questions? remain)\b/i.test(
      query,
    )
  ) {
    return 'questions';
  }
  if (
    /\b(hypothetical|hypotheses|hypothesis|counterfactual|what if|suppose|scenario|scenarios|alternative|alternatives|competing (?:[a-z-]+ ){0,3}explanations?|ideas? considered|discussed options?|tentative beliefs?|unconfirmed hypotheses|fictional (?:[a-z-]+ ){0,3}examples?)\b/i.test(
      query,
    )
  ) {
    return 'discussion';
  }
  if (declinedOffer(query)) return 'history';
  if (
    /\b(history|historical|previously|formerly|reject(?:s|ed|ing)?|cancel(?:led|ed)?|completed|superseded|resolved|what was decided|decision history)\b/i.test(
      query,
    )
  ) {
    return 'history';
  }
  if (
    /\b(plan|plans|planned|planning|proposal|proposed|schedule|scheduled|upcoming|due|overdue|deadline|next action|next actions)\b/i.test(
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

// A measured decline is factual. Require the declined object to be an offer/plan, with a
// bounded grammatical connection; merely mentioning an offer elsewhere is insufficient.
function declinedOffer(query: string): boolean {
  return /\b(?:(?:offers?|proposals?|plans?|options?) (?:did|does|has|had|was|were) (?:[\p{L}'’-]+ ){0,4}declin(?:e[sd]?|ing)|declin(?:e[sd]?|ing) (?:an?|the|this|that|her|his|their) (?:[\p{L}'’-]+ ){0,3}(?:offer|proposal|plan|option))\b/iu.test(
    query,
  );
}

// Binding the phrase and predicate by word distance excludes an unrelated predicate in a
// following clause. These patterns are precision-oriented cues, not a general discourse parser.
function boundedDiscoursePhrase(noun: string, predicate: string): RegExp {
  const gap = String.raw`(?:[ \t]+[\p{L}\p{N}-]+){0,8}[ \t]+`;
  return new RegExp(
    String.raw`(?:^|[^\p{L}\p{N}])(?:${noun}${gap}${predicate}|${predicate}${gap}${noun})(?=$|[^\p{L}\p{N}])`,
    'iu',
  );
}
const RUSSIAN_QUALIFIED_REPORT = boundedDiscoursePhrase(
  String.raw`(?:неподтвержд[её]нн|непроверенн|предварительн)\p{L}* (?:[\p{L}-]+ ){0,3}сообщени\p{L}*`,
  String.raw`(?:записал[аи]?|дал[аи]?|передал[аи]?)`,
);
const RUSSIAN_UNREALIZED_DISCUSSION = boundedDiscoursePhrase(
  String.raw`нереализованн\p{L}* (?:[\p{L}-]+ ){0,3}вариант\p{L}*`,
  String.raw`(?:описал[аи]?|рассмотрел[аи]?|обсудил[аи]?)`,
);

function russianMemoryView(query: string): MemoryView | null {
  if (RUSSIAN_QUALIFIED_REPORT.test(query)) return 'reports';
  if (
    /(?:^|[^\p{L}])(?:сообщил|сообщила|сообщает|сказал|сказала|по словам|со слов|согласно|утверждает)(?=$|[^\p{L}])/iu.test(
      query,
    )
  )
    return 'reports';
  if (/вопрос\p{L}* (?:остал|открыт|не реш)|нереш[её]нн\p{L}* вопрос|открыт\p{L}* вопрос/iu.test(query))
    return 'questions';
  if (RUSSIAN_UNREALIZED_DISCUSSION.test(query)) return 'discussion';
  if (/гипотез|гипотетическ|контрфактическ|что если|предположим|сценари|альтернатив|обсуждал/iu.test(query))
    return 'discussion';
  // The noun "replacement" asks about coverage too; only an explicit completed replacement
  // denotes history. A stem match used to hide factual coverage from Russian questions.
  if (/истори|раньше|прежде|отклон|отмен|заверш|был[аои]? замен|замен[её]н|было решено/iu.test(query))
    return 'history';
  if (
    /план|предложил|предложили|предложен|расписани|предстоят|предстоящ|крайний срок|срок\p{L}* (?:оплаты|подачи|выполнения|осмотра)|дедлайн|просроч/iu.test(
      query,
    )
  )
    return 'planning';
  return null;
}
