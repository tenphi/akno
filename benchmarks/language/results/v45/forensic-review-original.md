# V45 exposed-probe forensic review

Scope: frozen runtime `a0e0c89`; selected and built V45 reports, their traces, and the two original-source output packets. I did not read an independent grader receipt. All examples are invented.

## Outcome

- Selected probe: 4/4 writable cases retained, with 28/32 non-null answers. There were no provider, recall, context, routing, or retention availability failures. The four nulls were one deterministic attribution hold, one deterministic discourse hold, and two semantic-verifier holds.
- Built probe: 2/2 writable cases retained and 16/16 answers were non-null. I found no accepted source-meaning, attribution, qualification, or answer-language error in the built probe.
- V45's referent-clarification change worked on the previously exposed dial/regulator case: every accepted report answer says regulator calibration rather than scale calibration, retains the calibration-versus-replacement contrast, keeps Bo Winters as the inner reporter and Ada Marlow as the outer reporting source, and preserves Ada's lack of access and confirmation.
- I found one systematic accepted precision loss in the selected alternatives case, described below. Because the V13+ gate requires zero accepted source-entailment errors, and because selected answer production is 87.5%, these probes do not support starting the fresh V19 repeated trial yet.

## Retention audit

### `v18-held-report`, run 1

Both required records were written. The main record faithfully preserves permission to send the device to a technician for **regulator calibration, not regulator replacement**, along with Ada's relay role, Bo's inner-source role, and the lack of inspected terms or confirmation. The separate record preserves Ada's statement that she gave no collection instruction. Permission was not promoted to an arranged shipment.

### `v18-held-rejected`, run 1

Both records were written. The rejected offer retains Ada as the rejecting actor, the device, service-centre destination, thermostat-measurement purpose, absence of a plan under the offer, and rejected disposition. The independent no-booked-handover statement is retained separately. No completion or booking is asserted.

### `v18-held-undated`, run 1

The record was written and is faithful. Ada remains the proposer; the proposal remains unaccepted and the meeting unarranged. The source-relative anchor and unknown calendar week are explicit: “next week” is the week after the undated original record and cannot be resolved from processing time.

### `v18-held-alternatives`, run 1

The record preserves both alternatives, Ada's considering and nonselection roles, and the absence of evidence for either. It does, however, replace Russian `неплотно вставленный внутренний разъём` (a loosely/not-fully inserted internal connector) with `an improperly inserted internal connector`. “Improperly inserted” is broader and does not preserve the particular looseness/incomplete insertion described by the source. This is a source-specificity loss in the retained record, and seven accepted answers repeat it (`неправильно вставленный/установленный` or “improperly inserted”). The retained text was the sole answer evidence, so answer generation could not recover the original distinction. The semantic retention verifier accepted it despite the explicit every-clause/source-clarification contract.

## Selected answer holds

### `v18-held-report`, RU query → RU answer, inferred view

The draft was:

> Ada Marlow записала только неподтверждённое сообщение Bo Winters ...

It was stopped before semantic verification with `attribution: 1`. This is a false deterministic hold and a coverage loss. The wording says that Ada recorded Bo's unverified message, exactly the relationship requested by the source-grounded question; it does not make Ada the author of Bo's claim. The rest of the draft preserves regulator calibration, excludes replacement, and preserves Ada's lack of access and confirmation.

### `v18-held-rejected`, RU query → RU answer, inferred and explicit views

Both drafts said that Ada declined the offer to send the device to the service centre `для измерения параметров термостата`. They passed deterministic guards and were rejected by semantic verification (`semantic_support: 1`). On reconsideration, these are false semantic holds rather than clear specificity violations. `Параметры` is an unselected generic complement that makes “thermostat measurement” grammatical in Russian; it does not name a measured property such as temperature. The authored Russian query itself uses `измерении параметров термостата`, which confirms that this phrase is within the frozen source/query meaning. This differs from the prior unsupported `измерения температуры термостата`, where temperature selected a concrete property absent from the source. The evidence was adequate and writable, so each null is an answer-usefulness loss.

### `v18-held-alternatives`, EN query → RU answer, explicit view

The draft preserved two competing unproved hypotheses, lack of evidence, Ada as the person considering them, and Ada as the person who selected neither. It was stopped before semantic verification with `discourse: 1`. Relative to the already admitted evidence, this is a false deterministic hold. The concrete trigger is the otherwise faithful spaced morphology `пока не доказанные гипотезы`, which the bounded tentative-language floor did not recognize. It also repeats the upstream `неправильно вставлен` specificity loss, so it would not be fully source-faithful even if admitted; the discourse rejection itself did not diagnose that source mismatch.

## Accepted-answer audit

- Report: the seven accepted answers are faithful and qualified. Narrative past tense is ordinary backshift and does not create a date or imply the service terms were verified. No answer repeats V44's scale-calibration error.
- Rejected offer: the six accepted answers preserve Ada's rejection and the offer's object, destination, and thermostat-measurement purpose. Several focused answers omit the no-plan clause, which the authored expectation expressly permits for this query. None asserts a booking, shipment, or completed measurement.
- Undated proposal: all eight answers preserve Ada as proposer, unaccepted status, no meeting, source-relative “next week,” and unknown calendar resolution. `на предварительный срок` is awkward Russian in one row, but in its full sentence it does not add a concrete period or replace the explicitly stated next-week/undated-source relation.
- Alternatives: agency, both hypotheses, shared lack of evidence, and personal nonselection are otherwise preserved in the seven accepted answers. Their connector wording inherits the retained specificity loss described above.
- Built question: all eight answers describe Ada's unresolved question and preserve that neither coverage nor exclusion of post-repair return delivery is established. They do not answer the embedded question or invent a delivery arrangement.
- Built assistant: all eight answers retain generic-assistant attribution, tentative/unverified modality, possible twice-yearly indicator checks, no contract study or verification, and the distinction from a verified contractual condition. Russian role labels are localized.

## Readiness assessment

The probes demonstrate that the V45 clarification language repaired the exposed regulator/scale mistranslation and that the built regression pair is stable. They also expose two distinct remaining constraints relevant to a fresh full trial: selected answer production is 28/32 (87.5%, below the 90% target), and the alternatives record has an accepted source-specificity error that would violate the gate's zero-unsupported-output condition if independently judged the same way.

The smallest coherent next scope is to make the existing source-versus-candidate comparison enforce explicitly described physical/property qualifiers such as degree or manner (`loosely` versus generic `improperly`) while distinguishing them from grammar-neutral generic complements such as Russian `параметры` when no particular property is selected. This should be a semantic comparison instruction, not a connector or thermostat vocabulary rule. The faithful deterministic holds also show that attribution/discourse lexical floors still reject legitimate record-language paraphrases; any correction should remain bounded to source-backed recorder/report and typed tentative-hypothesis constructions and should continue through the unchanged semantic verifier. No additional retry, model, threshold, or gate change is supported by this evidence.
