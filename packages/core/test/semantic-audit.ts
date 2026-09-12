/** Shared invented verifier response fields; individual tests control each semantic verdict. */
export function frameAuditFields(candidate: { frame_spans?: readonly { frame_id: string }[] }) {
  return candidate.frame_spans
    ? {
        span_audit: candidate.frame_spans.map(({ frame_id }) => ({
          frame_id,
          interpretation: 'This invented frame contributes the inspection statement or its qualification.',
          relationship: 'independent' as const,
        })),
      }
    : {};
}

export function semanticAudit(proposition = true, action = true, qualification = true) {
  return {
    comparison: {
      source_meaning: 'The invented source describes a qualified inspection statement.',
      candidate_meaning: 'The candidate describes the same inspection statement unless this test changes it.',
      action_arguments: 'Compare the stated inspector, device and inspection purpose.',
      qualification_scope: 'Compare the recorded speaker, uncertainty and temporal scope.',
    },
    mismatches: (
      [
        ['proposition_supported', proposition],
        ['action_arguments_preserved', action],
        ['qualification_scope_preserved', qualification],
      ] as const
    ).flatMap(([dimension, supported]) =>
      supported
        ? []
        : [
            {
              dimension,
              kind: 'unsupported_content' as const,
              detail: 'The test candidate changes the corresponding source-supported inspection constraint.',
            },
          ],
    ),
  };
}

/** Invented retention-only verdict fields. Tests choose semantics; witness ownership is explicit. */
export function retentionAudit(
  candidate: { polarity: string; text?: string; discourse_frame?: readonly { quote: string }[] },
  proposition = true,
  action = true,
  qualification = true,
  sourcePolarity = candidate.polarity,
) {
  const audit = semanticAudit(proposition, action, qualification);
  return {
    comparison: audit.comparison,
    mismatches: audit.mismatches.map((mismatch) => ({
      ...mismatch,
      detail: 'The invented test changes this selected source constraint.',
      source: null,
      candidate: candidate.text
        ? { kind: 'text' as const, exact_excerpt: candidate.text.slice(0, 80) }
        : { kind: 'metadata' as const, metadata_id: 'kind' },
    })),
    polarity_evidence:
      sourcePolarity === candidate.polarity
        ? null
        : {
            source: { frame_id: 'F1', exact_excerpt: candidate.discourse_frame![0]!.quote.slice(0, 80) },
            candidate_metadata_id: 'polarity',
          },
  };
}
