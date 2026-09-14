# V62 publication cause correction review

I checked trace row 99 against the frozen answer-audit schema and answer-verification control flow. The published operational count and disposition remain correct, but the current README, amendment and PR description describe the exclusion failure too generically and partly assign it to the wrong consistency check.

## Exact failure

For E1, the returned `qualification` alignment has:

- `relation: "omitted"`;
- a non-null `answer_anchor: "B1_cbfe3697c41d_2"`.

`alignmentSchema` requires `relation === "omitted"` exactly when `answer_anchor === null` (except the separately handled `not_selected` case). The supplied E1 qualification alignment therefore fails the schema refinement. `liveSchema.safeParse(...)` fails, so answer verification returns an invalid structured verdict and the public operation surfaces as `verification_unavailable`.

The response also judges the E1 actor omitted while marking `action_arguments_preserved: true`. That is a distinct, source-disputed semantic judgment, but it is not what makes this response unavailable. `semanticVerdictConsistent` compares only the three top-level semantic booleans with mismatch dimensions. Here the `true` action-argument boolean has no action mismatch, while `qualification_scope_preserved: false` has the corresponding qualification mismatch, so that function's boolean/mismatch consistency condition is satisfied. If an otherwise schema-valid response retained only the omitted actor alignment with all three semantic booleans positive, `answerAlignmentsSupported` would exclude the block and produce `verification_rejected`; it would not produce `verification_unavailable`.

## Recommended publication wording

Replace the README's current exclusion-cause sentences with:

> The selected exclusion null comes from a schema-invalid verifier response over a source-faithful draft. For E1, the qualification alignment says `relation=omitted` while supplying a non-null answer anchor, violating the alignment schema; `liveSchema.safeParse` therefore fails and the operation surfaces as `verification_unavailable`. The same response separately judges Ada's attribution omitted for E1 even though the complete answer can naturally scope its opening attribution over both sentences. That false agency judgment is preserved as diagnostic evidence, but it did not cause the unavailable result. A schema-valid actor-omitted/all-positive control is rejected rather than classified unavailable. The 1,563-token receipt does not establish budget exhaustion.

For the amendment, replace “availability failure from an inconsistent verifier verdict” with:

> availability failure from a schema-invalid verifier response (an `omitted` qualification alignment carried a non-null answer anchor)

For the PR body, replace “case-level availability failure from an internally inconsistent verifier response” with:

> case-level availability failure from a schema-invalid verifier response; a qualification alignment marked `omitted` retained a non-null answer anchor, while a separate false agency judgment is preserved as diagnostic evidence

The correction should preserve the already-published README/amendment and forensic history rather than silently rewriting the evidentiary sequence. The numerical claims remain unchanged: selected availability 1/6, selected answer-operation failures 2/48, total useful answers 75/80, and full repeated validation deferred. The main source-only answer grade is also unchanged; this correction concerns the operational cause of one null.
