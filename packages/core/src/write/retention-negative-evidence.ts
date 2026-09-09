import { z } from 'zod';
import type { RetainCandidate } from './retain.ts';
import { semanticVerdictFields } from '../models/semantic-verdict.ts';

// Punctuation can be exact while witnessing none of the alleged semantic content.
const hasContent = /[\p{L}\p{N}]/u;
const exactText = z.string().min(1).max(80).regex(hasContent);

/** Negative decisions must name immutable bytes, never the verifier's own comparison paraphrase. */
export function retentionNegativeEvidence(candidate: RetainCandidate, hasRepairObligation: boolean) {
  // Only existing semantic inputs may support a metadata finding. IDs resolve to immutable values;
  // model-authored paraphrases, page routing and verifier summaries have no catalog entries.
  const metadata = [
    ['kind', candidate.kind],
    ['subject', candidate.subject],
    ['polarity', candidate.polarity],
    ['discourse.commitment', candidate.discourse.commitment],
    ['discourse.disposition', candidate.discourse.disposition],
    ['epistemic.basis', candidate.epistemic.basis],
    ['attribution.source_role', candidate.attribution.source_role],
    ['attribution.source_speaker', candidate.attribution.source_speaker ?? null],
    ['attribution.chain', candidate.attribution.chain ?? []],
    ['time', candidate.time ?? null],
    ['relations', candidate.relations ?? []],
  ]
    .filter(
      ([, value]) =>
        value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0),
    )
    .map(([metadata_id, value]) => ({ metadata_id: metadata_id as string, value }));
  const frames = candidate.discourse_frame.map((span, index) => ({
    frame_id: `F${index + 1}`,
    quote: span.quote,
  }));
  const source = z.strictObject({
    frame_id: z.enum(frames.map(({ frame_id }) => frame_id) as [string, ...string[]]),
    exact_excerpt: exactText,
  });
  const current = z.union([
    z.strictObject({ kind: z.enum(['text']), exact_excerpt: exactText }),
    z.strictObject({
      kind: z.enum(['metadata']),
      metadata_id: z.enum(metadata.map(({ metadata_id }) => metadata_id) as [string, ...string[]]),
    }),
  ]);
  const common = {
    dimension: semanticVerdictFields.mismatches.element.shape.dimension,
    // Reallocate the former 240-unit detail: 80 source, 80 candidate, 80 explanation.
    // An absent side or catalog pointer never donates its unused allowance to another field.
    detail: z.string().trim().min(1).max(80),
  };
  const mismatches = z
    .array(
      z.union([
        z.strictObject({
          ...common,
          kind: z.enum(['unsupported_content']),
          source: z.null(),
          candidate: current,
        }),
        z.strictObject({ ...common, kind: z.enum(['omitted_scope']), source, candidate: z.null() }),
        z.strictObject({
          ...common,
          kind: z.enum([
            'changed_value',
            'changed_action_or_role',
            'changed_qualification',
            ...(hasRepairObligation ? ['changed_repair_proposition' as const] : []),
          ]),
          source,
          candidate: current,
        }),
      ]),
    )
    .max(3);
  const polarity_evidence = z
    .strictObject({ source, candidate_metadata_id: z.enum(['polarity']) })
    .nullable();
  return {
    fields: { mismatches, polarity_evidence },
    coordinates: {
      frames: frames.map(({ frame_id }, index) => ({ frame_id, discourse_frame_index: index })),
      metadata,
    },
    consistent(verdict: {
      source_selected_polarity: string;
      mismatches: z.infer<typeof mismatches>;
      polarity_evidence: z.infer<typeof polarity_evidence>;
    }): boolean {
      const sourcePresent = (witness: z.infer<typeof source>) =>
        hasContent.test(witness.exact_excerpt) &&
        frames.some(
          ({ frame_id, quote }) => frame_id === witness.frame_id && quote.includes(witness.exact_excerpt),
        );
      for (const mismatch of verdict.mismatches) {
        if (mismatch.source && !sourcePresent(mismatch.source)) return false;
        if (
          mismatch.candidate?.kind === 'text' &&
          (!hasContent.test(mismatch.candidate.exact_excerpt) ||
            !candidate.text.includes(mismatch.candidate.exact_excerpt))
        )
          return false;
      }
      return verdict.source_selected_polarity === candidate.polarity
        ? verdict.polarity_evidence === null
        : verdict.polarity_evidence !== null && sourcePresent(verdict.polarity_evidence.source);
    },
  };
}

export const RETENTION_NEGATIVE_EVIDENCE_CONTRACT = `Each negative retention finding requires immutable evidence.
negative_evidence_coordinates maps candidate-local F IDs to discourse_frame indices and closed metadata IDs
 to submitted values. Reuse these exact IDs; all related candidates and comparison/audit notes are not
this candidate's evidence. Absent or empty metadata is not added content and has no witness ID; use
omitted_scope with candidate:null for missing material. changed_repair_proposition is available only
for this candidate's actual original repair obligation. Source excerpts must be nonempty exact substrings of the named owned frame.
Candidate text witnesses must be nonempty exact substrings of candidate.text. Every source or candidate
excerpt must contain a Unicode letter or number; punctuation alone witnesses no content. A metadata witness uses
{kind:metadata, metadata_id} to point to that exact immutable catalog value; never paraphrase its value.
For unsupported_content use source:null and the alleged added candidate text/metadata witness. For
omitted_scope use the required source excerpt and candidate:null; absence cannot be quoted. Every changed_*
finding needs both source and current candidate witnesses. changed_repair_proposition requires original
SOURCE evidence, never the repair-original draft as authority. Keep each excerpt and explanation within
80 UTF-16 units, with no transfer between budgets. The previous 240-unit detail allowance is partitioned.
For source_selected_polarity equal to immutable candidate.polarity, return polarity_evidence:null. For a
disagreement, give polarity_evidence with the exact governing source predicate and candidate_metadata_id
polarity. This is independent of the three semantic booleans and never authorizes relabeling. A false
semantic dimension still requires exactly one mismatch; valid negatives remain final. An invented,
foreign, missing or inconsistent witness invalidates the entire response; it cannot be dropped to accept.
A word occurring only in your candidate_meaning or other audit prose is not in candidate.text. Inspect
immutable candidate bytes before claiming an addition. All-positive equal-polarity verdicts need empty
mismatches and null polarity_evidence; no extra positive evidence record is required.`;
