import {
  ContextInput,
  type Card,
  type ContextOutput,
  type MemoryView,
  type RecallResult,
  type RecallQualification,
  type TimelineResult,
  type ContextInput as ParsedContextInput,
} from '@tenphi/akno-protocol';
import type { AknoContext } from '../context.ts';
import { estimateTokens } from '../recall/assemble.ts';
import {
  canonicalMemoryEligibleNow,
  futureMemoryEligible,
  historicalMemoryEligible,
  temporalQueryIntent,
} from '../timeline/eligibility.ts';
import { recall } from './recall.ts';
import { read } from './read.ts';
import { timeline } from './timeline.ts';
import { list } from './list.ts';
import { inferMemoryView, qualificationEligibleForView } from '../memory/intent.ts';

/**
 * **One budget, one assembly.** `context` composes the whole pre-turn bundle
 * — pinned pages, recent timeline, structure tree, and this turn's recall —
 * against a single budget. Separate injections with separate budgets overrun
 * together.
 *
 * Why this matters: with the bundle assembled, a turn like "when does
 * the car insurance renew?" costs **zero tool calls**, and the assistant cannot
 * invent the date because every line it was handed says which file and which line
 * it came from.
 */
export async function context(ctx: AknoContext, rawInput: unknown): Promise<ContextOutput> {
  const input = ContextInput.parse(rawInput);
  if (input.profile === 'auto_recall') {
    return autoRecallContext(ctx, { ...input, profile: 'auto_recall', query: input.query! });
  }

  const budget = input.budget ?? 20_000;
  let remaining = budget;
  const degraded = new Set<NonNullable<ContextOutput['degraded']>[number]>();
  let droppedPinned = 0;
  const droppedResults = 0;
  let droppedTimeline = 0;

  // ── Pinned pages first ───────────────────────────────────────────────────
  // They were pinned precisely so they do not have to compete for room.
  const pinned: Card[] = [];
  for (const slug of input.pinned ?? []) {
    try {
      const result = await read(ctx, { slug });
      for (const reason of result.degraded ?? []) degraded.add(reason);
      if (!result.page) {
        droppedPinned++;
        continue;
      }
      const card = cardFromPage(result.page);
      const cost = estimateTokens(card);
      if (cost > remaining) {
        droppedPinned++;
        continue;
      }
      pinned.push(card);
      remaining -= cost;
    } catch {
      // A pinned page that no longer exists should not fail the whole bundle;
      // the host's pin list is allowed to go stale.
      droppedPinned++;
    }
  }

  // ── Structure outline ────────────────────────────────────────────────────
  let structure: string | undefined;
  if (input.structure !== false) {
    const tree = await list(ctx, { kind: 'tree', depth: 2 });
    if (tree.tree) {
      const cost = Math.ceil(tree.tree.length / 4);
      if (cost <= remaining * 0.15) {
        structure = tree.tree;
        remaining -= cost;
      }
    }
  }

  // ── Recent timeline ──────────────────────────────────────────────────────
  const recentTimeline: TimelineResult[] = [];
  const days = input.timeline_days ?? 90;
  if (days > 0) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const ledger = await timeline(ctx, { since, until, limit: 60, order: 'nearest' });
    // The ledger is capped at a fraction of the budget: recent history is
    // context, not the answer, and a long ledger must not crowd out the cards.
    let ledgerBudget = Math.floor(remaining * 0.25);
    for (const [index, entry] of ledger.results.entries()) {
      const content =
        entry.type === 'event'
          ? entry.summary
          : entry.type === 'memory'
            ? `${entry.summary} ${entry.slug}`
            : `${entry.path} ${entry.quote ?? ''} ${entry.date_basis}`;
      const boundary = entry.start ?? entry.until ?? '';
      const cost = Math.ceil((content.length + boundary.length + 20) / 4);
      if (cost > ledgerBudget) {
        droppedTimeline = ledger.results.length - index;
        break;
      }
      recentTimeline.push(entry);
      ledgerBudget -= cost;
      remaining -= cost;
    }
    for (const reason of ledger.degraded ?? []) degraded.add(reason);
  }
  // ── This turn's recall ───────────────────────────────────────────────────
  let results: RecallResult[] = [];
  let searched: string[] = [];
  let coverage: Record<string, boolean> | undefined;
  let qualification: RecallQualification | undefined;
  let memoryView: MemoryView | undefined;

  if (input.query) {
    const pinnedSlugs = new Set(pinned.map((card) => card.slug));
    const result = await recall(ctx, {
      query: input.query,
      budget: remaining,
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.memory_view ? { memory_view: input.memory_view } : {}),
      ...(input.include ? { include: input.include } : {}),
      ...(input.filter ? { filter: input.filter } : {}),
    });
    searched = result.searched;
    if (result.coverage) coverage = result.coverage;
    if (result.qualification) qualification = result.qualification;
    memoryView = result.memory_view;
    for (const reason of result.degraded ?? []) degraded.add(reason);
    // A pinned page already in the bundle must not be returned twice.
    results = result.results.filter((entry) => entry.type === 'document' || !pinnedSlugs.has(entry.slug));
    remaining -= result.budget_used;
  }

  const budgetUsed = budget - Math.max(0, remaining);
  const anyDropped = droppedPinned > 0 || droppedResults > 0 || droppedTimeline > 0;
  const unavailableTimelineOnly =
    results.length === 0 &&
    pinned.length === 0 &&
    recentTimeline.length > 0 &&
    recentTimeline.every(
      (entry) => entry.type === 'document_evidence' && entry.availability.status === 'unavailable',
    );

  return {
    status: unavailableTimelineOnly
      ? 'unavailable'
      : degraded.size > 0
        ? 'degraded'
        : results.length === 0 && pinned.length === 0 && recentTimeline.length === 0
          ? 'empty'
          : 'ok',
    profile: 'default',
    ...(!unavailableTimelineOnly && degraded.size > 0 ? { degraded: [...degraded] } : {}),
    ...(unavailableTimelineOnly
      ? { note: 'recent document date metadata remains, but no readable source copy is available' }
      : {}),
    pinned,
    results,
    timeline: recentTimeline,
    ...(structure ? { structure } : {}),
    searched,
    ...(memoryView ? { memory_view: memoryView } : {}),
    ...(coverage ? { coverage } : {}),
    ...(qualification ? { qualification } : {}),
    budget_used: budgetUsed,
    // Default to visible. A silent trim reads as "that's everything".
    ...(anyDropped
      ? { dropped: { pinned: droppedPinned, results: droppedResults, timeline: droppedTimeline } }
      : {}),
  };
}

