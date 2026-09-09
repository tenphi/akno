import { z } from 'zod';
import type { ModelOutcome, ModelUsage } from './client.ts';
import type { ProvidedRetainCandidate } from '@tenphi/akno-protocol';

/** Definitions of submitted labels, never evidence that those labels fit the source. */
export function semanticRecordScope(record: {
  kind: ProvidedRetainCandidate['kind'];
  commitment: ProvidedRetainCandidate['discourse']['commitment'];
  disposition: ProvidedRetainCandidate['discourse']['disposition'];
}): string[] {
  const scope: string[] = [];
  if (record.kind === 'plan')
    scope.push(
      'Plan denotes a recorded course of action, including an offered action. It does not independently assert personal intent, acceptance, an actual booking or performance.',
    );
  if (record.commitment === 'hypothetical' || record.commitment === 'counterfactual')
    scope.push(
      'The commitment qualifies the embedded scenario content. Neutral attribution of that content to its source is not itself hypothetical or a separate performed action.',
    );
  if (record.commitment === 'tentative')
    scope.push(
      'Tentative qualifies the selected uncertain content. When the supplied source and candidate explicitly couple an asserted discussion or consideration act with competing preliminary or unsupported hypotheses, tentative qualifies those hypotheses, not whether that act occurred. The label does not establish the act or excuse changing its actor, predicate, alternatives, evidentiary limits or personal nonselection. Otherwise tentative qualifies the proposition normally.',
    );
  if (record.disposition === 'active')
    scope.push(
      'Active denotes current record validity. It neither asserts ongoing activity nor requires the answer to verbalize this internal label.',
    );
  return scope;
}

const dimensions = [
  'proposition_supported',
  'action_arguments_preserved',
  'qualification_scope_preserved',
] as const;

const comparisonText = z.string().trim().min(1).max(320);

/** Composition and verification must compare the same scoped unit when compressing source prose. */
export const PROPOSITION_SCOPE_CONTRACT = `Preserve these boundaries within each selected proposition:
- Each selected material epistemic limit keeps its grammatical subject or experiencer, exact predicate,
  object/referent and clause attachment. Reading terms, receiving confirmation of a report and personally
  verifying a contractual condition are distinct predicates; preserve separate limits separately.
  "I have not examined the terms or confirmed X"
  supports "the speaker has not examined the terms or confirmed X", not "the terms have not been
  examined" or "X has not been confirmed" without that actor. Naming the speaker as outer reporter does
  not bind a later passive absence to them. Preserve examination and confirmation as separate limits;
  merely calling X tentative/unverified cannot replace either limit. Apply this equally to assistant,
  user and external speakers; never infer global ignorance, document silence or universal nonverification.
- Personal negative actions keep their own actors. "She has not adopted the proposal as a plan or
  arranged a meeting" does not establish an anonymous unadopted plan or unarranged meeting. Compose
  adoption and arrangement with explicit personal subjects, including an unambiguous shared subject.
  A named proposer or reporter does not supply either actor; preserving one action's actor does not
  preserve the other. Compare each action separately, including within proposed/undated records.
- Keep separate epistemic predicates attached to their stated subjects. "Ada has no answer" describes
  her knowledge; "the note establishes neither inclusion nor exclusion" describes the note's content.
  When both are selected, compose separate clauses with both subjects explicit. Do not merge them into
  "Ada has no answer establishing either", swap their subjects, or claim the agreement terms establish
  neither. Neither personal uncertainty nor note-level inconclusiveness implies the other by itself.
  An explicit statement about what a record establishes keeps the record as its epistemic subject.
  Human source attribution may scope over that statement without repeating the name in every clause;
  this does not turn the record's nonresolution into a person's lack of knowledge. Still preserve each
  personal verification limit with its own actor and keep required report attribution in scope.
- A hypothetical premise and its explicitly stated conditional consequence form one scoped unit. Keep
  both when selecting that rule. A fictional promise keeps its promising party, recipient, benefit and
  material limits inside fictional scope. A proposal to discuss it alone does not answer what it promises.
  Do not infer that a complete source omits content merely because one retrieved excerpt lacks it.
- Neutral provenance may introduce a record without claiming personal writing or recording. If that
  action is unsupported, use neutral attribution; do not add "there is no evidence SOURCE recorded it".
  Unsupported affirmative and negative metaclaims are equally unsupported.
- Preserve real material acts separately from neutral framing: proposing an assumption is still a
  proposal by its actual actor, even when the embedded rule is hypothetical. A proposal to discuss is not
  completed discussion. Qualification must govern the affected clause, not appear only as a late disclaimer.`;

