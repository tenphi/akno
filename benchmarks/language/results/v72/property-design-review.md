# V71 connector-property forensic and bounded design review

## Disposition

I confirm a material source-completeness error in selected case `v20-held-assistant`, zero-based query 5 (Russian query, Russian answer, inferred reports view). The published answer changes the specified property in `connector continuity test` to physical/generic connector integrity. This is not a retention, retrieval, citation-selection, language-routing, or anchor-ownership failure. It is a conceptual translation error in generation followed by a source-audit classification error that the current provider-visible schema permits.

The smallest coherent next correction is to split two meanings currently represented by the same all-null `tested_property.relation = not_selected` shape:

1. the containing operation/test proposition is itself unselected; and
2. the operation is selected, but neither source nor answer specifies a tested property.

The first shape should be legal only with `object_and_operation.relation = not_selected`. A new strict private-model shape such as `relation = absent_from_both` should cover a selected ordinary operation with no source or answer property. Existing active property shapes should continue to cover present, omitted, substituted, and answer-added properties. This changes only the existing verifier response contract and its private schema; it need not change the public API, model, call count, retries, output ceilings, or semantic acceptance thresholds.

That dependency is a useful structural correction, not a semantic guarantee. The verifier can still wrongly claim `absent_from_both` when a property is present, or wrongly call two quoted properties equivalent. A post-freeze live evaluation remains necessary; synthetic schema tests can establish only that the V71 escape shape is no longer legal.

## Source-first evidence

The original invented source says:

> I tentatively think Zephyr QX-100 servicing might include a connector continuity test each month. I have neither read the service agreement nor verified that interpretation. I am describing a possible contractual term, not an established obligation.

The retained record is complete and source-faithful:

> **Reported by assistant · Tentative:** The assistant tentatively thinks Zephyr QX-100 servicing might include a connector continuity test each month as a possible contractual term, not an established obligation. The assistant has neither read the service agreement nor verified that interpretation.

These bytes appear in the [source-only packet](../v71/language-selected-output-packet-v71.json) under case `v20-held-assistant`. Retention extraction and verification are trace rows 108–109 in the [selected V71 trace](../../../../bench-results/language-selected-v71-trace.jsonl); the retention verifier expressly identifies “testing connector continuity monthly.” One qualified record is written and retrieved. The answer cites that record as `E1` under `complete_retained_record`, so every retained clause is selected.

At query 5, generation row 133 first writes a private reading that still quotes `a connector continuity test each month`. Its public RU block then says:

> По словам ассистента, он предварительно считает, что обслуживание Zephyr QX-100 может включать ежемесячный тест целостности разъёма как возможное договорное условие, а не установленное обязательство. Ассистент не читал договор обслуживания и не проверял эту интерпретацию.

`целостность разъёма` denotes the connector's integrity or intactness. It does not retain the specific continuity property tested by a continuity test. A source-faithful Russian rendering needs the continuity meaning, such as `тест непрерывности разъёма` or an equally precise electrical-continuity formulation. V71 itself produces such precise wording at other coordinates, including query 7.

The answer otherwise preserves the monthly frequency, servicing context, tentative possible-contractual-term status, absence of an established obligation, assistant attribution, and the assistant's personal non-reading and non-verification limits. The defect is therefore a material property omission/generalization, not wholesale contradiction.

Language checking at row 132 reports compliant Russian. That is expected: the language check is not a technical-meaning verifier. The final report records one generated block, one guard-passing block, and one verified block; there is no typed availability or provider failure.

## Exact verifier failure

Trace row 134 receives the immutable original-frame anchor and the RU answer anchor. Its own prose distinguishes the meanings:

- `source_context` says `monthly connector continuity test`;
- `candidate_meaning` says `monthly connector integrity test`;
- `object_and_operation` selects both source and answer anchors and calls the monthly connector test preserved.

Despite that, `tested_property` is:

```json
{
  "source_anchor": null,
  "answer_anchor": null,
  "source_property": null,
  "answer_property": null,
  "relation": "not_selected"
}
```

All three semantic booleans are `true`, there are no mismatches, and excerpt selection is `true`. The server consequently publishes the block.

The adjacent explicit-view RU coordinate supplies a useful control. Generation row 125 also changes continuity to `целостности соединителя`. At row 126 the verifier activates the property comparison, writes `source_property: continuity`, `answer_property: integrity`, sets `relation: generalized`, sets `action_arguments_preserved: false`, and gives a concrete mismatch. That block is correctly withheld. Thus V71 already contains the necessary semantic rule and demonstrates that it can reject this distinction; the published failure occurs when the verifier classifies the selected property as unselected.

## Frozen runtime assessment