export const AUTO_RECALL_POLICY_VERSION = 'auto-recall-v1';
export const AUTO_RECALL_SEMANTIC_THRESHOLD = 0.9;
// Auto-injection needs a substantially stronger boundary than explicit recall. On the invented development
// corpus, calibrated native scores for topical-but-non-answering pages reached 0.9728 while direct support
// reached 0.9999. Freezing 0.99 keeps that measured separation; the held-out gate checks it independently.
export const AUTO_RECALL_NATIVE_QUALIFICATION_THRESHOLD = 0.99;
const AUTO_RECALL_DUAL_ARM_THRESHOLD = 0.85;
const AUTO_RECALL_DEFAULT_BUDGET = 1200;
const AUTO_RECALL_CANDIDATE_LIMIT = 8;
const AUTO_RECALL_CANDIDATE_BUDGET = 6000;
const AUTO_RECALL_MAX_RESULTS = 3;

/**
 * Precision-first evidence for a host turn. Unlike broad context, this profile never adds
 * ambient structure, timeline entries, pins, or generated prose. It first performs cheap
 * retrieval without reranking. Strong deterministic evidence can be returned immediately;
 * only a plausible ambiguous boundary pays for model qualification.
 */
async function autoRecallContext(
  ctx: AknoContext,
  input: ParsedContextInput & { profile: 'auto_recall'; query: string },
): Promise<ContextOutput> {
  const budget = input.budget ?? AUTO_RECALL_DEFAULT_BUDGET;
  const memoryView = input.memory_view ?? inferMemoryView(input.query, input.mode ?? 'lookup');
  const resolutionContext = referenceContext(input.query, input.conversation_context ?? []);
  const retrievalQuery = resolutionContext ? `${input.query}\n${resolutionContext}` : input.query;
  const recallInput = {
    query: retrievalQuery,
    mode: input.mode ?? ('lookup' as const),
    depth: 'lines' as const,
    limit: AUTO_RECALL_CANDIDATE_LIMIT,
    budget: AUTO_RECALL_CANDIDATE_BUDGET,
    expand: false,
    graph: false,
    memory_view: memoryView,
    ...(input.include ? { include: input.include } : {}),
    ...(input.filter ? { filter: input.filter } : {}),
  };

  const initial = await recall(ctx, { ...recallInput, rerank: false });
  if (initial.status === 'unavailable') {
    return emptyAutoRecall({
      status: 'unavailable',
      budget,
      searched: [input.query],
      candidates: 0,
      degraded: initial.degraded,
      note: initial.note ?? 'memory evidence could not be read',
      memoryView,
    });
  }

  const degraded = new Set(initial.degraded ?? []);
  const eligibleInitial = initial.results.flatMap((result) => {
    const eligible = temporallyEligibleResult(result, input.query, memoryView);
    return eligible ? [eligible] : [];
  });
  const signals = eligibleInitial.map((result) => activationSignal(result, input.query, resolutionContext));
  const mechanicalCompoundConflict = hasMechanicalCompoundConflict(signals, input.query);
  const complementary = complementaryCompoundSignals(signals, input.query);
  if (complementary.length > 0) {
    return assembledAutoRecall({
      budget,
      searched: [input.query],
      selected: complementary.map((signal) => signal.result),
      candidates: initial.results.length,
      degraded,
      activationBasis: 'exact',
      qualificationRun: false,
      memoryView,
    });
  }
  const strongSignals = signals
    .filter((signal) => signal.strong)
    .sort((left, right) => right.strength - left.strength);
  // An exact marker, identity plus supported attribute, or exact phrase is stronger than a nearby
  // semantic duplicate. Once one exists, adding semantic neighbours only increases disclosure.
  const deterministic = (
    strongSignals.some((signal) => signal.basis === 'exact')
      ? strongSignals.filter((signal) => signal.basis === 'exact')
      : strongSignals
  ).slice(0, AUTO_RECALL_MAX_RESULTS);
  const ambiguousSingularFact = asksForSingularFact(input.query) && deterministic.length > 1;

  const unresolvedMechanicalCompound = requestedMechanicalValueKinds(input.query).length > 1;

  if (deterministic.length > 0 && !ambiguousSingularFact && !unresolvedMechanicalCompound) {
    return assembledAutoRecall({
      budget,
      searched: [input.query],
      selected: deterministic.map((signal) => signal.result),
      candidates: initial.results.length,
      degraded,
      activationBasis: deterministic.some((signal) => signal.basis === 'exact') ? 'exact' : 'semantic',
      qualificationRun: false,
      memoryView,
    });
  }

  const plausible = signals.some((signal) => signal.plausible);
  if (!plausible) {
    return emptyAutoRecall({
      status: degraded.size > 0 ? 'degraded' : 'empty',
      budget,
      searched: [input.query],
      candidates: initial.results.length,
      degraded: [...degraded],
      note: 'no memory evidence was strong enough for automatic injection',
      memoryView,
    });
  }

  const qualified = await recall(ctx, { ...recallInput, rerank: true });
  for (const reason of qualified.degraded ?? []) degraded.add(reason);
  if (qualified.status === 'unavailable') {
    return emptyAutoRecall({
      status: 'unavailable',
      budget,
      searched: [input.query],
      candidates: initial.results.length,
      degraded: [...degraded],
      qualification: qualified.qualification,
      qualificationRun: true,
      note: qualified.note ?? 'memory evidence could not be read during qualification',
      memoryView,
    });
  }

  const qualificationApplied = qualified.qualification?.applied === true;
  const minimumRelevance =
    qualified.qualification?.model === 'llm' ? 2 / 3 : AUTO_RECALL_NATIVE_QUALIFICATION_THRESHOLD;
  const qualifiedSelection = qualificationApplied
    ? qualified.results
        .flatMap((result) => {
          const eligible = temporallyEligibleResult(result, input.query, memoryView);
          return eligible ? [eligible] : [];
        })
        .filter((result) => (result.relevance ?? 0) >= minimumRelevance)
        .slice(0, AUTO_RECALL_MAX_RESULTS)
    : [];
  const qualifiedComplementary = complementaryCompoundSignals(
    qualifiedSelection.map((result) => activationSignal(result, input.query, resolutionContext)),
    input.query,
  );
  const selected = unresolvedMechanicalCompound
    ? mechanicalCompoundConflict
      ? []
      : qualifiedComplementary.map((signal) => signal.result)
    : qualifiedSelection;
  const qualifiedReferenceAmbiguous = asksForSingularFact(input.query) && selected.length > 1;

  if (selected.length === 0 || qualifiedReferenceAmbiguous) {
    return emptyAutoRecall({
      status: degraded.size > 0 ? 'degraded' : 'empty',
      budget,
      searched: [input.query],
      candidates: initial.results.length,
      degraded: [...degraded],
      qualification: qualified.qualification,
      qualificationRun: true,
      note: qualifiedReferenceAmbiguous
        ? 'a singular fact remained ambiguous between multiple sources'
        : qualificationApplied
          ? 'qualification found no evidence strong enough for automatic injection'
          : 'automatic injection requires calibrated qualification for ambiguous evidence',
      memoryView,
    });
  }

  return assembledAutoRecall({
    budget,
    searched: [input.query],
    selected,
    candidates: initial.results.length,
    degraded,
    activationBasis: 'qualified',
    qualification: qualified.qualification,
    qualificationRun: true,
    memoryView,
  });
}