/** A comparison makes a verdict auditable; it never supplies evidence or overrides a failed check. */
export const semanticVerdictFields = {
  comparison: z.object({
    source_meaning: comparisonText,
    candidate_meaning: comparisonText,
    action_arguments: comparisonText,
    qualification_scope: comparisonText,
  }),
  mismatches: z
    .array(
      z.object({
        dimension: z.enum(dimensions),
        kind: z.enum([
          'unsupported_content',
          'changed_value',
          'changed_action_or_role',
          'changed_qualification',
          'omitted_scope',
          'changed_repair_proposition',
        ]),
        detail: z.string().trim().min(1).max(240),
      }),
    )
    .max(3),
  proposition_supported: z.boolean(),
  action_arguments_preserved: z.boolean(),
  qualification_scope_preserved: z.boolean(),
};

export const SEMANTIC_COMPARISON_CONTRACT = `Before deciding the three booleans, write a concise comparison:
- source_meaning: the proposition the supplied source actually establishes in its discourse context;
- candidate_meaning: the proposition the candidate actually states in that same context, retaining every
  added specification rather than silently replacing it with the source's more general wording;
- action_arguments: compare action, actor, object, purpose and any material modifier attachment. For a
  measurement or inspection, compare the named component separately from the property, method and result;
- qualification_scope: compare speaker layers, polarity, commitment, disposition, uncertainty and time,
  including the actor, predicate and object/referent of each selected material epistemic limit.
For coverage language, compare what is covered and what provides coverage. "Repair is covered by the
warranty" / "ремонт покрывается гарантией" does not mean "the motor is covered by repair" / "двигатель
покрывается ремонтом" or "the warranty is covered by repair". Preserve those roles inside unresolved
questions and negations too: retaining uncertainty does not excuse reversing the embedded relationship.
${PROPOSITION_SCOPE_CONTRACT}
For each negative epistemic clause, identify whose knowledge is lacking and what source or document the
clause describes. "Neither inclusion nor exclusion is established" in an open question does not entail
"neither is established by the agreement terms" / "условиями соглашения не установлены". The latter
adds a document-level claim that the terms fail to establish an answer. A surrounding open-question frame
does not remove that addition. Preserve a document's silence or inconclusiveness when the original source
explicitly establishes it; do not infer it from a speaker's uncertainty or lack of verification. A changed
epistemic subject or means of nonresolution fails proposition_supported and qualification_scope_preserved.
These are audit notes, not new evidence. Use only the supplied source for source meaning, and the candidate
for candidate meaning. Do not compare a remembered hypothesis with an established real-world fact: compare
the hypothesis as a hypothesis. The same applies to questions, fictional examples and attributed reports.
record_scope defines submitted metadata; it is not evidence that the metadata matches the original source.
Separate neutral source framing (according to, states, the recorded question, in the author's example)
from material embedded actions. Such framing does not independently claim a new speaking/writing event.
Do not demand identical framing verbs when the sourced content and its actors are preserved. Still reject
turning a proposed discussion into a completed discussion or changing an embedded action, its agent or object.
Track event identity before comparing agents. An explicitly named person who declined an offer thereby
rejected that same offered action; a later passive restatement that "the offered action was rejected"
can refer to that rejection without introducing another event or unknown rejector. Preserve a clear
same-event antecedent across adjacent sentences. This does not transfer the actor to an independent
action such as an unbooked collection, or to a different person's offer, action or rejection.
Check the actor of a negated choice independently from the actor of considering or reporting. A source
saying that a person has not selected a cause does not support an unassigned "neither selected" state;
merely naming that person elsewhere does not bind them to the embedded nonselection.
Likewise, compare who proposed an action separately from who reports the proposal. "According to SOURCE,
the proposal was to ..." and "По словам SOURCE, было предложено ..." provide outer attribution but no
proposer. If the source names the proposer, that omission fails action_arguments_preserved even when the
proposal's content and time remain faithful. Never infer that actor from source_speaker metadata alone.
Compare the source-established sense of the object in each epistemic clause. Lacking confirmation of a
reported contractual condition and lacking confirmation of a report about a physical state are different
limits, even if both retain the same actor and uncertainty. A changed epistemic object fails
proposition_supported and qualification_scope_preserved, and also action_arguments_preserved when it
changes an action's object. Keep the candidate's actual added specification in the comparison; do not
silently paraphrase it back to the source's meaning. Mere contract/state vocabulary elsewhere does not
establish this difference: preserve a source-supported physical state or status display in its own clause.
Use explicit clarification in the complete supplied context to resolve an earlier ambiguous term,
including when the source switches languages. Compare the actual referent selected by every candidate
clause with that clarified meaning. A dictionary sense available in isolation is unsupported when it
conflicts with the source's clarification. A later correct clause does not retract an earlier incompatible
component or claim. Do not infer alias equivalence from lexical similarity or outside knowledge; when no
supplied clarification resolves the ambiguity, preserve that ambiguity instead of selecting a new sense.
Compare semantic restrictions, not word counts. A generic complement such as parameters / параметры
in a measurement phrase does not identify a particular measured property and is not an unsupported
specialization merely because the source leaves that complement implicit. Before rejecting added
specificity, identify the concrete property, method, result, degree or other restriction actually selected
by the candidate. A named component alone cannot support a particular associated property from domain
knowledge; adding that property fails proposition_supported and action_arguments_preserved.
Preserve material restrictions in the other direction too. A specific faulty action, degree or manner
must not become a general defect: changing loose seating into general improper installation loses the
described mechanism even if the broader claim is logically entailed. A material lost action modifier fails
action_arguments_preserved; do not mislabel an entailed generalization as an unsupported added proposition.
Ordinary grammatical expansion without a new restriction is allowed, while a described mechanism cannot
be erased merely to produce a fluent summary. Unrelated adjacent details may still be omitted.
List a mismatch only when a concrete clause selects an unsupported meaning, changes a role or value,
or loses a material qualification. Its detail must name that clause and the conflicting or missing source
basis. Keep comparison fields below 320 characters and each mismatch detail below 240 characters.
Combine related defects into one mismatch per affected dimension; a false dimension requires exactly one
mismatch and a true dimension requires none. Repeat a shared defect under each affected dimension.
Preserved ambiguity is not a mismatch. Reject a selected unsupported reading or omitted material ambiguity;
do not invent an alternative reading to reject a faithful scoped claim or an explicitly supported narrower
claim. An uncertain source can fully support a faithful record of that uncertainty. All three booleans
remain independently required; comparison text and an empty mismatch list cannot override a false verdict.`;

