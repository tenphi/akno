/** Shared invented verifier response fields; individual tests control each semantic verdict. */
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
