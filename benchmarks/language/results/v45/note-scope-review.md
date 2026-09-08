# V45 `missing_concepts` public-note scope review

## Finding

`packages/core/src/ops/answer.ts` treats generation-time `missing_concepts` as trusted public prose. At the end of `answer()`, it combines the model array with uncovered recall concepts and interpolates the resulting strings verbatim into `AnswerOutput.note`:

- no rendered block: `memory evidence did not resolve: ${missing.join(', ')}`
- partial rendered answer: `memory evidence did not cover: ${missing.join(', ')}`

The schema constrains only array length and string length. Neither deterministic answer guards nor the source-versus-answer semantic verifier inspect these strings. The prompt says they should identify details missing from supplied evidence, but that instruction is not an authority boundary.

V45 demonstrates the gap. Two report answer calls emitted:

> В источнике не указана калибровка шкалы (dial calibration); указана только калибровка регулятора.

and

> В предоставленной записи говорится о калибровке регулятора, а не о калибровке циферблата.

The original bilingual source expressly supplies “dial calibration” and then clarifies that the intended component sense is Russian `регулятор`. These model strings incorrectly turn cross-language clarification into claims that the source lacks dial calibration. They are not part of `reviewAnswer`, so answer-text grading cannot catch them.

## Observable impact

`note` is part of the public `AnswerOutput` through the shared `ResultEnvelope` in `packages/protocol/src/common.ts`; an operation caller can display or reason from it. Thus an otherwise correct partial answer can carry an unverified and source-inaccurate public explanation. The benchmark output packet grades only answer text, while raw model traces retain `missing_concepts`; that evaluation boundary leaves this public-note channel ungraded.

This is also a language-policy edge: arbitrary model text in `missing_concepts` is not independently language-checked. The current examples happen to be Russian, but the contract permits any language or mixed prose. The maximum of 20 strings × 200 characters also lets substantially more unverified prose reach the note than the static status message requires.

## Minimal bounded correction

Keep `missing_concepts` and recall coverage solely as control data for deciding `partial` versus `complete`, but do not interpolate their text into the public note. Use static scoped notes, for example:

- with no rendered answer and nonempty `missing`: `memory evidence did not resolve every requested detail`
- with a rendered partial answer and nonempty `missing`: `memory evidence did not cover every requested detail`

This preserves the existing partial outcome, citations and related-source behavior. It adds no model call, retry, schema, gate, or verifier change. It also avoids claiming that the complete original source lacks something: the static wording remains correctly scoped to recalled memory evidence.

The existing precedence should stay intact: typed degradation and withheld-block notes remain more specific than the static missing-detail note. Raw `missing_concepts` may remain in model diagnostics for development observability, provided they are treated as untrusted trace payload rather than user-facing factual explanation.

## Focused regression coverage

Add two operation-level tests using deliberately false or wrong-language `missing_concepts`:

1. A supported rendered block plus a fabricated missing assertion returns `outcome: partial`, preserves its validated answer/citations, and exposes only the static coverage note.
2. No blocks plus a fabricated missing assertion returns `outcome: not_answered` with only the static resolution note.

Assertions should verify that the fabricated string is absent from the serialized public output. A small test can also confirm that recall-derived uncovered concept names are not interpolated, because those labels likewise are control metadata rather than verified explanatory prose.

No documentation currently promises verbatim missing-concept explanations. The public result documentation describes typed partial/degraded outcomes generally, so this correction should require at most a short clarification that `note` reports the scoped limitation without echoing model-authored missing claims.