The frozen generation contract already says that a technical test selects both an object and a tested property and that generic soundness loses the specific test ([answer-record-rendering.ts](../../../../packages/core/src/ops/answer-record-rendering.ts#L113)). The source-audit contract is even more explicit: it requires a separate tested-property comparison, says generic physical integrity is broader than a specified electrical property, and forbids `not_selected` merely because a selected answer omits the property ([answer-source-audit.ts](../../../../packages/core/src/ops/answer-source-audit.ts#L249)). Another general prose reminder would repeat a requirement that both calls received and one verifier invocation obeyed.

The executable gap is in the schema union at [answer-source-audit.ts](../../../../packages/core/src/ops/answer-source-audit.ts#L167). Its first entry branch pairs an all-null property `not_selected` with the full 80-character `object_and_operation` schema. That operation schema includes `preserved`, so row 134 is structurally valid. `answerAlignmentsSupported` then accepts every alignment whose relation is `preserved` or `not_selected`; it validates anchor ownership but cannot infer from natural prose that continuity is a selected property ([answer-source-audit.ts](../../../../packages/core/src/ops/answer-source-audit.ts#L209)). The final gate in [answer.ts](../../../../packages/core/src/ops/answer.ts#L919) therefore behaves as implemented.

This is not an excerpt-selection bug: the complete retained record and `E1` are selected correctly. It is also not a strict-JSON/schema-transport bug: row 134 is valid under the frozen schema. The generation call makes the first conceptual translation error. The verifier then makes a second conceptual classification error, and the schema gives that error an accepted representation.

## Recommended private schema dependency

Use a provider-visible union that expresses the property state machine directly:

- **Selected operation, property present on both sides:** retain the current compared shape with `preserved | generalized | changed`.
- **Selected operation, source property omitted by answer:** retain the current `omitted` shape.
- **Selected operation, property added by answer:** retain the current source-null/answer-present `changed` shape.
- **Selected operation, no property specified by either side:** add an all-null singleton such as `absent_from_both`. This is an explicit semantic assertion by the verifier, rather than a claim that the selected operation was irrelevant.
- **Operation unselected:** allow all-null `not_selected` only in a union branch whose `object_and_operation` is also `not_selected`.

Keep field order comparison-first and relation-last, strict branch objects, one entry per evidence ID, existing anchor ownership, excerpt selection, the three semantic booleans, and negative-consistency checks. `answerAlignmentsSupported` may accept `absent_from_both` only in its matching branch; generalized/changed/omitted remain rejecting. Ordinary plans, bookings, reports, and other selected actions with no measured property use `absent_from_both`, so the correction does not invent properties or turn every operation into a test.

This split would make the exact row-134 response invalid because it pairs a preserved selected operation with property `not_selected`. It does not prove that a future model will choose the active branch: it could misclassify the source as `absent_from_both`. That residual risk is unavoidable without deterministic domain semantics, an independent semantic capability, or another pass, all outside this bounded scope.

## Exact-substring option

Requiring non-null property descriptions to quote substrings of their own immutable anchors is technically enforceable, but it does not solve this accepted failure by itself. Row 134 has no property strings to validate. Row 126's `answer_property: integrity` is also an English normalization rather than a substring of the Russian answer; exact-substring enforcement would make that already-negative audit malformed rather than improve its semantic decision.

The current per-side cap is 30 characters. A short decisive token such as `continuity` or `целостности` fits, but meaningful measured-property expressions can exceed 30 characters. Permitting an arbitrary short substring can discard modifiers and is not a complete-property guarantee; requiring the complete phrase can create schema-unavailable verdicts at the existing cap. Even exact faithful snippets do not force the model to choose `generalized` instead of `preserved`. I would therefore not add substring enforcement as the V72 fix. It can be evaluated separately with a corpus of long, inflected, and multiword invented properties and an explicit cap/budget decision.

## Meaningful controls

Schema and integration tests should establish the contract without pretending to establish model reliability:

1. A preserved selected operation plus all-null `not_selected` property is schema-invalid and cannot publish. Use the exact structural shape of row 134 with invented continuity/integrity prose.
2. An unselected operation plus all-null property `not_selected` remains valid.
3. A selected ordinary action with no tested property uses `absent_from_both` and can pass when all other semantics pass.
4. A source property omitted from the answer uses the active `omitted` branch and is withheld.
5. A property added to an unspecified source test uses the answer-present `changed` branch and is withheld.
6. Continuity versus integrity in the active compared branch with `generalized` plus a negative action-arguments verdict is withheld; a faithful continuity translation with `preserved` can pass.
7. Malformed branch mixtures, foreign anchors, null/nonnull violations, missing fields, trailing JSON, and negative alignment paired with all-positive semantic booleans remain fail-closed with no retry.
8. Capture the actual provider JSON Schema for ordinary no-property, active-property, and unselected-operation branches. Verify strict `anyOf` shapes, existing field limits and the unchanged answer-verifier call ceiling.

No local multilingual synonym floor or continuity-specific dictionary is justified. Such a rule would cover one phrase while risking false holds across open technical vocabulary. The schema dependency is the narrow correction supported by the V71 contrast; its effectiveness against model misclassification must be measured in the declared frozen evaluation workflow.
