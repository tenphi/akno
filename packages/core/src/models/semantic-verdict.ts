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
- qualification_scope: compare speaker layers, polarity, commitment, disposition, uncertainty and time.
These are audit notes, not new evidence. Use only the supplied source for source meaning, and the candidate
for candidate meaning. Do not compare a remembered hypothesis with an established real-world fact: compare
the hypothesis as a hypothesis. The same applies to questions, fictional examples and attributed reports.
record_scope defines submitted metadata; it is not evidence that the metadata matches the original source.
Separate neutral source framing (according to, states, the recorded question, in the author's example)
from material embedded actions. Such framing does not independently claim a new speaking/writing event.
Do not demand identical framing verbs when the sourced content and its actors are preserved. Still reject
turning a proposed discussion into a completed discussion or changing an embedded action, its agent or object.
Check the actor of a negated choice independently from the actor of considering or reporting. A source
saying that a person has not selected a cause does not support an unassigned "neither selected" state;
merely naming that person elsewhere does not bind them to the embedded nonselection.
Use the governing domain to resolve a word's sense: a contractual condition is a term or requirement,
not the physical condition/state of a device. Fluency and preserved uncertainty do not excuse a changed sense.
Preserve the source's level of specificity. Naming a component to be measured does not establish which
property is measured, which method is used, or what result is expected. A plausible property associated
with that component is still unsupported unless the supplied source establishes it. An answer that adds
such a property fails proposition_supported and action_arguments_preserved even when the component and
general purpose remain recognizable. Generic wording such as measuring a component's parameters does
not select a particular parameter. Apply the same comparison to other added attributes, causes and means;
ordinary grammatical expansion without a new semantic restriction is not an added specification.
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
