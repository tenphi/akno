# V69 built-package forensic review

Scope: frozen runtime `bf73549dd0a721b61b3c05bb3e75d89e79a7621e`, `language-built-reliability-v69.json`, its 115-row trace, the four original V20-development cases selected by the built probe, and the frozen `tmp/core-v69` implementation. I did not inspect an output-grade receipt, call a provider, inspect fresh held-out input, or edit runtime code.

## Result

- Complete source-faithful retained sets: **3/4 cases**. Question, rejected offer, and alternatives are complete. The report retains only the separate no-collection denial and loses its main qualified report.
- Published answers: **24/32**. All 24 published answers are source-faithful and useful for their focused questions in this audit: question 8/8, rejected 8/8, alternatives 8/8.
- Null answers: **8/32**, all report coordinates. They are `no_eligible_evidence`, with no generation or verification call. They are coverage losses over adequate original evidence, rather than justified source-level abstentions.
- Accepted source, qualification, role, or language errors: **0 observed** among published answers.
- Availability/operation failures: **0**. The report loss is a deterministic pre-verifier validation hold, not transport availability.
- Source-byte changes: **0/4**, consistent with the report's byte-stability evidence.

The benchmark's per-case `usefulRetentionCoverage: 4/4` reflects that every case retained at least one useful record. It does not mean all required source propositions survived: the report retained set is incomplete.

## Case audit

### `v19-held-report` (trace rows 1–6)

The source has two independently useful records:

1. Ada relays Bo's statement that the terms permit sending Zephyr QX-100 to a service bench to measure return-spring tension. The Russian clarification says measurement, not replacement; these are Bo's words in Ada's retelling and are not a condition Ada verified. Ada has not read the terms and has no independent confirmation of the report.
2. No collection of Ada's device has been booked.

The separate denial survives exactly as `Ada Marlow states that no collection of her device has been booked.` It is source-supported. Its subject is routed to Ada rather than the device page, but the focused report queries do not use it and no answer falsely treats it as the requested spring report.

The main initial candidate in row 2 is locally held and repaired. It says Ada `has not read the service terms or independently confirmed this reported condition`. This changes the source's possession/availability predicate, `has no independent confirmation`, into a claim that Ada personally performed no confirmation. It also calls the report a `reported condition`, while the source expressly distinguishes the retelling from a service condition Ada verified. The candidate otherwise preserves Bo/Ada roles, permission, service-bench destination, return-spring tension measurement, and the no-replacement contrast.

The row-4 repair adds the retelling and not-a-verified-service-condition clarification, but still says Ada `has not ... independently confirmed the report`. It therefore retains the same unsupported performed-action inference. The repair is held by the same local `discourse_uncertain` floor before semantic verification.

Frozen replay in `tmp/v69-report-cleaning-replay.json` confirms that both batches keep only the denial and give the main report the same local hold, without making a semantic call. The local structural cause is detailed in `tmp/language-v69-report-stage-design-review.md`: the personal-limit clause is embedded in an unrecognized compound form. For this built case, however, accepting either exact draft would be wrong because the predicate has also changed. The coarse hold reason cannot distinguish this real semantic defect from the selected probe's faithful structural false holds.

All eight report queries retrieve the unrelated-but-source-true denial as the sole retained evidence. Context activation selects zero records and returns `no_eligible_evidence`; no answer model is called. Since the original main report fully answers the query, all eight are answer-coverage losses caused upstream by incomplete retention.

### `v19-held-question` (trace rows 7–42)

The retained record faithfully preserves Ada's open question about whether preventive coolant top-up for Zephyr QX-100 is included in the service contract, her lack of an answer, and the fact that neither inclusion nor exclusion is established. It does not answer the embedded question or invent an external asker/recorder.

All eight answers cite `memory/equipment:7` and preserve the same three propositions. The Russian variants (`не установлено ни включение ... ни исключение`, or the equivalent plural construction) retain record-level non-establishment and Ada's personal lack of an answer. The English variants are exact copies of the retained proposition. Labels correctly expose the open-question status. No answer changes uncertainty into coverage or exclusion.

These are eight useful partial answers: `partial` reflects the qualified non-answer status, not missing source content.

### `v19-held-rejected` (trace rows 43–79)

Both source records survive:

- Ada declined the offer to send Zephyr QX-100 to a laboratory for a rotor-balance measurement and has no plan to send it under that offer.
- No pickup of Zephyr QX-100 has been booked.

The focused answers consistently cite the first record, `memory/equipment:6`; omitting the unrelated pickup denial is appropriate for the offer question. Across all eight coordinates they preserve Ada as rejector, the laboratory shipment as the rejected course, rotor-balance measurement as its purpose, and Ada's lack of a plan under that offer. Russian `измерение балансировки ротора` and `измерение баланса ротора` are both faithful here. No answer says shipment, measurement, or pickup occurred.

The report marks the first four outputs complete and the other four partial, but all eight public texts contain the complete focused proposition. This internal outcome distinction does not alter their source usefulness.

### `v19-held-alternatives` (trace rows 80–115)

The single retained record combines the full selected proposition: Ada is discussing two competing preliminary hypotheses, slipping drive belt and jammed cooling fan; neither has supporting evidence; Ada has selected no cause. This faithfully merges the two source items without promoting either hypothesis.

All eight answers cite `memory/equipment:7` and preserve Ada's actual discussion activity, both alternatives, their preliminary/tentative status, absence of supporting evidence, and Ada's personal nonselection. Russian `не имеет подтверждающих доказательств/данных/свидетельств` are ordinary faithful variants in this context. None assigns the nonselection to an unnamed group or changes a hypothesis into an established fault.

As in the rejected case, complete versus partial outcome labels vary with query/view mode, while all eight public answers remain complete for the focused question.

## Failure classification and bounded correction

There is one retention-stage loss mechanism and no answer-stage rejection or availability mechanism in this built run. The report candidate must carry several coupled propositions, but extraction is told to produce one prose sentence. That encourages compound relay/clarification/personal-limit structures outside the deterministic uncertainty grammar. In the built drafts the same pressure also lets `has no independent confirmation` drift into `has not independently confirmed`.

The bounded correction remains:

- allow one compact self-contained prose record containing short complete sentences under the unchanged 400-unit cap;
- place personal reading/checking/confirmation limits in a separate explicit-subject affirmative sentence;
- preserve the exact source predicate family, especially possession of confirmation versus personally performing confirmation;
- give the one repair a precise structural diagnostic rather than claiming uncertainty is absent;
- retain the full report, nested source, action/object contrast, and limits in one candidate and keep the mandatory original-source semantic verifier.

This needs no added call, retry, schema, model, cap, or weakened floor. It should be tested with a faithful built positive using `has no independent confirmation`, a negative that changes it to `has not independently confirmed`, and full-source completeness/actor controls.
