# V40 exposed-probe forensic review

Reviewed only the completed selected and built V40 reports, their traces, and the two original-source/output packets. No fresh V19 held-out output exists or was inspected. Runtime and independent grades were not modified.

## Coverage and holds

- Selected: four writable cases, five retained records, 32/32 answers nonnull. There are no answer holds to classify.
- Built: two writable cases, two retained records, 16/16 answers nonnull. There are no answer holds to classify.
- All generation, language-check, answer-verifier, and ownership calls in these probes returned successfully. The only material hold is one generated retention candidate in `v18-held-rejected`.

## Selected cases

### `v18-held-report`, run 1

Both retained records follow the source. The main record preserves Ada Marlow as outer recorder, Bo Winters as inner reporter, permission to send the device to a technician for dial/regulator calibration, the exclusion of regulator replacement, and Ada's lack of firsthand terms or confirmation. The separate record preserves Ada's denial that she instructed collection. Metadata retains `source_report` for the nested report and `self_attested`/negated for the collection instruction.

All eight answers preserve the nested attribution and nonverification. `dial/regulator`, `шкала/регулятор`, technician wording, and natural report constructions are equivalent here. None promotes permission to a booking or completed shipment. I found no accepted content, role, qualification, or language error.

### `v18-held-rejected`, run 1

The saved plan faithfully preserves Ada's rejected offer to send Zephyr QX-100 to the service centre for thermostat measurement and her lack of a plan under that offer. Its asserted commitment, rejected disposition, affirmed embedded action, and lack of performance are coherent. All eight answers correctly identify the rejected offer; the shorter `ru -> en / inferred` answer may omit the redundant no-plan clause under the frozen focused-answer contract.

Retention is incomplete because the separate source proposition `No handover of the device has been booked` was lost. Extraction initially produced it together with the rejected-offer sentence as an asserted active negated event. The structural discourse floor held that mixed candidate because its frame also contained rejection scope. The single repair changed it to an asserted active negated claim but still combined the no-booking proposition with the rejected offer, so it did not survive cleaning; only original position 0 reached semantic verification. This is a false structural hold/composition failure, not a semantic reason to omit the no-booking denial. The new negative-booking temporal exception worked—no invented clock was demanded—but the mixed record's single discourse tuple could not represent both propositions. A later correction should make extraction/repair keep distinct propositions with their own metadata rather than weaken the rejection floor.

### `v18-held-undated`, run 1

Retention and all eight answers preserve the proposal, its asserted/proposed typing, tentative time status, lack of acceptance/meeting, the week-after-undated-original-record anchor, and unknown calendar week. No answer rebases the date to processing time. The new Russian `after an undated record` source-clock recognition and the proposed-versus-tentative-time distinction both worked. I found no accepted error.

### `v18-held-alternatives`, run 1

Retention preserves Ada's actual consideration of both competing explanations, both alternatives, common lack of evidence, tentative status, and nonselection. Six answers keep present consideration cleanly.

Two accepted answers shift the source's present `рассматриваю` / retained `is considering` to past imperfective wording:

- `en -> ru / explicit`: `Ada Marlow рассматривала ...`
- `ru -> en / explicit`: `Ada Marlow was considering ...`

Neither wording asserts completion, and the Russian query itself uses past `обсуждала`, so the practical inference is disputable. Still, present consideration is source content, while `record_scope.active` expressly denotes record validity rather than ongoing activity. The verifier accepted both by saying the past tense did not add resolution, without addressing the loss of current-time meaning. These should be recorded as a narrow temporal/activity weakening rather than treated as established faithful paraphrases. The remaining action roles, alternatives, uncertainty, evidence status, and nonselection are correct.

## Built cases

### `v17-held-question`, run 1

Retention and all eight answers preserve Ada's unanswered open question about return delivery after repairs and state that neither coverage nor exclusion is established. Neutral `recorded question` framing does not invent a separate recording act. No answer resolves the embedded question or invents delivery. I found no accepted error.

### `v17-held-assistant`, run 1

Retention preserves a tentative, preliminary, unverified assistant interpretation that servicing may include twice-yearly indicator checking, plus the assistant's lack of contract study or verification. It no longer translates the source's `условие` into a physical device `state`; all eight answers describe an assumption/report or servicing possibility. Generic assistant labels are localized in Russian. I found no accepted content, qualification, role, or language error. The V40 word-sense correction worked on this exposed reproduction.

## Overall assessment

V40's targeted fixes visibly improved the exposed paths: source-relative clock handling, proposal/time typing, neutral metadata definitions, booking-negation handling, ownership completion, and contract-condition sense all operated without an accepted promotion. The main remaining loss is upstream retention composition for a no-booking denial adjacent to a rejected offer. The only accepted-answer concern is the two alternatives answers' present-to-past activity shift; it is narrower than an actor, choice, or hypothesis-status error and should remain transparent as disputed temporal weakening.
