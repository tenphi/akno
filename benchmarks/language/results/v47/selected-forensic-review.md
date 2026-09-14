# V47 selected-probe forensic review

Scope: `bench-results/language-selected-v47.json`, its trace, and `tmp/language-selected-output-packet-v47.json`, reviewed directly against the invented original sources. I did not read independent grading. I made no runtime edits or live calls.

## Result

- Retention: three cases retained their expected records; the rejected-offer case retained only the no-booked-handover record and held the material rejected-offer record during semantic verification.
- Answers: 21/32 rows are non-null production. This is not an independent usefulness count. Eight rejected-offer rows have `no_eligible_evidence`; undated has one semantic rejection and one deterministic attribution rejection; alternatives has one semantic rejection. There were no provider or routing availability failures.
- I found no accepted fabricated event, actor swap, factual promotion, language-identity error or protected-value error. I found material completeness losses in alternatives retention/answers and a mild self-containment issue in the separate no-collection record.
- Combined with the V47 built probe's 14/16 answers, this selected probe does not support starting the fresh V19 trial.

## `v18-held-report`, run 1

The main record is source-faithful: Ada is the outer relay, Bo is the inner reporter, the service terms reportedly permit sending the device to a technician for regulator calibration rather than regulator replacement, and Ada has neither seen the terms nor obtained confirmation. The second candidate preserves Ada's separate assertion that she gave no collection instruction.

The second readable record says only `Ada Marlow states that she has given no instruction to collect it.` Its typed subject is actually `unresolved`; it does not supply Zephyr identity. Routing/page context may place the sentence near equipment material, but the readable record itself is not self-contained and the qualification metadata cannot resolve `it`. This is a retrievability/completeness weakness, not an unsupported proposition.

All eight focused report answers are faithful. They preserve both speaker layers, the clarified regulator sense, calibration/replacement contrast and verification limits. Permission is never promoted into booking or shipment.

## `v18-held-rejected`, run 1

Extraction generated both expected candidates. The no-booked-handover candidate was correctly accepted. The rejected-offer candidate was held by the semantic verifier, which reasoned that the source leaves the actor of `The offered shipment was rejected` unspecified while the candidate makes Ada the actor of `rejected rather than accepted the offered shipment`.

That rejection is a false semantic distinction. The source first states `I, Ada Marlow, declined an offer to send...`; declining that offer entails that Ada rejected the same offered shipment. The following passive sentence restates the offer's rejected/nonaccepted lifecycle status; it does not introduce a separate unidentified rejection event. The candidate also preserves the destination, thermostat-measurement purpose and lack of a plan. Treating `declined the offer` and `rejected the offered shipment` as unrelated actors ignores their shared referent and discourse frame.

Because the material plan record was withheld, all eight focused rejected-offer queries returned `no_eligible_evidence`. The surviving no-booking denial does not answer which offer Ada declined, so these are upstream retention-caused coverage losses rather than answer-generation failures.

## `v18-held-undated`, run 1

Retention is complete and accurate: Ada is proposer; the proposal remains unaccepted; no meeting is arranged; next week is anchored to the undated original record and cannot be resolved from processing time.

Six accepted answers preserve those facts and the unknown source clock. The new `без известной календарной даты` source-clock form is accepted where used, so the V47 lexical change works.

Two rows are null:

- EN query → RU answer, inferred view: `Ada Marlow предложила на предварительный срок ... на следующей неделе...` passed deterministic guards and was semantically rejected because `на предварительный срок` was read as an added duration. In full context the phrase is awkward, but it supplies no duration value and attempts to express the source-supported tentative timing before immediately specifying next week and its unresolved source anchor. Consistent with the prior source-only treatment of this wording, I classify this as a semantic false rejection rather than a clear invented time.
- RU query → EN answer, inferred view: `According to Ada Marlow, the tentative proposal was to...` was rejected deterministically for attribution. This hold is correct: it names Ada only as reporting source and omits her source-supported proposing action.

Both remain usefulness losses over adequate writable evidence.

## `v18-held-alternatives`, run 1

The retained record preserves Ada considering both hypotheses and personally selecting neither, but it regresses the source's specific `неплотно вставленный` connector to `improperly seated`. Improper seating is compatible with loose seating, yet it omits the material looseness degree/mechanism. It also compresses explicit `доказательств нет ни для первой, ни для второй` to `both remain unsupported hypotheses`, which is a reasonable qualified summary at retention but makes the explicit shared absence of evidence easier for answers to drop.

Seven answers were accepted. Every answer preserves both alternatives, Ada's consideration and personal nonselection, and tentative/unconfirmed status. However:

- all inherit `improperly seated` or broaden it further to `неправильно установленный`, losing the source's specific loose insertion;
- EN query → RU inferred, RU query → RU inferred, and RU query → RU explicit say only that both hypotheses are unconfirmed, without preserving that there is no evidence for either. Unconfirmed is weaker/different from an explicit absence of evidence and loses a material common qualifier. The RU→RU explicit text is `Обе остаются неподтверждёнными гипотезами; Ada Marlow не выбрала ни одну причину`; the earlier `Для обеих гипотез нет свидетельств` wording belonged to V46 and is not a V47 output.

The EN query → RU explicit draft was semantically rejected because `неправильно установленный` broadens improper seating to general improper installation. The rejection is justified as a usefulness/action-mechanism failure, although the verifier incorrectly also labels the entailed generalization as `proposition_supported=false`; the shared contract says this direction should be an omitted material modifier/action-argument failure rather than unsupported added content. Equivalent broadened wording was accepted in other rows, showing verifier inconsistency rather than a unique defect in this draft.

## Smallest coherent next mechanism

The dominant selected loss is not missing vocabulary: one semantic overread drops an entire retained case, while source materiality is inconsistently enforced across sibling answers. Additional generation sentences alone cannot resolve that inconsistency.

A coherent next change should make material source obligations explicit and position-bound within the existing first-pass pipeline:

1. Derive a short candidate obligation set from the exact source/candidate comparison for material actor, object, lifecycle identity, degree/manner and shared epistemic qualifiers. Each obligation must quote or reference its exact source span and candidate clause; it is not new evidence.
2. Require the same semantic verifier call to mark each obligation preserved or identify the concrete mismatch. For co-referent lifecycle wording, the verifier must compare the whole frame (`Ada declined the offer` plus `the offered shipment was rejected`) before claiming an actor change.
3. Carry verified obligations with retained evidence into answer verification, so explicit `no evidence for either` and `loosely inserted` cannot disappear inconsistently across language/view rows. Do not require incidental adjacent details for focused answers.

This is an internal structured completeness check, not another semantic retry or acceptance override. It keeps the original source authoritative, preserves the existing rejection conjunction and models/gates, and addresses both false rejection and silent omission with one mechanism. A smaller immediate floor fix for the V47 built open-question `remains unresolved whether ... covers or excludes ...` can remain bounded, but it does not address the dominant retention/verifier inconsistency here.

V47 should be preserved as failed exposed evidence. My forensic assessment finds only 3/4 retained sets complete enough for the authored use, while raw production is 21/32 non-null selected answers and 14/16 non-null built answers. Those production counts are not independent usefulness judgments. Together with the material alternatives losses and no fresh V19 execution yet, the full trial is not justified.
