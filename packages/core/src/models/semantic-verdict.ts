import { z } from 'zod';
import type { ModelOutcome, ModelUsage } from './client.ts';

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
- candidate_meaning: the proposition the candidate actually states in that same context;
- action_arguments: compare action, actor, object, purpose and any material modifier attachment;
- qualification_scope: compare speaker layers, polarity, commitment, disposition, uncertainty and time.
These are audit notes, not new evidence. Use only the supplied source for source meaning, and the candidate
for candidate meaning. Do not compare a remembered hypothesis with an established real-world fact: compare
the hypothesis as a hypothesis. The same applies to questions, fictional examples and attributed reports.
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