export function semanticVerdictConsistent(verdict: {
  mismatches: { dimension: (typeof dimensions)[number] }[];
  proposition_supported: boolean;
  action_arguments_preserved: boolean;
  qualification_scope_preserved: boolean;
}): boolean {
  const mismatched = new Set(verdict.mismatches.map(({ dimension }) => dimension));
  return (
    mismatched.size === verdict.mismatches.length &&
    dimensions.every((dimension) => verdict[dimension] !== mismatched.has(dimension))
  );
}

/** Preserve missing telemetry as unknown when combining disjoint first-pass verification calls. */
export function aggregateSemanticOutcomes(outcomes: readonly ModelOutcome<string>[]): ModelOutcome<string> {
  if (outcomes.length === 1) return outcomes[0]!;
  const failure = outcomes.find((outcome) => !outcome.ok);
  const sum = (key: keyof ModelUsage) => {
    const values = outcomes.map((outcome) => outcome.usage?.[key]);
    return values.every((value) => typeof value === 'number')
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  return {
    ok: !failure,
    value: null,
    ...(failure?.reason ? { reason: failure.reason } : {}),
    ...(failure?.error ? { error: failure.error } : {}),
    latencyMs: outcomes.reduce((total, outcome) => total + outcome.latencyMs, 0),
    ...(outcomes.every((outcome) => typeof outcome.endpointRequests === 'number')
      ? { endpointRequests: outcomes.reduce((total, outcome) => total + outcome.endpointRequests!, 0) }
      : {}),
    usage: {
      inputTokens: sum('inputTokens'),
      outputTokens: sum('outputTokens'),
      totalTokens: sum('totalTokens'),
      cachedInputTokens: sum('cachedInputTokens'),
      reasoningOutputTokens: sum('reasoningOutputTokens'),
    },
  };
}