interface EmptyAutoRecallOptions {
  status: 'empty' | 'degraded' | 'unavailable';
  budget: number;
  searched: string[];
  candidates: number;
  degraded?: ContextOutput['degraded'];
  qualification?: RecallQualification;
  qualificationRun?: boolean;
  note: string;
  memoryView: MemoryView;
}

function emptyAutoRecall(options: EmptyAutoRecallOptions): ContextOutput {
  return {
    status: options.status,
    ...(options.status === 'degraded' && options.degraded?.length ? { degraded: options.degraded } : {}),
    note: options.note,
    profile: 'auto_recall',
    activation: {
      activated: false,
      basis: 'none',
      candidates: options.candidates,
      selected: 0,
      qualification_run: options.qualificationRun ?? false,
    },
    pinned: [],
    results: [],
    timeline: [],
    searched: options.searched,
    memory_view: options.memoryView,
    ...(options.qualification ? { qualification: options.qualification } : {}),
    budget_used: 0,
  };
}

interface AssembledAutoRecallOptions {
  budget: number;
  searched: string[];
  selected: RecallResult[];
  candidates: number;
  degraded: Set<NonNullable<ContextOutput['degraded']>[number]>;
  activationBasis: 'exact' | 'semantic' | 'qualified';
  qualification?: RecallQualification;
  qualificationRun: boolean;
  memoryView: MemoryView;
}

