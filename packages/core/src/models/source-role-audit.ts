import { z } from 'zod';

export const namedSourceRoleSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  role: z.literal('reporter'),
  excerpt: z.string().trim().min(1).max(240),
});

export interface SourceRoleBinding {
  id: string;
  predicate_id: string;
  source: z.infer<typeof namedSourceRoleSchema>;
}

export function exactSourceName(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const part = String.raw`[\p{L}\p{M}\p{N}_\p{Pd}]`;
  return new RegExp(
    String.raw`(?<!${part})(?<!${part}['’])${escaped}(?!${part})(?!['’](?!s(?!${part}))${part})`,
    'u',
  ).test(text);
}

type AnswerSpan = { anchor_id: string; text: string };

export function sourceRoleAuditSchema(bindings: readonly SourceRoleBinding[], answer: readonly AnswerSpan[]) {
  return z.strictObject({
    roles: z
      .array(
        z.strictObject({
          source_role_id: z.enum(bindings.map((binding) => binding.id) as [string, ...string[]]),
          candidate_anchors: z
            .array(z.enum(answer.map((span) => span.anchor_id) as [string, ...string[]]))
            .min(1)
            .max(4)
            .nullable(),
          candidate_role: z.enum(['actor', 'reporter', 'experiencer', 'record_subject']).nullable(),
          relation: z.enum(['preserved', 'omitted', 'changed', 'not_selected']),
        }),
      )
      .length(bindings.length),
  });
}

/** A positive semantic verdict cannot preserve a named role with an answer-absent name. */
export function sourceRolesSupported(
  value: unknown,
  bindings: readonly SourceRoleBinding[],
  answer: readonly AnswerSpan[],
  selectedPredicates: ReadonlySet<string>,
  completeRecord: boolean,
): boolean {
  const parsed = sourceRoleAuditSchema(bindings, answer).safeParse(value);
  if (
    !parsed.success ||
    new Set(parsed.data.roles.map((role) => role.source_role_id)).size !== bindings.length
  )
    return false;
  return parsed.data.roles.every((entry) => {
    const binding = bindings.find((role) => role.id === entry.source_role_id)!;
    if (entry.relation === 'not_selected')
      return (
        !completeRecord &&
        !selectedPredicates.has(binding.predicate_id) &&
        entry.candidate_anchors === null &&
        entry.candidate_role === null
      );
    const indexes =
      entry.candidate_anchors?.map((id) => answer.findIndex((span) => span.anchor_id === id)) ?? [];
    return (
      entry.relation === 'preserved' &&
      indexes.length > 0 &&
      indexes.every((index, offset) => offset === 0 || index === indexes[offset - 1]! + 1) &&
      entry.candidate_role === binding.source.role &&
      exactSourceName(indexes.map((index) => answer[index]!.text).join(''), binding.source.name)
    );
  });
}

export const SOURCE_ROLE_READING_CONTRACT = `For EACH selected predicate, also read named_roles from the source
alone. This additional reading binds only explicitly named REPORTERS of that predicate, including each
outer/inner reporting layer. Quote the exact source name and shortest exact excerpt establishing that
reporting relation. A reporter governs the reported predicate even when the embedded action's actor is
unspecified. Attach the reporter to that reported predicate, not only to a separate speaking predicate.
Reporting provenance does not prove the embedded claim in reality. No provenance metadata is supplied.
An assertion's author is not automatically a reporter; an explicitly named actor is not automatically a
reporter either. Do not turn a noun modifier, object, product, title, topic or sentence-initial capitalization
into a named source. Never infer a name for a pronoun or an unspecified reporter. Use an empty list when
that predicate has no explicitly named reporting source. Actors and other action arguments remain subject
to the separate full semantic audit. Set complete=false if the bounded reading cannot represent the
selected predicates AND their explicitly named reporting scope.`;

export const SOURCE_ROLE_AUDIT_CONTRACT = `When fixed_source_roles is supplied, compare these source-only named
roles in source_role_audit, exactly once per source_role_id. Read the candidate's ACTUAL wording. Preserved
requires candidate_anchors selecting the exact answer_segments containing that same source name.
Select one to four consecutive segments in their supplied order; do not recopy or normalize Markdown.
Read candidate_role from that actual text independently; it must match the source-established role. A name's mere presence cannot
preserve a reporter changed into a performer, or a performer changed into a reporter.
Citation metadata cannot supply an absent name or turn a bare assertion into an attributed report. A reporter
is separate from the embedded action's actor; neither can stand in for the other. Names keep exact spelling
across translation. Use omitted/changed for a missing/swapped role, even if the broad content is plausible.
For a complete retained record, every fixed role is selected. For a focused answer, not_selected is allowed
only when its governing predicate is also absent from predicate_time_audit; use candidate_anchors=null
and candidate_role=null. For omitted roles, use both null; for changed roles, select the actual candidate segments and role.
An answer describing a reported predicate must retain its reporter. These readings constrain verification;
they cannot authorize a name or proposition absent from the readable retained excerpts.`;
