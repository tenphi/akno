# V46 selected-probe forensic review

Scope: `bench-results/language-selected-v46.json`, its trace, and `tmp/language-selected-output-packet-v46.json`, reviewed directly against the invented original sources. I did not read independent grading. I made no runtime changes or live calls.

## Result

- Retention: all four writable cases produced their complete expected record sets: 2 + 2 + 1 + 1 written candidates. There were no retention holds, repairs, routing failures, degradations or availability failures.
- Retrieval: every row had the relevant retained record available.
- Answers: 28/32 rows produced a non-null, guard-passing and semantic-verifier-passing answer. All four nulls are in `v18-held-undated`: three correct deterministic attribution/agency holds and one false deterministic discourse/source-clock hold. There were no provider or semantic-verifier availability failures.
- I found no accepted unsupported proposition, changed actor/speaker, qualification promotion, polarity error, answer-language error or protected-value error in the selected answers.

## Retention and accepted-answer audit

### `v18-held-report`, run 1

Both records are complete. The main record keeps Ada Marlow as outer relaying source, Bo Winters as inner reporter, service-term permission to send the device to a technician, regulator calibration rather than regulator replacement, and Ada's lack of access to the terms or confirmation. The second record separately preserves Ada's statement that she gave no collection instruction. Permission is not promoted to booking or shipment.

All eight answers preserve these boundaries. V45/V46's source-clarification policy succeeds: no accepted answer calls the component a scale or dial distinct from the source-clarified regulator. `Якобы сказал/сообщил` can sometimes sound more skeptical than neutral “reportedly,” but here it remains within the expressly unverified report and does not change Bo's embedded assertion or Ada's verification limits.

One English explicit-view answer is marked `partial` despite a fully supported, guard-passing and verifier-passing block. That is control-level missing coverage rather than an answer defect; the answer contains the complete focused report and the V46 static-note boundary prevents unverified missing labels from appearing publicly.

### `v18-held-rejected`, run 1

Both records are complete: the rejected offer binds Ada as rejecting actor and preserves device, destination, thermostat-measurement purpose, absence of a plan under that offer, and rejected/nonaccepted status; the second record independently preserves that no device handover was booked.

All eight answers faithfully identify the focused declined offer. The two Russian `измерения параметров термостата` answers use a grammar-neutral generic complement and do not select a concrete measured property; this is consistent with the frozen Russian query and differs from the unsupported temperature specialization seen previously. Focused answers may omit the no-plan and no-booking details under the authored expectation. Four rows are reported as `partial` from coverage control data, with no rejected or unsupported answer block.

### `v18-held-undated`, run 1

Retention is complete and accurate. It binds Ada as proposer, preserves unaccepted status and no arranged meeting, and states that “next week” is relative to the undated original record and cannot be resolved from processing time.

The four accepted answers preserve Ada as proposer, tentative timing, the original-record anchor, unknown calendar week, unaccepted proposal and absent meeting. Narrative backshift in one English row does not introduce a historical date. The Russian `Срок был предварительным` describes the typed tentative timing without making the proposal accepted or scheduled.

Four rows are null; exact causes are below.

### `v18-held-alternatives`, run 1

Retention repairs the V45 completeness loss: the connector is now `loosely seated`, preserving source `неплотно вставленный`, rather than the broader “improperly inserted.” It keeps both competing hypotheses, Ada's ongoing consideration, no evidence for either, and Ada personally selecting neither explanation.

All eight answers preserve that same mechanism, both alternatives, shared lack of evidence and Ada's personal nonselection. English and Russian wording remains tentative/unconfirmed and does not establish either cause. Four rows are `partial` only at the coverage-control level; their blocks all pass guards and semantic verification and contain the focused answer.

## Exact null analysis: `v18-held-undated`

### EN query → RU answer, inferred view

Draft: `По словам Ada Marlow, было предложено ...`

Rejected before semantic verification with `attribution: 1`. The hold is correct. Outer attribution to Ada does not make Ada the proposer; passive `было предложено` omits the source-supported proposal actor.

### EN query → RU answer, explicit view

Draft again begins `По словам Ada Marlow, было предложено ...` and was rejected with `attribution: 1`. This is the same correct actor-presence hold. The rest of the draft preserves time and status, but cannot compensate for missing proposer agency.

### RU query → EN answer, inferred view

Draft: `According to Ada Marlow, the tentative proposal was to review ...`

Rejected with `attribution: 1`. This hold is also correct. It names Ada only as outer source and describes proposal content passively; it does not say that Ada proposed the review. The question's wording is not evidence for that missing action.

### RU query → RU answer, inferred view

Draft: `Ada Marlow предложила ... на неделе после исходной записи без известной календарной даты ...`

Rejected before semantic verification with `discourse: 1`. This is a false deterministic hold. The draft explicitly binds Ada as proposer, keeps proposed/unaccepted status and no meeting, and says the relative week follows the original record `без известной календарной даты`. That phrase faithfully expresses an unknown source calendar clock, but `hasUnknownReferenceClock` recognizes `без даты`, `дата ... неизвестна` and related bounded forms, not `без известной календарной даты`. The source-relative qualification is present in meaning; the lexical floor misses it.

All four nulls are answer-coverage losses because writable adequate evidence existed. The first three correctly stop unsupported drafts; the fourth incorrectly stops a faithful draft.

## Combined bounded next scope

V46 fixes the exposed regulator sense, generic measurement complement, unproven-hypothesis floor and loose-connector completeness problems. The remaining selected losses and the corrected built finding support a small coherent scope rather than broader retry or verifier relaxation:

1. Keep the proposer agency floor unchanged, but strengthen generation's canonical source-supported actor wording so a named proposer is expressed with the proposing verb, instead of `According to Ada, the proposal was...` / `По словам Ada, было предложено...`.
2. Extend the existing bounded unknown-source-clock grammar to accept source-linked `без известной календарной даты` (and a contrastive negative where an unrelated object lacks a date), then still require full semantic verification.
3. Clarify in generation and the existing semantic comparison that an unresolved question about whether an agreement includes something does not establish that the agreement's terms themselves are silent or inconclusive. This addresses the accepted built RU clause `условиями соглашения не установлены` without forbidding neutral “neither is established.”

These changes need no new call, retry, schema, model, verdict dimension, threshold or gate. The selected answer rate is 28/32 (87.5%), and the built probe has one accepted source-scope error. On the combined evidence, V46 should remain preserved as an exposed probe and should not consume the fresh V19 held-out corpus.
