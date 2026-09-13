import { z } from 'zod';
import type { RetainCandidate } from './retain.ts';

const excerpt = z
  .string()
  .min(1)
  .max(80)
  .refine((text) => /[\p{L}\p{N}]/u.test(text));

/** A missing lexical match asks for source comparison, not a rewrite of possibly faithful prose. */
export function retentionReportLimits(candidate: Pick<RetainCandidate, 'text' | 'discourse_frame'>) {
  const frames = candidate.discourse_frame.map((span, index) => ({
    frame_id: `F${index + 1}`,
    quote: span.quote,
  }));
  const source = z.strictObject({
    frame_id: z.enum(frames.map((frame) => frame.frame_id) as [string, ...string[]]),
    exact_excerpt: excerpt,
  });
  const current = z.strictObject({ exact_excerpt: excerpt });
  const schema = z.union([
    z.strictObject({ relation: z.enum(['preserved']), source, candidate: current }),
    z.strictObject({ relation: z.enum(['omitted']), source, candidate: z.null() }),
    z.strictObject({ relation: z.enum(['changed']), source, candidate: current }),
  ]);
  return {
    schema,
    coordinates: { kind: 'readable_report_uncertainty', frame_ids: frames.map((frame) => frame.frame_id) },
    consistent(
      value: unknown,
      verdict: {
        qualification_scope_preserved: boolean;
        mismatches: readonly {
          dimension: string;
          kind: string;
          source: { frame_id: string; exact_excerpt: string } | null;
          candidate: { kind: string; exact_excerpt?: string } | null;
        }[];
      },
    ): boolean {
      const parsed = schema.safeParse(value);
      if (!parsed.success) return false;
      const alignment = parsed.data;
      if (
        !frames.some(
          (frame) =>
            frame.frame_id === alignment.source.frame_id &&
            frame.quote.includes(alignment.source.exact_excerpt),
        )
      )
        return false;
      if (alignment.candidate && !candidate.text.includes(alignment.candidate.exact_excerpt)) return false;
      if (alignment.relation === 'preserved') return true;
      const mismatchKind = alignment.relation === 'omitted' ? 'omitted_scope' : 'changed_qualification';
      return (
        !verdict.qualification_scope_preserved &&
        verdict.mismatches.some(
          (mismatch) =>
            mismatch.dimension === 'qualification_scope_preserved' &&
            mismatch.kind === mismatchKind &&
            mismatch.source?.frame_id === alignment.source.frame_id &&
            mismatch.source.exact_excerpt === alignment.source.exact_excerpt &&
            (alignment.candidate === null
              ? mismatch.candidate === null
              : mismatch.candidate?.kind === 'text' &&
                mismatch.candidate.exact_excerpt === alignment.candidate.exact_excerpt),
        )
      );
    },
    preserved(value: unknown): boolean {
      const parsed = schema.safeParse(value);
      return parsed.success && parsed.data.relation === 'preserved';
    },
  };
}

export const RETENTION_REPORT_LIMITS_CONTRACT = `A report_limit_concern means a finite wording recognizer
could not establish whether the current readable record preserves the source's personal epistemic limits.
It is uncertainty to resolve from the complete source, not evidence that the candidate is wrong and not
permission to rewrite it. Only that candidate requires report_limit_alignment. Source frame IDs reuse its
own negative_evidence_coordinates; related candidates and your audit summaries are never evidence.

Compare EVERY material limit on reading, receiving evidence, confirmation and personal verification,
including its actor, predicate, object and attachment. A generic report label or one preserved limit cannot
replace another. For preserved, point to contentful exact excerpts in an owned source frame and current
candidate.text expressing the corresponding limit, each within 80 UTF-16 units. All remaining limits still
require full-source comparison. Exact occurrence alone does not establish semantic correspondence.
For omitted, give the source witness and candidate:null. For changed, give both witnesses. These negative
branches require qualification_scope_preserved:false and an omitted_scope or changed_qualification mismatch
respectively, with the identical source witness and current text witness (or null). Other negative semantic
dimensions retain their separate required mismatches. A preserved alignment does not override any other
negative verdict, unsupported attribution, polarity, relation or temporal scope. Do not repair or retry.`;
