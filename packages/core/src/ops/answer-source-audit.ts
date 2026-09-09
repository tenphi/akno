import { z } from 'zod';

const reading = z.object({
  selected_meaning: z.string().trim().min(1).max(320),
  clarification_or_ambiguity: z.string().trim().min(1).max(240).nullable(),
});

/** Force original interpretation before drafting, without reusing it as verification evidence. */
export function answerReadingSchema(ids: readonly string[]) {
  return z
    .array(z.object({ evidence_id: z.enum(ids as [string, ...string[]]), ...reading.shape }))
    .length(ids.length)
    .refine((entries) => new Set(entries.map((entry) => entry.evidence_id)).size === ids.length);
}

const alignment = z
  .object({
    source_quote: z.string().trim().min(1).max(240).nullable(),
    answer_quote: z.string().trim().min(1).max(240).nullable(),
    relation: z.enum(['preserved', 'generalized', 'changed', 'omitted', 'not_selected']),
    detail: z.string().trim().min(1).max(160),
  })
  .refine((entry) => {
    if (entry.relation === 'not_selected') return entry.answer_quote === null;
    if (entry.source_quote === null) return false;
    return (entry.relation === 'omitted') === (entry.answer_quote === null);
  });

/** Categories prevent an easy object comparison from replacing the separate action-actor audit. */
export function answerAlignmentSchema(ids: readonly string[]) {
  return z
    .array(
      z
        .object({
          evidence_id: z.enum(ids as [string, ...string[]]),
          actor: alignment,
          object_and_mechanism: alignment,
          qualification: alignment,
        })
        // Citing a record while declaring every category irrelevant supplies no comparison at all.
        .refine((entry) =>
          [entry.actor, entry.object_and_mechanism, entry.qualification].some(
            (part) => part.relation !== 'not_selected',
          ),
        ),
    )
    .length(ids.length)
    .refine((entries) => new Set(entries.map((entry) => entry.evidence_id)).size === ids.length);
}

export function answerAlignmentsSupported(
  value: unknown,
  frames: ReadonlyMap<string, string>,
  answer: string,
): boolean {
  const parsed = answerAlignmentSchema([...frames.keys()]).safeParse(value);
  if (!parsed.success) return false;
  return parsed.data.every((entry) => {
    const frame = frames.get(entry.evidence_id)!;
    return [entry.actor, entry.object_and_mechanism, entry.qualification].every(
      (part) =>
        (part.source_quote === null || frame.includes(part.source_quote)) &&
        (part.answer_quote === null || answer.includes(part.answer_quote)) &&
        (part.relation === 'preserved' || part.relation === 'not_selected'),
    );
  });
}

export const ANSWER_READING_CONTRACT = `When record_readings is required, fill it BEFORE drafting blocks.
Return exactly one reading per evidence_id with a non-null retention_source_frame. Read the original
frame in full, then identify the proposition selected by its retained excerpt. Preserve positive content,
explicit cross-language clarification, actors, mechanism and qualifications in selected_meaning. Explain
any explicit clarification or remaining ambiguity in clarification_or_ambiguity; otherwise use null.
Only the source can establish equivalence; query wording and adjacent independent propositions cannot.
Resolve source-explicit clarification before deciding whether a conflict remains. Readings are private
generation notes, not evidence or answer text. They cannot authorize an unselected fact. Write the actual
blocks in output_language even when the source or private reading uses another language.`;

export const ANSWER_ALIGNMENT_CONTRACT = `When source_alignments is required, return exactly one entry for
each cited evidence_id with a non-null retention_source_frame before the aggregate comparison/verdict.
Independently compare three categories: actor of the selected action (separate from outer reporter),
object_and_mechanism (object, purpose, degree/manner), and qualification (scope, contrast and epistemic or
temporal limits). Read ALL material counterparts in each category; the short quotes are exact locating
anchors, not an exhaustive semantic checklist. source_quote must be an exact substring of that record's
original frame and answer_quote an exact substring of this answer block. Never silently rewrite the
answer quote into a more faithful expression. Explain the comparison in detail using only those sources.
Use preserved for equivalent source meaning, including natural technical paraphrase. Use generalized
when the answer loses a material restriction, changed for a different actor/object/scope, or omitted
when a required source counterpart has no answer counterpart (answer_quote null). For a category or
adjacent detail not selected by the retained record and not asserted by the answer, use not_selected,
answer_quote null, and source_quote null only when that category has no applicable source content.
Do not mark a source-named proposer not_selected when the answer describes that proposal. Outer source
attribution cannot supply its missing action actor. Do not mark a specific mechanism preserved when the
answer only describes a generic fault. Incidental neighboring source details need not be answered.
Every cited record must contribute at least one selected category; all three cannot be not_selected.
These annotations are fallible comparison notes. A quote match cannot certify semantic preservation.
Every mismatch must still fail the corresponding existing semantic dimension, and all three dimensions
plus independent retained-excerpt selection remain required. No audit overrides a negative verdict.`;
