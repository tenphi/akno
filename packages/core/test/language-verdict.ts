interface LanguageFixtureInput {
  excerpts: string[];
  supplied_references?: { text: string }[];
  review_hints?: { hint_id: string; occurrences: { allowed_roles: string[] }[] }[];
}

/** Scripted semantics for integration stubs; production never accepts the old binary wire format. */
export function languageVerdictFixture(payload: LanguageFixtureInput, compliant: boolean) {
  const hint_roles = (payload.review_hints ?? []).map((hint) => ({
    hint_id: hint.hint_id,
    classification:
      hint.occurrences[0]?.allowed_roles.find((role) =>
        hint.occurrences.every((occurrence) => occurrence.allowed_roles.includes(role)),
      ) ?? (compliant ? 'target_or_neutral' : 'foreign_ordinary'),
  }));
  const negative = hint_roles.find(({ classification }) => classification === 'foreign_ordinary');
  const witness = payload.excerpts.flatMap((text, index) =>
    [...text.matchAll(/[\p{L}\p{N}]+/gu)]
      .filter(
        (word) =>
          !(payload.supplied_references ?? []).some(({ text: reference }) => {
            if (!reference) return false;
            for (
              let start = text.indexOf(reference);
              start !== -1;
              start = text.indexOf(reference, start + 1)
            )
              if (start <= word.index && start + reference.length >= word.index + word[0].length) return true;
            return false;
          }),
      )
      .map((word) => ({
        kind: 'range',
        excerpt_id: `e${index}`,
        start: word.index,
        end: word.index + word[0].length,
      })),
  )[0];
  return {
    hint_roles,
    prose_result: compliant
      ? { status: 'compliant', counterexample: null }
      : {
          status: 'noncompliant',
          counterexample: negative ? { kind: 'hint', hint_id: negative.hint_id } : witness,
        },
  };
}
