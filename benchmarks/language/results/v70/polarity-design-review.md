# V70 follow-up polarity design review

This is a bounded, read-only design assessment based on the exposed V70 `v20-held-report` source and
retention trace, the current retention verifier, and
[`tmp/v70-polarity-contract-inspection.md`](polarity-contract-inspection.md). It proposes no V70
runtime change or rerun. I did not inspect fresh held-out inputs, private configuration/KB content, or
unavailable future outcomes.

## Observed gap

In [`bench-results/language-selected-v70-trace.jsonl`](../../../../bench-results/language-selected-v70-trace.jsonl)
row 2, the selected denial reads:

> Ada Marlow has not arranged delivery of her Zephyr QX-100.

Its metadata nevertheless says `polarity: affirmed`. Row 3 sends both the exact source and that metadata to
the existing retention verifier. The verifier accurately restates the readable denial, but its
`qualification_scope` calls the polarity affirmed and returns all three booleans true. The candidate is
therefore retained.

The shared contract already says that polarity belongs to the main/embedded proposition, that a confident
denial remains `negated`, and that fictional/counterfactual scope or rejection does not negate an otherwise
positive predicate. `SEMANTIC_COMPARISON_CONTRACT` also names polarity in `qualification_scope`. The defect
is therefore an enforcement gap rather than a missing general instruction.

Local regex floors cannot close it generally. Current coverage and leading-existential patterns safely catch
some forms, but finite denial grammar across English/Russian, passive/active voice, questions, contrasts,
fiction, counterfactuals, and rejected actions cannot be inferred by a broad negation-word search without
new false holds.

## Recommendation

Add one required, retention-only field to every verdict in the **existing** `verifyCandidateBatch` call:

```ts
source_selected_polarity: z.enum(['affirmed', 'negated'])
```

Define it as the polarity that the candidate metadata must carry for the selected governing proposition
under `QUALIFICATION_CONTRACT`, derived from the complete original source and exact candidate frame. Put it
before the free-text comparison fields so the constrained response makes this source-first decision before
writing candidate comparisons or booleans.

The candidate’s declared `polarity` is already present in the verifier input. Do not duplicate it as another
model-generated field. After strict parsing and exact candidate-id/set validation, compare the returned
source polarity with the corresponding candidate’s supplied metadata:

```ts
verdict.source_selected_polarity === candidateById.get(verdict.candidate_id)!.polarity
```

Require that equality in the existing accepted-candidate filter in addition to the three semantic booleans.
A mismatch is a valid negative decision and should hold that candidate with the existing typed
`discourse_uncertain` fallback. It should not make the whole response schema-invalid or unavailable, should
not trigger structural repair, and must not be retried. All existing negative booleans remain independently
mandatory even when the polarity field matches.

This is the smallest independently enforceable mechanism available under the stated constraints:

- it uses the same first-pass retention verifier, exact source, candidate frame, and candidate metadata;
- it adds no prose field and does not change comparison/mismatch caps or the verifier token ceiling;
- it changes no public retain/input/output schema;
- it neither parses negation locally nor rewrites candidate metadata;
- it rejects a concrete source/model polarity disagreement deterministically after the model supplies the
  source-side classification.

The retention verifier version should be bumped because its required structured output and acceptance
condition change. The extraction prompt/version need not change unless its wording is also edited.

## Why a stronger boolean instruction is insufficient

Adding `polarity_preserved: boolean`, or merely telling the verifier to set
`qualification_scope_preserved=false` for a metadata mismatch, still leaves acceptance dependent on an
uncheckable model assertion. V70 demonstrates that the model can correctly read the negative sentence while
calling the submitted metadata affirmed. A fourth boolean can repeat that error just as the existing three
did.

The source-derived enum creates a server-checkable relation: the verifier chooses the source polarity and
the server compares it with the immutable candidate value. It does not prove that the model chose the right
source polarity, but it prevents the specific failure mode in which readable-source analysis and candidate
metadata are never compared as structured values. No solution without deterministic language parsing or an
additional semantic judgment can eliminate model classification error entirely.

A prompt clarification remains useful alongside the enum: require the free-text `qualification_scope` and
mismatches/booleans to reflect any polarity mismatch. That improves receipts, but the local enum equality is
the acceptance gate. Do not reject the entire verdict merely because the model returned all-positive
booleans beside a mismatching enum; withholding that candidate is safer and avoids turning a usable negative
decision into case availability failure.

## Scope definition

“Selected governing proposition” must be defined semantically rather than as the nearest negated word:

