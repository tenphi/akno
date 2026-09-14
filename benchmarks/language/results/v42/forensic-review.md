# V42 selected and built probe forensic review

Scope: read-only review of the two V42 probe reports, their traces, and the corresponding original-source/output packets. Runtime verdicts were treated as evidence, not ground truth. This is not the independent grading receipt.

## Result overview

- Selected probe: all four sources produced at least one retained record. Three retained sets were materially complete. The rejected-offer set lost the separate no-handover-booking record during destination ownership. There was one null answer, a semantic-verifier false rejection. Of the 31 non-null answers, one has a material source-entailment concern: it changes generic thermostat measurement into measurement of the thermostat's temperature.
- Built probe: both sources were retained completely and all 16 answers were non-null. I found no accepted source, attribution, qualification, or language error.
- The V42 source-backed language references removed the earlier false language holds on invented proper names and identifiers. Every observed language check in these probes passed; the references did not override a negative verdict in this run.

## Selected cases

### `v18-held-report`, run 1

Retention is complete and source-faithful. The substantive record keeps Ada Marlow as the outer relay, Bo Winters as the inner reporter, the permission to send Zephyr QX-100 to a technician for dial/regulator calibration, the explicit non-replacement contrast, and Ada's lack of access to the terms or independent confirmation. The second record separately preserves that Ada gave no collection instruction.

All eight answers are non-null. They consistently make Bo the source of the reported permission and Ada its outer relay, rather than turning Ada into the author of the permission. They preserve calibration versus replacement and the verification limitations. I found no accepted error.

### `v18-held-rejected`, run 1

Extraction produced two source-faithful candidates and the semantic verifier accepted both:

- Ada declined the offered shipment for thermostat measurement, has no plan to ship under that offer, and the offer was rejected rather than accepted.
- No handover of the device has been booked; the booking actor remains unspecified.

Only the first persisted. The exact failure is downstream destination ownership: the second candidate retained the source's phrase `the device`, the ownership call received that reduced candidate representation and returned `uncertain`, and the candidate was held. Thus this is neither extraction loss nor semantic rejection. The hold is defensible from the reduced ownership input itself. Across the complete two-item source, however, `the device` resolves unambiguously to Zephyr QX-100. The resulting system-level retention gap shows that V42 antecedent resolution did not carry this cross-item identity into the ownership input.

All eight focused offer answers are non-null and preserve Ada as the person who declined and the rejected/nonaccepted disposition. Several fuller answers also preserve the absence of a plan under the offer; the shorter answers omit it, which is permissible for the focused question asking which offer Ada declined. They do not invent booking or performance. The missing no-booking sibling remains a retention-completeness loss even though it is not needed to identify the declined offer.

One accepted answer, EN query to RU inferred view, says `для измерения температуры термостата`. The source says only `for a thermostat measurement` and supplies no measured property. The Russian answer therefore adds the unsupported detail that temperature is what would be measured. This is a source-entailment error, while its Russian language, rejection status, actor, destination, and no-plan qualification remain correct. The answer verifier noticed the lexical difference in its comparison but incorrectly called the purpose preserved.

### `v18-held-undated`, run 1

Retention is complete. It preserves Ada as proposer, the review of warranty exceptions, next week relative to the undated source record, the unknown calendar week, tentative timing, nonacceptance, and absence of an arranged meeting.

Seven answers are non-null and preserve those constraints. The sole null is EN query to RU inferred view. Its draft states the same proposal, source-relative clock, unknown calendar week, nonacceptance, and no meeting, then says `Срок был предварительным.` The answer verifier rejected this because it read `срок` as an unsupported deadline rather than tentative timing. In this context, and especially beside the typed `temporal.status: tentative`, `предварительный срок` is a natural rendering of provisional/tentative timing. The same phrase in the RU-query/RU-answer inferred draft was accepted. I classify the null as a semantic-verifier false hold caused by inconsistent overreading, not a genuine source or qualification error.

### `v18-held-alternatives`, run 1

Retention is complete. The record preserves Ada as the actor who considered both explanations and personally selected neither, while keeping both unsupported. All eight answers are non-null and explicitly bind Ada both to consideration and nonselection. English narrative backshift (`was considering`, `had selected neither`) stays within the same undated record and does not invent a date. I found no accepted error.

## Built cases

### `v17-held-question`, run 1

The open question is retained completely: Ada is the source, return-delivery applicability remains unanswered, and neither coverage nor exclusion is established. All eight answers are non-null and preserve that scope. Phrases such as `active open question` describe record status and do not assert an ongoing physical action. No answer invents a decision or delivery.

### `v17-held-assistant`, run 1

Retention preserves the assistant's tentative, unverified assumption about checking the indicator twice yearly and the explicit lack of contract study or verification. All eight answers keep the generic assistant role localized in Russian, preserve the assumption rather than promoting it to contract fact, and keep `condition` in its contractual/rule sense rather than changing it to device state. I found no accepted error.

## Residual causes and bounded implications

The two genuine coverage losses have different causes:

1. The no-handover fact passed extraction and semantic verification but failed ownership because a source-backed cross-item antecedent remained `the device`. The ownership model's uncertainty was reasonable for the reduced representation it received; completeness was lost earlier when the unambiguous identity available in the full source was not propagated. A bounded remedy should resolve an unambiguous supplied-source antecedent across the complete structured source before generated ownership routing, while leaving ambiguous antecedents uncertain. It should preserve the booking actor as unassigned; resolving the device does not authorize assigning who would book it.
2. The undated answer null is verifier calibration, not missing evidence or a deterministic language/clock floor. The structured comparison should treat a localized temporal-status label as metadata presentation and reject it only when it changes acceptance, scheduling, or calendar certainty, rather than inferring a new deadline from the noun `срок` alone.

The accepted thermostat translation exposes a broader action-argument lexical-sense gap: translating an object-of-measurement phrase must not specialize what property is measured. This belongs in the existing source-versus-candidate action/purpose comparison, not the language-identity check. A bounded regression can establish that `измерение температуры термостата` is unsupported when the source names no measured property, without declaring broader operations such as checking, testing, or calibrating equivalent to measurement.

No evidence in these probes supports weakening attribution, booking, personal-nonselection, source-clock, or semantic-verification gates. The remaining uncertainty is limited to model semantics: traces expose the produced candidates and verdicts but not a hidden rationale for ownership beyond its explicit `uncertain` selection.
