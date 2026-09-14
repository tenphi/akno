# V66 independent code review — round 1

## Disposition

No production correctness blocker found in the eight bounded changes. The implementation follows the corrected design: each deterministic addition remains a presence/shape floor, and every accepted generated record or answer still reaches the existing full semantic verification. I found one already-known test-fixture issue in the current snapshot: `answer-source-audit.test.ts` still supplies provider API value `chat`, while the production type/adapter uses `chat_completions`. That fixture must be corrected before the final gate; it does not identify a runtime defect.

This review establishes code and contract consistency only. Deterministic mocks do not establish that either model will produce the intended structures, and V21 remains unexecuted.

## Coverage unanswered-question floor

`coverageRolesSupported` adds only the same-clause Russian construction `не отвечает на вопрос [о том] покрывается ли ремонтом …`. Existing processing still strips quotations and splits sentence, semicolon, newline, colon, and bounded coordinated clauses. Activation still requires the source to contain repair-as-covered language, while an independently source-present repair-as-coverer proposition defers role pairing to the semantic verifier.

The tests cover the observed comma/no-comma forms, sentence and clause boundaries, quoted examples, device nonresponse, person-to-person response, the faithful nominal `о покрытии ремонта`, and the source-side coverer exception. The new regex does not relax the semantic verifier or invent a coverer. Its finite limit is intentional: colon-introduced and materially different interrogative syntax remain outside this local recognizer.

## Coordinated personal report uncertainty

The new branch consumes the complete three-predicate list under one explicit `has/have/had not`, with closed examination and report-check objects and a terminal boundary. Quoted content is masked first. A positive new finite clause, another actor, a positive auxiliary, wrong object, punctuation boundary, collective pronoun, mismatched explicit-pronoun reflexive, or trailing retraction remains rejected in the tests.

For a named actor the local branch permits the bounded reflexive alternatives rather than inferring gender from the name. This is safe because the helper only admits readable uncertainty to the unchanged full-source verifier; it does not itself approve actor identity. The test correctly treats `has not … or herself confirmed it` as governed by the shared negative, while `but she herself has confirmed it` is a negative control.

## Advisory missing-identifier repair context

The cleaner records missing identifiers by original extraction index in a private typed map. Repair receives exact original source items containing the normalized identifier, occurrence and source-span counts, explicit omitted counts, at most four identifiers/four complete spans, and a shared 1,200 UTF-16-unit allowance. It never clips a span or silently chooses one occurrence. Quoted and repeated occurrences remain visible as ambiguity rather than being promoted to an antecedent.

The field is supplied only to an already-failed repair target. It does not mutate the original candidate, append a frame, alter an admitted sibling, or bypass the second cleaner. The prompt requires minimal actual attachment and metadata re-evaluation when a repaired payload includes competing hypotheses. Existing repair-index survival, immutable admitted-context, source-span validation, original repair obligation, and complete-source verification remain intact.

The test suite covers unique, repeated, quoted, oversized, and span-cap cases plus omission without automatic rescue. A useful finite limitation is that an unstructured source longer than 1,200 units can report the occurrence but provide no advisory span; the model still has the complete source and may omit an unsafe repair. This fails toward retention loss rather than unsupported persistence.

## Provider-visible answer alignments

The previous local `.refine` is replaced by three strict union branches:

- `preserved/generalized/changed`: non-null source and answer anchors;
- `omitted`: non-null source anchor and null answer anchor;
- `not_selected`: nullable source anchor and null answer anchor.

Owner-specific enum coordinates, selected-category requirements, negative relation rejection, semantic booleans, strict parsing, and excerpt selection are unchanged. The transport test checks strict object branches, required properties, enums, `anyOf`, and absence of `oneOf`/`const` for both adapters. In the reviewed snapshot its Chat case still uses the known invalid `api: 'chat'`; change that test value to `chat_completions` and retain the Responses case. No production schema issue was found.

## Compact span interpretations

The verifier prompt now asks for a complete compact sentence, puts actor/polarity/qualification first, and explicitly keeps original spans and candidate text authoritative. It also asks for a mismatch for each false semantic dimension. There is no new fragment detector, output-budget increase, sibling salvage, or consistency relaxation.

The regression accurately distinguishes the V65 inconsistency (false proposition without a proposition mismatch) from a consistent negative with `reason_code: null`. A null reason remains legal and falls back to `discourse_uncertain`. Complete JSON with a clipped but internally consistent audit remains a documented model-quality limit; transport-truncated JSON continues to fail closed.

## Nominal Russian counterfactual floor

The new shared helper strips quoted examples, splits bounded clauses, and recognizes only the two observed nominal constructions: the instrumental `нереализованной альтернативой было … которое в случае покупки … бы` form and `нереализованный вариант, при котором … бы`. It requires conditional morphology and prevents another finite/pronominal actor from being borrowed through the bounded noun phrase. Both answer-view and retained commitment floors call the same helper; this does not alter source entailment or the coverage-role verifier.

Tests cover factual/realized variants, missing `бы`, sentence/semicolon/newline/adversative boundaries, quoted phrases, and a second actor. The helper intentionally does not decide whether the consequence, coverage extent, or nonpurchase qualification is faithful. Thus the previously overbroad coverage draft can pass this lexical floor but must still fail mandatory semantic verification.

## Undated original-record clock variants

The shared helper recognizes only a bounded relative interval explicitly attached to `первоначальной записи без даты` or `недатированной первоначальной записи`. It is used by both source-relative and unknown-clock checks, which matches the observed V65 failure of both predicates. Quoted deictic labels are unwrapped while other quotations are masked; newlines and contrary/conditional continuations are excluded, apart from the already-bounded no-plan/no-meeting denial.

Positive and negative tests cover both noun orders, `от времени`, quoted labels, dated/processing nouns, split absence wording, questions, negation, hearsay/example/conditional prefixes, conflicting clocks, clause crossing, and quotations. Full semantics remains responsible for the actual interval and record attachment. The recognizer is deliberately finite rather than a Russian temporal parser.

## Hyphenated vocabulary and generation guidance

Answer generation now states that hyphenation and technical context do not by themselves protect ordinary component prose, while names, identifiers, exact source-backed references, quotations, and code retain their established handling. There is no new deterministic Latin-token rejection or language-check exemption. Coverage generation also prefers a faithful covered-repair nominal/active construction without inventing an insurer, warranty, or agreement.

## Plan and version consistency

The runtime tags advance to answer generation/verifier `v61/v41` and retention generation/verifier `v49/v32`; the benchmark expectations in the diff track those values. The V66 plan accurately states the eight changes, the unchanged 2,400-token diagnostic ceiling and production 1,024-token overlay, unchanged models/gates/no-retry behavior, schema controls, exposed-probe stop conditions, and the requirement for independently approved fresh V21 held-out inputs before a full trial.

## Required closure before freeze

1. Correct the known transport fixture from `chat` to `chat_completions` and confirm its actual request-schema assertions run.
2. Complete the repository's planned checks and the independent final review; no additional runtime expansion is warranted from this round.
