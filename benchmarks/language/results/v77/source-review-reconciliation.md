# V77 full-review reconciliation

The preserved first pass remains at `tmp/language-v77-full-output-review-initial.json`. This reconciliation was performed after reading the full forensic summary and both split-final forensic reviews. The corrected review is `tmp/language-v77-full-output-review.json`; runtime outputs and the source rubric were not changed.

## Corrected totals

| Measure | Initial | Corrected | Change |
| --- | ---: | ---: | ---: |
| Complete useful writable retention | 29 / 40 | 30 / 40 | +1 |
| Justified read-only holds | 4 / 4 | 4 / 4 | 0 |
| Retention qualification preserved | 33 / 44 | 44 / 44 | +11 |
| Useful qualified retrieval | 200 / 352 | 256 / 352 | +56 |
| Useful qualified writable answers | 170 / 320 | 220 / 320 | +50 |
| Answer qualification preserved | 202 / 352 | 352 / 352 | +150 |
| Justified read-only abstentions | 32 / 32 | 32 / 32 | 0 |
| Nonnull source-entailed answers | 221 / 221 | 221 / 221 | 0 |
| Nonnull language-compliant answers | 221 / 221 | 221 / 221 | 0 |
| Unsafe factual promotions | 0 / 352 | 0 / 352 | 0 |

The corrected useful-answer split is 115/160 development and 105/160 held-out. Useful retrieval is 128/176 in each split. Complete writable retention is 16/20 development and 14/20 held-out.

## Changes and reasons

### Focused answers and retrieval

The first pass treated several independent neighboring facts as qualifications that every focused answer had to repeat. The packet contract instead allows a focused entailed subset to omit unrelated details, while complete retention still requires the full useful retained set.

I therefore changed the following nonnull answers from not useful to useful, and their corresponding focused retrievals from not useful to useful where the governing proposition was retrieved:

- Development nested-report run 1: seven published answers. The focused report preserves the outer and inner reporters, alleged permission, exact measurement, explicit no-replacement correction, and personal epistemic limits. The separate delivery-arrangement denial answers a different predicate.
- Development rejected-plan runs 1 and 2: fifteen published answers. The focused proposal identifies rejection, destination, visual inspection property, and Ada’s lack of intent. The separate carrier-collection denial remains required for complete retention but is not coupled to answering which offer was rejected.
- Development fictional run 2: two published answers previously failed only for omitting the neighboring proposal act. Their fictional promise and story-only scope answer the focused promise query.
- Held-out fictional run 1: four published answers. The story-scoped loan proposition is complete for the focused loan query even though the retained set omits the separate actual introduction act.
- Held-out relative-date run 1: all seven published answers. “Two weeks after the record” preserves the source-record anchor semantically and excludes a processing-time anchor without requiring the contrast to be repeated verbatim.
- Held-out rejected-plan runs 1 and 2: all sixteen published answers. Appointment and transport denials are independent neighboring facts, required for complete retention but not for identifying the rejected measurement proposal.

These corrections add 24 useful development answers and 26 useful held-out answers. Retrieval adds 24 development cells and 32 held-out cells; the extra held-out difference includes all eight coordinates for each newly accepted governing evidence set, including coordinates whose answer remained null.

### Qualification preservation versus coverage

The first pass conflated omission or absence with distortion. Empty retention and null answers publish no proposition and therefore cannot distort a qualification. Likewise, a source-entailed focused answer preserves the qualifications of the proposition it selects even when it omits an unrelated neighbor.

I changed `qualificationPreserved` to true for all case/runs and all answer cells. Coverage and usefulness remain separate: incomplete retained sets still have `retentionUseful:false`; writable nulls still have `usefulQualifiedAnswer:false` and `justifiedAbstention:false`; incomplete retrieval still has `usefulQualifiedRetrieval:false`.

For held-out counterfactual run 2’s Russian-query/Russian-answer inferred-view coordinate, the published statement is a true negative factual antecedent with its own qualification intact. It remains the sole nonnull usefulness failure because it does not answer the requested counterfactual benefit. Its corrected classification is therefore source-entailed, language-compliant, qualification-preserving, non-promotional, but nonresponsive and not useful.

### Retention correction

Held-out relative-date run 1 changes from incomplete to complete useful retention. Its retained wording anchors the interval after the source record, which carries the source-relative clock meaning and rules out processing-time anchoring. Repetition of the explicit contrast is unnecessary.

## Remaining disagreement

I do not adopt the forensic reviewer’s 15/20 held-out complete-retention count. Held-out fictional-example run 1’s retained record attributes a fictional story to Ada and fully preserves the story proposition, but it does not state that Ada actually introduced the example for discussion. The original source makes that introduction a separate real-world act, and complete useful retention requires it. I therefore keep this case/run at `retentionUseful:false` while grading its four focused loan answers and all eight loan retrievals as useful.

This is a retention-only disagreement. It does not change source entailment, language compliance, answer usefulness under the focused-subset rule, qualification preservation, or factual-promotion judgments.

## Unchanged judgments

All 99 writable nulls remain unnecessary and not source-justified because their original sources answer the query. All 32 read-only nulls remain justified policy holds. All 221 nonnull answers remain source-entailed and language-compliant, with no unsafe factual promotion. The terminal result still fails the required gates because writable retention and answer coverage are incomplete.
