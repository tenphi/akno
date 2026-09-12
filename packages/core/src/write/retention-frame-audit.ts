import { z } from 'zod';
import type { RetainSourceSpan } from '@tenphi/akno-protocol';

/** Interpret every validated frame span before compressing it into one semantic comparison. */
export function retentionFrameAudit(frame: readonly RetainSourceSpan[]) {
  if (frame.length < 2) return null;
  const spans = frame.map((span, index) => ({
    frame_id: `F${index + 1}`,
    item_id: span.item_id ?? null,
    quote: span.quote,
  }));
  const ids = spans.map((span) => span.frame_id) as [string, ...string[]];
  const schema = z
    .array(
      z.object({
        frame_id: z.enum(ids),
        interpretation: z.string().trim().min(1).max(240),
        relationship: z.enum(['restatement', 'clarification', 'contrast', 'independent', 'unresolved']),
      }),
    )
    .length(spans.length)
    .refine((audit) => new Set(audit.map((span) => span.frame_id)).size === spans.length);
  return { spans, schema };
}

export const RETENTION_FRAME_AUDIT_CONTRACT = `When a candidate has frame_spans, interpret EVERY listed
source span in span_audit before writing the aggregate comparison. Return exactly one entry per frame_id;
IDs are local to that candidate. Do not echo or invent quote/item coordinates. Interpret each original
quote in the complete source context, never using the candidate translation as evidence for its meaning.
Keep the positive claim as well as any contrast, attribution or limit in that span's interpretation.
Use one compact, complete sentence, aiming below 180 characters within the 240-character maximum.
State the governing actor, polarity and qualification first; shorten wording instead of ending mid-word
or leaving a trailing conjunction. This private interpretation is an audit summary, never a substitute
for its exact original span. A detail absent from your summary is not thereby absent from the source or
candidate. Compare those original texts before declaring a mismatch, and give one mismatch for each
false semantic dimension rather than copying a negative boolean from a different dimension.
The relationship describes how that span contributes to the candidate proposition: restatement,
clarification, contrast, independent statement or unresolved meaning. Explain the actual contribution in
interpretation, including what a clarification clarifies. These labels are audit notes, not evidence or
acceptance decisions. A source's explicit relay/restatement can clarify the same speaker's reported
content across languages; mere bilingual adjacency cannot establish equivalence. Compare any claimed
conflict against ALL span interpretations rather than omitting a deciding clause from source_meaning.
For repaired candidates, interpret their current validated frame against the original source; the original
position's repair obligation remains a separate constraint, never evidence. All three semantic dimensions
and their mismatch rules remain required. An audit cannot override a negative verdict. Candidates without
frame_spans retain the ordinary comparison and do not require span_audit.`;
