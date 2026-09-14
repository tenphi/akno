# V37 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. Runtime outputs were compared against the invented source rather than accepted from runtime verdicts. No fresh v18 held-out output was inspected.

## Built-package probe

The built probe retained both cases and produced 16/16 answers. I found no accepted disclosure, factual promotion, source-content change, action-role error, qualification loss, or translation-language error.

### Typed open-question scope

Retention preserves Ada Marlow's open question about whether the Zephyr QX-100 agreement includes return delivery after repairs and explicitly states that neither coverage nor exclusion is established. All eight answers keep that proposition inside question/non-establishment scope. None asserts that return delivery is covered or excluded.

The two V36 false protected-value holds now pass the deterministic floor and full semantic verifier. English `whether ... covered or excluded ... not established` and the Russian `включает/предусматривает ... или исключает` alternatives remain unresolved rather than becoming predicate denials. Exact `QX-100` survives unchanged. The trace shows no separate asserted exclusion hidden behind the normalized clause.

The raw extraction initially includes Ada in both outer attribution and a same-identity chain entry; final retained review material exposes the authoritative user/Ada source without a duplicated nested reporter. No answer invents a recorder action by Ada: each uses neutral `recorded open question attributed to` / `В записи содержится открытый вопрос` provenance.

### Canonical outer attribution and status presentation

Retention preserves the assistant's preliminary, unverified possibility that service may include twice-yearly indicator checking, plus lack of contract study and verification. All eight answers use direct outer attribution (`According to the assistant` / `По словам ассистента`) or an immediately equivalent direct assistant clause. The possible action, frequency, and verification limits remain within that source scope.

Russian answers translate the generic role and status prose. None copies English enum labels, turns the report into an established condition, or states that twice-yearly checking actually occurs. The generator-facing display labels introduce no observed speech-act drift. Verifier and public evidence retain original typed status authority.

### Residual holds

There are no nulls or rejected drafts in the completed built probe. The prior possessive `assistant's ... reading` lexical miss is avoided by canonical direct attribution rather than a widened reading-noun exception.

## Selected probe

The selected probe retained 7 of 8 generated candidates and returned 28 of 32 answers. The four nulls are two deterministic source-clock false holds and two semantic-verifier false rejections. I found one material error among the accepted answers. The other accepted answers preserve the invented source meaning and qualification.

### Nested report and no-shipment denial

The canonical reporting construction works consistently. The retained report keeps Bo Winters as the inner speaker, Ada Marlow as relay, the permission to send the device away for hinge-resistance measurement rather than hinge replacement, and Ada's lack of reading or confirmation. All eight answers preserve those roles and limits with `According to Ada Marlow` / `По словам Ada Marlow` constructions. I found no attribution hold or accepted role error.

The separate no-shipment candidate was generated as `Ada Marlow has arranged no shipment of the Zephyr QX-100.` Its exact source is Ada's `I have arranged no shipment.` The retention verifier rejected it because the source does not name an object while the candidate restricts the denial to Zephyr. That rejection is conservative and semantically disputed: a universal assertion that Ada arranged no shipment entails the narrower claim that she arranged no shipment of Zephyr in ordinary first-order scope. It does not resemble adding an object to a positive event. The generated candidate nevertheless needlessly inserted the neighboring product, and the result loses a material explicit denial required by the case. This remains an upstream generation/ownership problem, with the verifier choosing the strict reading rather than an unsafe acceptance.

### Rejected offer

Retention now preserves the actor and lifecycle exactly: `Ada Marlow rejected the offer ... and sending it is not her plan.` The second retained record says collection has not been booked. All eight answers correctly identify Ada as the person who rejected the offer and keep the workshop, power-switch inspection, and rejected disposition. No answer turns the declined offer into a plan or shipment. This is a clean correction of the V36 passive-agent loss.

### Undated proposal

Retention is complete: next month is measured from the undated note rather than processing time, the calendar month is unknowable, and no plan or meeting was accepted or arranged. Six answers pass and preserve those constraints. The two deterministic `discourse` holds are faithful drafts rejected by narrow source-clock syntax:

- `...в следующем месяце относительно недатированной заметки; месяц календарно определить нельзя...` contains a valid source anchor and unknown calendar month. `hasUnknownReferenceClock` recognizes `календарный месяц ... определить нельзя`, but not the equally clear reversed wording `месяц календарно определить нельзя`.
- `...в следующем месяце — отсчитывая его от недатированной записи, при этом календарный месяц определить нельзя...` preserves the same relation. `hasSourceRelativeAnchor` recognizes `отсчитывая от`, but its pattern does not allow the pronoun in `отсчитывая его от`.

The semantic verifier separately rejects `She had not accepted a plan` as an unsupported temporal shift from source `has not accepted`. In this answer, past perfect is ordinary backshift while describing the recorded proposal; it does not establish an earlier cutoff or materially alter the ongoing non-acceptance. This is a false semantic rejection. All three nulls are therefore guard/verifier calibration losses, not bad generated answers.

### Competing hypotheses

Retention preserves two preliminary competing hypotheses, neither supported by evidence, with Ada having chosen no cause. Seven answers pass. The remaining English draft says `The evidence says there was supporting evidence for neither`. That wording is awkward, but in an evidence-grounded answer it means the cited record indicates the absence of support; it does not install “the evidence” as a new human reporter. The verifier's attribution mismatch is a false rejection.

One accepted Russian answer has a real agency loss: `По её словам ... причину ещё не выбрали` uses an indefinite-personal plural (“they have not yet chosen the cause”), whereas the source specifically says Ada herself had not chosen it. `По её словам` attributes the statement to Ada but does not make Ada the grammatical agent of `не выбрали`. This broadens the possible actor and should be counted as an action-argument/source-content error. By contrast, passive `причина не выбрана` merely omits the actor and can be a source-entailed weaker statement when the question only needs unresolved status; it should not automatically be treated as introducing a group actor.

### Cross-cutting diagnosis

V37 fixed the exposed canonical attribution, rejected-offer actor, question scope, and English `preliminary hypotheses` floor. The remaining production holds are not dominated by missing vocabulary: two are small syntax gaps in an otherwise sound source-clock invariant, and two are semantic-verifier overreadings of natural backshift or evidence-summary wording. The accepted Russian plural shows the complementary gap: action-agent comparison did not catch a genuine shift from named first-person nonselection to an unspecified plural actor.

The selected evidence does not justify weakening semantic verification or adding retries. A bounded follow-up, if one is made before a full trial, should preserve exact source agents in generated action clauses and add contrastive verifier examples for named-agent versus passive/indefinite-personal renderings. The clock helper can safely recognize the two observed compositional Russian orders with nearby negative controls. Verifier calibration should ask whether tense or record-introduction wording changes the actual temporal proposition or actor, rather than treating grammatical backshift and `the evidence says` as mismatches by themselves.