- **Positive report with negative personal limits or a corrective contrast:** the reported service
  proposition remains `affirmed`. “Ada did not verify it” and “measure, not replace” are material
  qualifications, not the report’s main polarity.
- **A report whose embedded selected proposition is itself a denial:** remains `negated`, despite report
  attribution.
- **Fictional or counterfactual positive predicate:** remains `affirmed`; hypothetical/counterfactual
  commitment and explicit nonoccurrence are separate scope.
- **Rejected positive plan or offer:** remains `affirmed` with `disposition: rejected`; rejecting the action
  does not deny its embedded action predicate.
- **Real denied property/action:** is `negated`, including a direct “has not arranged delivery” claim.
- **Question with no asserted answer:** classify the selected proposition as the existence/content of the
  question, normally `affirmed`; do not choose polarity for either unresolved embedded answer. Existing kind,
  commitment, and nonanswer rules remain mandatory.
- **Compact record with personal negative qualifications:** classify the report/plan/question/hypothesis that
  the record is primarily retaining. If the negative personal action itself is a separate selected candidate,
  that candidate is `negated`.

These distinctions should be stated once in the verifier’s source-polarity instruction by referring to the
existing qualification contract. They should not become a growing example dictionary or local syntax
inventory.

Caller-provided exact attestations should use the same check. Exact support establishes source bytes, not
correct semantic metadata. The design should not depend on `generated: true`; every candidate reaching
semantic retention verification must have its declared polarity compared with the source-derived field.

## Source authority and batching

The verifier already receives the complete source, exact support/frame, the readable candidate, and its
declared polarity. The new field does not expose new source material. Its system instruction must say:

1. identify the selected source proposition from the exact source/frame;
2. classify its governing polarity under the existing contract;
3. do not use the candidate’s declared polarity as evidence;
4. then compare source, readable candidate, and metadata through the existing semantic dimensions.

For a two-candidate batch, the field remains inside each candidate-id-specific strict verdict branch. The
existing singleton ID enums and exact verdict-set validation prevent borrowing one candidate’s decision for
another. Related candidates remain context rather than evidence.

## Meaningful controls

Use invented source/candidate pairs and exercise the actual verifier call/schema and final accepted set:

1. **Exposed shape:** direct “I have not arranged delivery …”; candidate `affirmed`; verifier returns source
   `negated` plus otherwise-positive booleans. The candidate is held as `discourse_uncertain`, the operation
   remains available, and there is no repair/retry.
2. The same source/candidate with declared `negated` is accepted when all existing semantic gates pass.
3. A positive nested report containing unread/no-confirmation clauses and “measure, not replace” returns
   source `affirmed`; `affirmed` can pass and `negated` is held.
4. A nested report whose selected embedded proposition says a warranty does not cover damage returns
   `negated`, proving attribution does not force positive polarity.
5. Positive fictional and counterfactual predicates with explicit nonoccurrence remain `affirmed`; changing
   commitment or omitting nonoccurrence still fails the original semantic dimensions.
6. A rejected positive offer remains `affirmed`; an actual denied action is `negated`.
7. An open whether-question with neither answer established remains an affirmed question record and does not
   promote either embedded answer.
8. A compact report with a negative personal qualification remains `affirmed`, while a separate candidate
   selecting that personal nonaction is `negated`.
9. A caller-provided exact attestation with mismatching polarity is held, demonstrating there is no generated
   candidate bypass.
10. A two-candidate response with opposite source polarities remains candidate-local; swapping IDs or omitting
    either required field fails the existing atomic exact-set path.
11. Missing, invalid, truncated, or trailing verdict JSON remains atomically unavailable with no repair or
    retry.
12. A matching polarity enum cannot override any false proposition/action/qualification boolean or malformed
    frame audit.

Provider-schema tests should inspect both one-candidate and two-candidate strict outputs on supported
endpoints and accept both enum values. Compiled stubs can prove wire shape and local enforcement, but they do
not establish semantic model competence; exposed evaluation after a later freeze remains necessary.

## Tradeoffs and limits

The enum adds a small fixed amount of JSON to each verdict. It adds no free-form prose, preserves the current
batch size and ceilings, and is substantially smaller than a new polarity-comparison object or fourth
comparison dimension. It can still cause a false hold if the model selects the wrong governing proposition
or source polarity. The explicit scope rules and complete original frame are the bounded mitigation; the
system must continue to fail closed rather than repair or reinterpret a negative semantic verdict.

I do not recommend broadening deterministic denial grammar, silently normalizing metadata from readable
text, or relying on a prompt-only boolean. A required source-derived enum plus server-side equality in the
existing verifier is the narrowest coherent correction supported by the V70 evidence.