function assembledAutoRecall(options: AssembledAutoRecallOptions): ContextOutput {
  const fitted = fitAutoRecallResults(options.selected, options.budget);
  const reasons = [...options.degraded];
  const activated = fitted.results.length > 0;
  const dropped = options.selected.length - fitted.results.length;

  return {
    status: reasons.length > 0 ? 'degraded' : activated ? 'ok' : 'empty',
    ...(reasons.length > 0 ? { degraded: reasons } : {}),
    ...(!activated ? { note: 'relevant evidence could not fit the requested context budget' } : {}),
    profile: 'auto_recall',
    activation: {
      activated,
      basis: activated ? options.activationBasis : 'none',
      candidates: options.candidates,
      selected: fitted.results.length,
      qualification_run: options.qualificationRun,
    },
    pinned: [],
    results: fitted.results,
    timeline: [],
    searched: options.searched,
    memory_view: options.memoryView,
    ...(options.qualification ? { qualification: options.qualification } : {}),
    budget_used: fitted.budgetUsed,
    ...(dropped > 0 ? { dropped: { pinned: 0, results: dropped, timeline: 0 } } : {}),
  };
}

interface ActivationSignal {
  result: RecallResult;
  basis: 'exact' | 'semantic';
  strength: number;
  strong: boolean;
  plausible: boolean;
}

