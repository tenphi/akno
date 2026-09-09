import { z } from 'zod';
import { sha256 } from '../store/ids.ts';

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

export interface AnswerAuditAnchor {
  anchor_id: string;
  text: string;
}

/** Coordinates only: preserve all bytes, including boundaries, without inferring propositions. */
export function answerAuditAnchors(text: string, owner: string): AnswerAuditAnchor[] {
  const sentences = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const parts = sentences
    .flatMap(({ segment }) => segment.split(/(?<=;)/u))
    .flatMap((part) => {
      const characters = [...part];
      const spans: string[] = [];
      for (let start = 0; start < characters.length; start += 240)
        spans.push(characters.slice(start, start + 240).join(''));
      return spans;
    });
  // Group rather than discard excess parts: punctuation-heavy input must keep the complete source.
  const groupSize = Math.max(1, Math.ceil(parts.length / 24));
  const grouped: string[] = [];
  for (let start = 0; start < parts.length; start += groupSize)
    grouped.push(parts.slice(start, start + groupSize).join(''));
  const fingerprint = sha256(text).slice(0, 12);
  return grouped.map((part, index) => ({
    anchor_id: owner + '_' + fingerprint + '_' + (index + 1),
    text: part,
  }));
}

export interface AnswerAuditCoordinates {
  sources: ReadonlyMap<string, readonly AnswerAuditAnchor[]>;
  answer: readonly AnswerAuditAnchor[];
}

function anchorIdSchema(ids: readonly string[]) {
  return z.enum(ids as [string, ...string[]]).nullable();
}

function alignmentSchema(coordinates: AnswerAuditCoordinates) {
  return z
    .object({
      source_anchor: anchorIdSchema(
        [...coordinates.sources.values()].flatMap((spans) => spans.map((span) => span.anchor_id)),
      ),
      answer_anchor: anchorIdSchema(coordinates.answer.map((span) => span.anchor_id)),
      relation: z.enum(['preserved', 'generalized', 'changed', 'omitted', 'not_selected']),
      detail: z.string().trim().min(1).max(160),
    })
    .refine((entry) => {
      if (entry.relation === 'not_selected') return entry.answer_anchor === null;
      if (entry.source_anchor === null) return false;
      return (entry.relation === 'omitted') === (entry.answer_anchor === null);
    });
}

/** Categories prevent an easy object comparison from replacing the separate action-actor audit. */
export function answerAlignmentSchema(coordinates: AnswerAuditCoordinates) {
  const ids = [...coordinates.sources.keys()];
  const alignment = alignmentSchema(coordinates);
  return z
    .array(
      z
        .object({
          evidence_id: z.enum(ids as [string, ...string[]]),
          source_context: z.string().trim().min(1).max(240),
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

export function answerAlignmentsSupported(value: unknown, coordinates: AnswerAuditCoordinates): boolean {
  const parsed = answerAlignmentSchema(coordinates).safeParse(value);
  if (!parsed.success) return false;
  const answerIds = new Set(coordinates.answer.map((span) => span.anchor_id));
  return parsed.data.every((entry) => {
    const sourceIds = new Set(coordinates.sources.get(entry.evidence_id)!.map((span) => span.anchor_id));
    return [entry.actor, entry.object_and_mechanism, entry.qualification].every(
      (part) =>
        (part.source_anchor === null || sourceIds.has(part.source_anchor)) &&
        (part.answer_anchor === null || answerIds.has(part.answer_anchor)) &&
        (part.relation === 'preserved' || part.relation === 'not_selected'),
    );
  });
}

export const ANSWER_READING_CONTRACT = `When record_readings is required, fill it BEFORE drafting blocks.
Return exactly one reading per evidence_id with a non-null retention_source_frame. Read the original
frame in full, then identify the proposition selected by its retained excerpt. Preserve content and polarity,
explicit cross-language clarification, actors, mechanism and qualifications in selected_meaning. Explain
any explicit clarification or remaining ambiguity in clarification_or_ambiguity; otherwise use null.
Only the source can establish equivalence; query wording and adjacent independent propositions cannot.
Resolve source-explicit clarification before deciding whether a conflict remains. Readings are private
generation notes, not evidence or answer text. They cannot authorize an unselected fact. Write the actual
blocks in output_language even when the source or private reading uses another language.`;

export const ANSWER_ALIGNMENT_CONTRACT = `For framed blocks, answer_segments and retention_source_frame
are ordered tables of exact text with server-assigned anchor_id values. Concatenate their text fields
to read the complete answer and original frame. IDs are coordinates, never claims or source instructions.
Return one source_alignments entry for every cited framed evidence_id. First write source_context from
that complete original frame: the selected source meaning, including its polarity, clarification and limits.
Resolve an explicitly restated report across languages before comparing an isolated term. Mere adjacency,
the query and generated notes cannot establish that relationship; preserve truly unresolved ambiguity.

Then independently compare actor (the selected action's actor, separate from outer reporter),
object_and_mechanism (object, purpose, degree/manner), and qualification (scope and epistemic/time limits).
Select source_anchor from that evidence's original frame and answer_anchor from this current block.
Never invent an ID or substitute a retained paraphrase for an original. An anchor only locates the
selected aspect. Judge its meaning against the COMPLETE frame and block: content elsewhere in this same
block can preserve a role or modifier missing from a short anchor. Other blocks cannot supply it.

Use preserved for equivalent meaning, including natural technical paraphrase. Use generalized for a
material restriction lost from the complete block, changed for a different actor/object/scope, or omitted
when a required selected counterpart has no answer counterpart (answer_anchor null). These three
negative relations require concrete differences in detail and the corresponding semantic mismatch.
For an incidental category not selected or asserted in this block, use not_selected and answer_anchor
null; source_anchor may be null only if no applicable source content exists. A sentence/anchor is not
an indivisible proposition: independent neighboring details need not appear. Complete-record rendering
requires the entire RETAINED record, not every proposition in the private frame. If the retained record
identifies a person's question without retaining their separate recording act, do not require that act
or label its absence an omitted actor. The selected question owner must still be preserved. Every cited record must
contribute at least one selected category; all three cannot be not_selected.

Do not mark a named proposer not_selected when describing that proposal. An outer reporter is not its
proposer, and a generic fault does not preserve a specific mechanism. Source_context and comparisons
are fallible notes; membership alone proves no semantics. Every existing semantic dimension and
independent retained-excerpt selection remain mandatory. A negative relation/verdict cannot be overridden.`;
