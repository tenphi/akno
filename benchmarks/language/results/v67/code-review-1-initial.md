# V67 independent code review — round 1

## Disposition

No actionable production correctness blocker found in the reviewed V67 diff. The structural additions match the bounded design and leave the existing source, language, attribution, semantic, selection, and strict-JSON gates mandatory. No model, output cap, call count, retry behavior, public schema field, enum, or acceptance threshold changes.

This is a code/contract review. The reported deterministic test passes establish wiring and guard behavior, not free-text model competence. The build was still running when review began; I did not run a provider or inspect fresh V21 held-out material.

## Consolidated report uncertainty

The new `memory/report-uncertainty.ts` replaces the duplicated two- and three-part branches with one closed grammar. It correctly admits both V66 faithful shapes:

- `has not read the agreement or independently checked this account`;
- `is only passing on this meaning, has not read the agreement, and has not independently checked Bo Winters’s account`.

The parser keeps a single explicit negative auxiliary, or requires a repeated auxiliary to repeat `not`. `checked` is restricted to account/report/claim objects; reading remains restricted to terms/contract/agreement. It does not equate checking with receiving confirmation. Quoted material is replaced by a non-splicing sentinel, and sentence, semicolon, newline, conditional/example, new-actor, wrong-object, positive-auxiliary, and trailing-retraction controls remain negative.

Named actors allow bounded reflexive spellings without claiming gender. This may let malformed named/reflexive agreement reach the verifier, but cannot publish it: `hasReportUncertainty` is only a presence floor, and full-source attribution/action/qualification verification remains mandatory. Explicit pronouns retain local reflexive agreement. Existing source activation and generated-only cleaner boundaries in `retain.ts` are unchanged.

One finite grammar limit is intentional: coordination outside the enumerated `or`, comma-and-repeated-negative, and serial-list forms still fails closed. No wildcard crosses a predicate or clause.

## English source-entry clock

`hasExplainedSourceEntryClock` is a dedicated branch rather than another loose alternative in the existing large regex. It requires:

- `next` with `after`, or `last` with `before`;
- matching day/week/month/year nouns via the backreference;
- an explicit meaning relation;
- a determiner/possessor, at least one `undated/original` modifier, and `source entry/record/note`;
- a real sentence/clause end, with only the closed processing contrast allowed.

Quotation masking and conditional/example/negated-prefix checks prevent borrowing. The tests distinguish source-relative anchoring from unknown date: an original-source anchor alone passes `hasSourceRelativeAnchor` but fails `hasUnknownReferenceClock`; the combined retention/answer checks still require both. The exact V66 initial and repair texts pass both predicates. Identity/possessor correctness remains semantic-verifier work rather than local name inference.

The branch is deliberately finite: `this` intervals and different natural paraphrases remain outside it, while the generation contract can prefer the recognized canonical form. That is a coverage limit, not an unsafe admission.

## Shared counterfactual wording

The existing shared helper remains the sole new integration for both discussion-view and retained counterfactual status. Its English branch requires an explicit `unrealized/counterfactual option|alternative|scenario`, one bounded relative clause, and `would have|would be` morphology. The Russian branch raises the safe-token allowance to 14 while adding a 160-character lookahead bound; intervening pronouns, conditionals, reporting verbs, coordination, quotation sentinels, and clause boundaries remain excluded.

The exact V66 English and eleven-token Russian false holds are positive regressions. Realized/factual forms, `would` without the required morphology, new actors, overlong spans, punctuation, adversatives, and quoted examples are negative. An overbroad no-active-coverage conclusion can pass the surface floor but is explicitly covered by a mandatory semantic-negative integration test. The helper still establishes only counterfactual wording, never the antecedent, consequence, purchase status, coverage object, or actual-world scope.

## Translation role/property planning and report headings

The complete-record rendering contract now asks the existing private reading to identify operation, object, tested property, coverage roles, and ordinary-versus-protected compound vocabulary before translation. The verifier contract asks for source and answer properties separately before the relation choice, preventing a slash-pair from silently equating connector integrity with electrical continuity. The new negative integration checks that a `generalized` object/mechanism relation plus false action preservation remains unpublished under both query languages.

These are prompt procedures in the existing fields, not new authority. Private readings remain absent from verifier input; immutable source anchors and final answer anchors still control the independent comparison. Natural equivalent terminology may pass, unspecified source properties remain unspecified, and the change does not introduce a component dictionary or language exception.

For translated one-record reports, the renderer contract instructs a visible heading to use the record's supplied `report_source_display_phrase` exactly. It explicitly avoids mechanical prepending and preserves inner source and embedded actors separately. This is appropriately a generation hint rather than a local attribution relaxation. It is not deterministic enforcement: a model can ignore the hint and then be held by the existing attribution/language/semantic guards. The V67 plan describes it as an instruction, so there is no implementation/documentation mismatch.

## Alignment order and protocol compatibility

Each of the three existing strict alignment union branches now serializes `detail` before `relation`. Fields, enum values, null combinations, strictness, and caps are unchanged. Local parsing remains order-insensitive, while constrained generation receives the intended compare-then-decide order. The existing `z.union` still emits supported `anyOf`; there is no `oneOf`, discriminator, `const`, or refinement reintroduced.

Tests assert the endpoint property order and retain the negative relation/null parsing and mandatory semantic behavior. Frozen protocol controls should still capture generation, translation-only, all three alignment shapes, and retention verification before probes, as the plan requires.

## Retention activity and commitment

The added extraction and verifier instructions distinguish an asserted outer discussion act from tentative embedded hypotheses and separately prohibit changing `discussing` into private `considering`. They consolidate the intended two-layer rule without changing typed commitment semantics or adding a synonym guard. A source that actually says considering remains valid; a faithful tentative-hypothesis candidate still requires complete-source verification.

## Versions, tests, and trial plan

The consumer versions advance consistently to retention generation/verifier `v50/v33` and answer generation/verifier `v62/v42`; benchmark expectations track them. The plan accurately preserves the V66 evidence baseline, unchanged 2,400-token diagnostic ceiling and 1,024-token service overlay, same 64 selected plus 32 built observations, no replacement runs, independent source-only grading, and the stop condition before any approved fresh V21 held-out execution.

The reviewed tests include exact positive regressions and meaningful negative boundaries for report lists, clocks, counterfactuals, technical-property comparison, report heading guidance, coverage roles, and activity/commitment separation. No additional parser expansion is justified from this review.

Final round-one status: clean, subject to completion of the repository's independently running build/full checks and the separate second review.