type MechanicalValueKind = 'money' | 'date' | 'duration';

/**
 * A compound answer may legitimately live on separate pages. Admit that set without lowering the global
 * qualifier threshold only when the decision is mechanical: every requested value class has exactly one
 * source, every source states an explicit value, and every source contains the same non-field subject tokens.
 * Two candidates for one field are a conflict and therefore produce no deterministic set.
 */
function complementaryCompoundSignals(signals: ActivationSignal[], query: string): ActivationSignal[] {
  const kinds = requestedMechanicalValueKinds(query);
  if (kinds.length < 2) return [];
  const eligible = mechanicalCompoundCandidates(signals, query);
  const selected: ActivationSignal[] = [];
  for (const kind of kinds) {
    const matches = eligible.filter((signal) =>
      evidenceSupportsMechanicalKind(evidenceText(signal.result), kind),
    );
    if (matches.length !== 1) return [];
    selected.push(matches[0]!);
  }
  return [...new Map(selected.map((signal) => [resultIdentity(signal.result), signal])).values()].slice(
    0,
    AUTO_RECALL_MAX_RESULTS,
  );
}

function hasMechanicalCompoundConflict(signals: ActivationSignal[], query: string): boolean {
  const kinds = requestedMechanicalValueKinds(query);
  if (kinds.length < 2) return false;
  const eligible = mechanicalCompoundCandidates(signals, query);
  return kinds.some(
    (kind) =>
      eligible.filter((signal) => evidenceSupportsMechanicalKind(evidenceText(signal.result), kind)).length >
      1,
  );
}

function mechanicalCompoundCandidates(signals: ActivationSignal[], query: string): ActivationSignal[] {
  const subjectTokens = meaningfulTokens(query).filter((token) => !COMPOUND_FIELD_TOKENS.has(token));
  if (subjectTokens.length === 0) return [];
  return signals.filter(
    (signal) => signal.plausible && overlapRatio(subjectTokens, evidenceText(signal.result)) === 1,
  );
}

