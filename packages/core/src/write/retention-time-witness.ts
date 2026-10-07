import { z } from 'zod';
import { predicateTimeAuditSchema } from '../models/predicate-time-audit.ts';

const meaning = predicateTimeAuditSchema.shape.comparisons.element.shape.source.omit({ excerpt: true });

/** Select immutable evidence instead of asking the verifier to reconstruct a conjunction or quote. */
export function retentionTimeWitness(frames: readonly { quote: string }[], text: string) {
  const sourceFrames = frames.map((_, index) => ({
    frame_id: `F${index + 1}`,
    discourse_frame_index: index,
  }));
  const schema = z.strictObject({
    comparisons: z
      .array(
        z.strictObject({
          source: meaning.extend({
            frame_id: z.enum(sourceFrames.map((frame) => frame.frame_id) as [string, ...string[]]),
          }),
          // The enclosing verdict already selects the candidate. No generated excerpt can replace it.
          candidate: meaning,
          relation: z.enum(['preserved', 'changed', 'unsupported']),
        }),
      )
      .min(1)
      .max(12),
    complete: z.boolean(),
  });
  return {
    schema,
    coordinates: { source_frames: sourceFrames, candidate: 'original_readable_text' as const },
    grounded(value: unknown): boolean {
      const parsed = schema.safeParse(value);
      return (
        parsed.success &&
        parsed.data.comparisons.every((entry) => {
          const index = sourceFrames.find(
            (frame) => frame.frame_id === entry.source.frame_id,
          )!.discourse_frame_index;
          return (
            (entry.source.timing === null || frames[index]!.quote.includes(entry.source.timing)) &&
            (entry.candidate.timing === null || text.includes(entry.candidate.timing))
          );
        })
      );
    },
    supported(value: unknown): boolean {
      const parsed = schema.safeParse(value);
      return (
        parsed.success &&
        parsed.data.complete &&
        parsed.data.comparisons.every(
          (entry) =>
            entry.relation === 'preserved' &&
            entry.source.time_relation === entry.candidate.time_relation &&
            (entry.source.timing === null) === (entry.candidate.timing === null),
        )
      );
    },
  };
}

export const RETENTION_TIME_WITNESS_CONTRACT = `Before approving a candidate, fill predicate_time_audit.
Compare EACH selected material predicate separately, including undated actions and qualifications.
Read the complete original source independently before comparing the actual readable candidate.
temporal_coordinates.source_frames maps candidate-local frame_id to an immutable discourse_frame index.
For each source predicate select its owned frame_id. Interpret that exact original quote in its complete
source context; never generate, abbreviate, concatenate or translate a deciding excerpt. The candidate
side always reads this verdict's entire original candidate.text, never a reconstructed excerpt.
Audit its typed time/status too against the source. Correct readable prose cannot certify incorrect
metadata, and metadata cannot supply a source-absent predicate, date, status or qualification.
Name the selected predicate and its status in short phrases on each side. Copy its own exact timing
expression, or null when unstated or ambiguous. Each non-null timing must appear verbatim in the
selected source frame or original candidate text respectively. Do not change punctuation or spelling.
Reuse a frame for different predicates when it contains a conjunction or shared subject; still compare
every predicate separately. Selecting a frame is only an evidence coordinate, not a semantic verdict.
An adjacent predicate, date, another candidate or its metadata cannot establish the selected meaning.

A modifier inside a noun phrase qualifies that entity, not a neighboring action. A dated entity is
itself a selected predicate but does not date its associated action. An undated asserted completion
remains completed with timing=null; null does not mean nonoccurrence. Compare status even when both
timings are null. Pending, estimated, proposed, negated, disputed and reported scope must survive.
A source-current status must not become an unanchored earlier state merely because a reporting wrapper
uses past tense. Compare the status's own reference time, not just reporting-clause grammar.
A schedule or booking never proves performance, a pending debit never proves settlement, and a report
does not establish independent verification. Copying an assertion supplies no second event or evidence.
A shared subject, document, sentence or transaction cannot transfer a date between operations. Only
an explicit source assignment of the same date permits both operations to retain it. A processing
clock, title or source publication date supplies no missing event date. Equivalent calendar rendering
or resolution from a supplied source reference clock is allowed without moving its temporal attachment.

Use time_relation occurred for asserted performance, scheduled for a schedule, due for a deadline,
valid for an effective period and unspecified when no such relation is established. Keep this separate
from stated calendar timing. Use preserved only when the selected predicate, status, qualifications
and temporal attachment all survive; changed for altered or omitted scope and unsupported for an added
predicate or time. Broad positive semantic booleans cannot override changed, unsupported or incomplete
comparisons. Set complete=true only after comparing every selected material predicate and qualification;
if the bounded list cannot represent them all, use complete=false. Never repair or retry a refusal.`;
