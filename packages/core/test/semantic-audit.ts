/** Shared invented verifier response fields; individual tests control each semantic verdict. */
export function predicateTimeFixture(source: string, candidate: string) {
  // Mechanical tests supply their own changed comparisons when temporal meaning is under test.
  const part = (excerpt: string) => ({
    excerpt: excerpt.slice(0, 240).trim(),
    predicate: 'The invented selected predicate.',
    timing: null,
    status: 'The invented recorded status.',
    time_relation: 'unspecified',
  });
  return {
    comparisons: [{ source: part(source), candidate: part(candidate), relation: 'preserved' }],
    complete: true,
  };
}

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

/** Invented retention-only verdict fields. Ordinary fixtures echo submitted plan status;
 * disposition-mismatch tests override it with a source decision and an exact witness. */
export function retentionAudit(
  candidate: {
    polarity: string;
    kind?: string;
    discourse?: { disposition: string };
    text?: string;
    discourse_frame?: readonly { quote: string }[];
    attribution_concern?: { reporters: readonly { reporter_id: string; speaker: string }[] };
  },
  proposition = true,
  action = true,
  qualification = true,
  sourcePolarity = candidate.polarity,
) {
  const audit = semanticAudit(proposition, action, qualification);
  return {
    ...(candidate.attribution_concern
      ? {
          attribution_audit: candidate.attribution_concern.reporters.map((reporter) => {
            // Mechanical fixtures nominate an explicit source frame. Semantic/alias tests override it.
            const index =
              candidate.discourse_frame?.findIndex((frame) =>
                frame.quote.toLowerCase().includes(reporter.speaker.toLowerCase()),
              ) ?? -1;
            const anchor = { frame_id: `F${index + 1}` };
            return {
              reporter_id: reporter.reporter_id,
              relation: 'reports_selected_proposition' as const,
              source: anchor,
              name_origin: anchor,
              resolution: 'explicit' as const,
              candidate_relation: 'preserved' as const,
              explanation:
                'This invented mechanical fixture supplies the explicitly named reporting relation.',
            };
          }),
        }
      : {}),
    ...(candidate.kind === 'plan'
      ? {
          source_selected_plan_disposition: candidate.discourse?.disposition,
          plan_disposition_evidence: null,
        }
      : {}),
    retention: {
      durability: 'durable' as const,
      source_scope: 'entity' as const,
      candidate_scope: 'entity' as const,
    },
    knowledge_context: {
      source_use: 'lasting_knowledge' as const,
      standalone_context: 'self_contained' as const,
      references: [],
      references_complete: true,
      witness: { frame_id: 'F1' },
      explanation: 'This invented mechanical fixture represents lasting, independently readable knowledge.',
    },
    comparison: audit.comparison,
    predicate_time_audit: {
      comparisons: [
        {
          source: {
            frame_id: 'F1',
            predicate: 'The invented selected predicate.',
            timing: null,
            status: 'The invented recorded status.',
            time_relation: 'unspecified',
          },
          candidate: {
            predicate: 'The invented selected predicate.',
            timing: null,
            status: 'The invented recorded status.',
            time_relation: 'unspecified',
          },
          relation: 'preserved',
        },
      ],
      complete: true,
    },
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