function activationSignal(
  result: RecallResult,
  query: string,
  resolutionContext: string | null,
): ActivationSignal {
  const evidence = evidenceText(result);
  const queryTokens = meaningfulTokens(query);
  const contextTokens = meaningfulTokens(resolutionContext ?? '');
  const overlap = overlapRatio(queryTokens, evidence);
  const contextOverlap = overlapRatio(contextTokens, evidence);
  const identities =
    result.type === 'page'
      ? [result.title, result.slug.split('/').at(-1)?.replaceAll('-', ' ') ?? '']
      : [
          result.label,
          result.path
            .split('/')
            .at(-1)
            ?.replace(/\.[^.]+$/, '')
            .replaceAll('-', ' ') ?? '',
        ];
  const promptHaystack = normalize(`${query} ${resolutionContext ?? ''}`);
  const matchedIdentityTokens = identities.flatMap((identity) => {
    const normalized = normalize(identity);
    const tokens = meaningfulTokens(identity);
    return tokens.length >= 2 && promptHaystack.includes(normalized) ? [tokens] : [];
  });
  const identityResidual = matchedIdentityTokens
    .map((identityTokens) => queryTokens.filter((token) => !identityTokens.includes(token)))
    .sort((left, right) => left.length - right.length)[0];
  const identityRelationSupported =
    identityResidual !== undefined &&
    (identityResidual.length === 0 || overlapRatio(identityResidual, evidence) === 1);
  const exactEvidence = queryTokens.length >= 2 && overlap === 1;
  const resolvedIdentity =
    Boolean(resolutionContext) &&
    identities.some((identity) => {
      const normalized = normalize(identity);
      return (
        meaningfulTokens(identity).length >= 2 && normalize(resolutionContext ?? '').includes(normalized)
      );
    });
  const semantic = result.relevance ?? 0;
  // A topical page can repeat the requested field without containing its value: “the price record was
  // reviewed” is not the price. Mechanical numeric and duration questions therefore need an explicit value
  // before lexical overlap may bypass qualification. The qualifier handles less mechanical attribute/value
  // boundaries.
  const requestedValueMissing =
    (asksForNumericValue(query) && !containsExplicitNumericValue(evidence)) ||
    (asksForDurationValue(query) && !containsExplicitDurationValue(evidence));
  const semanticRelationSupported = identityResidual === undefined || identityRelationSupported;
  const strongSemantic =
    !requestedValueMissing &&
    semantic >= AUTO_RECALL_SEMANTIC_THRESHOLD &&
    overlap >= 0.5 &&
    semanticRelationSupported;
  const dualArmSemantic =
    !requestedValueMissing &&
    semantic >= AUTO_RECALL_DUAL_ARM_THRESHOLD &&
    overlap >= 0.5 &&
    semanticRelationSupported &&
    result.matched_by?.includes('lexical') === true &&
    result.matched_by.includes('vector');
  const exact =
    !requestedValueMissing &&
    (identityRelationSupported || exactEvidence || (resolvedIdentity && overlap > 0));
  const strong = exact || strongSemantic || dualArmSemantic;
  const plausible = strong || overlap > 0 || contextOverlap > 0 || semantic >= 0.45;
  return {
    result,
    basis: exact ? 'exact' : 'semantic',
    strength: exact ? 2 + Math.max(overlap, contextOverlap) : semantic + overlap,
    strong,
    plausible,
  };
}

/** The recent turns are not a second query. They are admitted only when the current prompt has a local
 * reference to resolve, and even then only the last 1,000 characters are allowed into retrieval. */
function referenceContext(
  query: string,
  turns: NonNullable<ParsedContextInput['conversation_context']>,
): string | null {
  if (turns.length === 0 || !hasLocalReference(query)) return null;
  const recent = turns
    .slice(-2)
    .map((turn) => turn.content.trim())
    .filter(Boolean)
    .join('\n');
  if (!recent) return null;
  return recent.slice(-1000);
}

function hasLocalReference(query: string): boolean {
  return (
    /\b(it|its|that|this|they|them|those|these|one|other|former|latter|same)\b/i.test(query) ||
    /\b(what|how) about\b/i.test(query)
  );
}

function hasSingularReference(query: string): boolean {
  return /\b(it|its|that|this|one|other|former|latter|same)\b/i.test(query);
}

function asksForSingularFact(query: string): boolean {
  if (/\b(and|both|compare|list)\b/i.test(query) || /\bwhat are\b/i.test(query)) return false;
  return (
    hasSingularReference(query) ||
    /\bwhat (?:is|was)\b/i.test(query) ||
    /\bwhen (?:does|did|is|was)\b/i.test(query) ||
    /\bhow (?:long|often|much|many)\b/i.test(query) ||
    /\bdoes\b/i.test(query)
  );
}

function asksForNumericValue(query: string): boolean {
  return /\b(price|cost|fee|amount|total|balance|rate)\b/i.test(query);
}

function asksForDurationValue(query: string): boolean {
  return /\bhow (?:long|often)\b/i.test(query);
}

function containsExplicitNumericValue(evidence: string): boolean {
  return /(?:[$€£¥]\s*\d|\b\d+(?:[.,]\d+)?\s*(?:eur|usd|gbp|jpy|%|percent)\b)/i.test(evidence);
}

function containsExplicitDurationValue(evidence: string): boolean {
  return /\b(?:(?:\d+(?:[.,]\d+)?)|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[ -](?:minute|hour|day|week|month|year)s?\b|\b(?:hourly|daily|weekly|monthly|quarterly|annually|yearly|twice a year)\b/i.test(
    evidence,
  );
}

const COMPOUND_FIELD_TOKENS = new Set([
  'amount',
  'balance',
  'cost',
  'date',
  'deadline',
  'due',
  'duration',
  'fee',
  'interval',
  'next',
  'price',
  'rate',
  'renewal',
  'total',
]);

function requestedMechanicalValueKinds(query: string): MechanicalValueKind[] {
  const kinds: MechanicalValueKind[] = [];
  if (/\b(price|cost|fee|amount|total|balance)\b/i.test(query)) kinds.push('money');
  if (/\b(date|deadline)\b/i.test(query)) kinds.push('date');
  if (/\b(duration|interval|cadence)\b/i.test(query) || /\bhow (?:long|often)\b/i.test(query))
    kinds.push('duration');
  return kinds;
}

function evidenceSupportsMechanicalKind(evidence: string, kind: MechanicalValueKind): boolean {
  if (kind === 'money') return containsExplicitNumericValue(evidence);
  if (kind === 'duration') return containsExplicitDurationValue(evidence);
  return containsExplicitDateValue(evidence);
}

function containsExplicitDateValue(evidence: string): boolean {
  return /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4}|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})\b/i.test(
    evidence,
  );
}

function resultIdentity(result: RecallResult): string {
  return result.type === 'page' ? `page:${result.slug}` : `document:${result.id}`;
}

function temporallyEligibleResult(
  result: RecallResult,
  query: string,
  memoryView: MemoryView,
): RecallResult | null {
  if (result.type !== 'page') return result;
  const intent = temporalQueryIntent(query);
  if (intent.current && result.superseded) return null;

  const lines = result.lines.filter((line) => {
    const memory = line.memory;
    if (!memory) return !intent.current || ordinaryCurrentEligible(line.text);
    if (memory.status !== 'qualified') return false;
    if (memoryView !== 'factual') return qualificationEligibleForView(memory, memoryView);
    if (intent.history) return historicalMemoryEligible(memory, intent.sourceReport);
    if (intent.future) return futureMemoryEligible(memory) || canonicalMemoryEligibleNow(memory);
    if (intent.current) return memory.current_eligible;
    return canonicalMemoryEligibleNow(memory);
  });
  const hasDocumentEvidence = result.documents?.some((document) => Boolean(document.quote?.trim())) === true;
  return lines.length > 0 || hasDocumentEvidence ? { ...result, lines } : null;
}

function ordinaryCurrentEligible(text: string): boolean {
  const stale = /(?:^|\s)(?:the\s+)?(?:old|former|archived|superseded)\s+/im.test(text);
  const fresh = /(?:^|\s)(?:the\s+)?(?:current|active|latest)\s+/im.test(text);
  return !stale || fresh;
}

const AUTO_RECALL_STOPWORDS = new Set([
  'about',
  'again',
  'also',
  'and',
  'are',
  'can',
  'could',
  'does',
  'for',
  'from',
  'have',
  'how',
  'into',
  'its',
  'long',
  'many',
  'memory',
  'much',
  'often',
  'under',
  'please',
  'remember',
  'tell',
  'that',
  'the',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'those',
  'was',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'would',
  'you',
]);

function meaningfulTokens(text: string): string[] {
  return [
    ...new Set(
      normalize(text)
        .split(' ')
        .filter((token) => token.length > 2 && !AUTO_RECALL_STOPWORDS.has(token))
        .map(autoRecallRoot),
    ),
  ];
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function overlapRatio(tokens: string[], evidence: string): number {
  if (tokens.length === 0) return 0;
  const haystack = new Set(normalize(evidence).split(' ').map(autoRecallRoot));
  return tokens.filter((token) => haystack.has(token)).length / tokens.length;
}

function autoRecallRoot(token: string): string {
  if (token.length > 5 && token.endsWith('ies')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function evidenceText(result: RecallResult): string {
  if (result.type === 'document') return `${result.path} ${result.label} ${result.quote ?? ''}`;
  return `${result.slug} ${result.title} ${result.breadcrumb ?? ''} ${result.lines.map((line) => line.text).join(' ')}`;
}

function fitAutoRecallResults(
  selected: RecallResult[],
  budget: number,
): { results: RecallResult[]; budgetUsed: number } {
  const results: RecallResult[] = [];
  let budgetUsed = 0;
  for (const raw of selected) {
    const remaining = budget - budgetUsed;
    if (remaining <= 0) break;
    const result = fitAutoRecallResult(sanitizeAutoRecallResult(raw), remaining);
    if (!result) continue;
    const cost = estimateTokens(result);
    if (cost > remaining) continue;
    results.push(result);
    budgetUsed += cost;
  }
  return { results, budgetUsed };
}

/** Clip only at exact line/quote boundaries. Auto-recall never asks a model to summarize evidence to fit. */
function fitAutoRecallResult(result: RecallResult, budget: number): RecallResult | null {
  if (estimateTokens(result) <= budget && hasExactEvidence(result)) return result;
  if (result.type === 'document') {
    const lines = result.quote?.split('\n') ?? [];
    let fitted: Extract<RecallResult, { type: 'document' }> | null = null;
    for (const line of lines) {
      const quote: string = fitted ? `${fitted.quote ?? ''}\n${line}`.trim() : line;
      const candidate: Extract<RecallResult, { type: 'document' }> = { ...result, quote };
      if (estimateTokens(candidate) > budget) break;
      fitted = candidate;
    }
    return fitted;
  }

  let fittedLines: typeof result.lines = [];
  let fittedDocuments: NonNullable<typeof result.documents> = [];
  let fitted: RecallResult | null = null;
  for (const line of result.lines) {
    const candidate = { ...result, lines: fittedLines.concat(line), documents: fittedDocuments };
    if (estimateTokens(candidate) > budget) break;
    fittedLines = candidate.lines;
    fitted = candidate;
  }
  for (const document of result.documents ?? []) {
    if (!document.quote) continue;
    const quoteLines = document.quote.split('\n');
    let clipped = { ...document, quote: '' };
    for (const line of quoteLines) {
      const candidateDocument = { ...clipped, quote: `${clipped.quote}\n${line}`.trim() };
      const candidate = {
        ...result,
        lines: fittedLines,
        documents: fittedDocuments.concat(candidateDocument),
      };
      if (estimateTokens(candidate) > budget) break;
      clipped = candidateDocument;
      fitted = candidate;
    }
    if (clipped.quote) fittedDocuments = fittedDocuments.concat(clipped);
  }
  return fitted;
}

function sanitizeAutoRecallResult(result: RecallResult): RecallResult {
  if (result.type === 'document') {
    const { summary: _summary, graph_paths: _graphPaths, suggested_actions: _actions, ...exact } = result;
    return exact;
  }
  const {
    links: _links,
    summary: _summary,
    superseded: _superseded,
    graph_paths: _graphPaths,
    documents,
    ...exact
  } = result;
  return {
    ...exact,
    summary: null,
    ...(documents?.some((document) => document.quote)
      ? {
          documents: documents
            .filter((document) => document.quote)
            .map(({ summary: _documentSummary, ...document }) => document),
        }
      : {}),
  };
}

function hasExactEvidence(result: RecallResult): boolean {
  return result.type === 'document'
    ? Boolean(result.quote?.trim())
    : result.lines.length > 0 ||
        result.documents?.some((document) => Boolean(document.quote?.trim())) === true;
}

/** A pinned page is delivered in the same card shape as a recalled one, so the
 *  host has one thing to render and the model one thing to read. */
function cardFromPage(page: NonNullable<Awaited<ReturnType<typeof read>>['page']>): Card {
  return {
    slug: page.slug,
    title: page.title,
    role: page.role,
    summary: page.summary,
    score: 1,
    lines: page.lines.filter(
      (line) =>
        line.text.trim().length > 0 &&
        !/^\s*<!--/.test(line.text) &&
        line.observation?.status !== 'ineligible',
    ),
    ...(page.superseded ? { superseded: page.superseded } : {}),
    ...(page.links.length > 0 ? { links: page.links } : {}),
    ...(page.documents ? { documents: page.documents } : {}),
    ...(page.updated ? { updated: page.updated } : {}),
  };
}
