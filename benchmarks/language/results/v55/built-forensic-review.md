# V55 built-package forensic audit

## Scope and method

This is an independent source-first audit of frozen V55 at `ee9cc85`. I compared the complete original invented inputs in [the V19 blind-input packet](language-v19-blind-inputs.json#L7) with the finalized retained records and answers in [the V55 output packet](language-built-output-packet-v55.json), then used [the reliability report](built-reliability.json#L54) and [raw trace](../../../../bench-results/language-built-reliability-v55-trace.jsonl) to identify the actual retention and answer mechanisms. I did not inspect the independent output-grading receipt, call a provider, retry a row, or edit runtime code.

Coordinates use the fixed order:

| q | Query | Answer | View |
|---:|---|---|---|
| 0 | EN | EN | inferred |
| 1 | EN | RU | inferred |
| 2 | EN | EN | explicit |
| 3 | EN | RU | explicit |
| 4 | RU | EN | inferred |
| 5 | RU | RU | inferred |
| 6 | RU | EN | explicit |
| 7 | RU | RU | explicit |

## Final disposition

V55 produced 23/32 non-null answers. The nine nulls comprise eight `draft_rejected` rows and one `verification_rejected` row. All nine are unjustified **case-level** abstentions under the useful-answer contract because every original source offers a faithful answer. Several individual bad drafts were correctly held; that is distinct from the failure to generate a usable alternative.

There were no answer-operation failures, malformed structured responses, stale/foreign anchor acceptances, or source-byte changes. One of four cases had a retention availability failure: the rejected-offer case lost the independent no-handover record during validation/repair. The three other cases retained complete useful sets; the rejected-offer set remained useful for the asked offer but was incomplete against the original source.

I found no definite false proposition among the 23 accepted answers. I did find two accepted-contract defects:

1. All six accepted question answers add the personal act “Ada Marlow recorded/записала” from the private original frame even though the retained excerpt does not select that act. They are original-source-entailed and useful, but they violate the explicit retained-excerpt/source-authority boundary.
2. Report q5 uses the deliberately ambiguous Russian construction `передавшей сообщение Bo Winters`, which does not clearly distinguish Bo Winters as message source from an indeclinable recipient. I treat this as one accepted actor/qualification-language defect, while recording the natural genitive reading below.

## Retention and availability

### Report — complete, 2 records

The retained main record preserves Ada Marlow as outer source, Bo Winters as inner reporter, the permission to send the device to a technician for regulator calibration rather than replacement, and both of Ada's personal limits. The second record independently preserves that Ada gave no collection instruction. See [packet lines 39 onward](language-built-output-packet-v55.json#L39). The retention verifier correctly read the Russian passage as an explicit clarification of the earlier English `dial calibration` term. [Trace L2–L3](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L2)

### Question — complete, 1 record

The record preserves Ada's unresolved service-agreement question, Ada's personal lack of an answer, and the note's separate failure to establish inclusion or exclusion. It deliberately renders neutral ownership as `Ada Marlow's unresolved question`; the retained text does **not** say Ada performed a recording act. See [packet line 320](language-built-output-packet-v55.json#L320). [Trace L28–L29](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L28)

### Rejected offer — partial, 1 of 2 material records

The written plan record faithfully preserves the rejected offer, complete shipment purpose, nonacceptance, and Ada's no-plan state. The independent assertion `No handover of the device has been booked` was omitted from the final retained set. See [original source](language-v19-blind-inputs.json#L197) and [retained packet line 583](language-built-output-packet-v55.json#L583).

The exact cause is visible at [trace L54–L57](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L54):

- extraction produced both a correct rejected plan and a separate negated active claim for no booked handover;
- validation admitted the plan but held the no-handover claim as `discourse_uncertain`, because its full discourse frame also contained the independent sentence `The offered shipment was rejected, not accepted` and the broad unsafe-discourse check treated that adjacent rejection as governing the canonical claim;
- the repair call returned another copy of the rejected plan at candidate position 1 instead of repairing the no-handover proposition;
- repair-obligation validation correctly rejected that sibling substitution, retained the already admitted plan, and reported typed `derive_failed` degradation with a validation hold.

This is correct fail-closed repair behavior after an overly broad initial validation decision. The report's `usefulRetentionCoverage: 3/3` excludes the unavailable case from its denominator; source-first across all four cases, three sets are complete and one is useful but incomplete.

### Alternatives — complete, 1 record

The retained record preserves Ada as the person considering the two alternatives, loose insertion of the internal connector, the faulty temperature probe, lack of evidence for each, and Ada's personal nonselection. The specific seating/engagement mechanism is intact; no generic incorrect-installation wording appears. See [packet line 840](language-built-output-packet-v55.json#L840). [Trace L82–L83](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L82)

## Immutable anchor and private-context audit

All 24 submitted answer-verifier calls used ordered, server-assigned source and answer segment tables. Concatenating the tables reconstructs the complete archived source frame and current answer block. Every returned actor, object/mechanism, and qualification anchor belongs to the current block and the cited record. I found no unknown, stale, cross-record, cross-block, copied-paraphrase, or missing anchor accepted by local validation. Twenty-three verifier calls returned all three category relations `preserved`, all aggregate booleans true, and excerpt selection true. Report q1 returned an internally consistent negative actor relation and was withheld.

The model-authored `source_context` remains fallible scratch output. Two of 24 contexts hit exactly the 240-character maximum and ended with junk characters:

- report q1 at [trace L10](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L10) ends in a zero-width space and nonbreaking space, while several 160-character details stop mid-sentence;
- question q2 at [trace L38](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L38) ends in `·清`.

Both responses are complete schema-valid JSON, not transport truncations. The first is a negative verdict. The second answer is source-faithful and its anchors, category details, aggregate comparison, and booleans remain coherent, so the private corrupt suffix did not become public evidence or cause an accepted source error. It does show why `source_context` cannot be treated as an authoritative receipt.

## All 23 non-null answers

All rows include the expected rendered memory citation in the packet. The table quotes the substantive answer body.

### Report: 4/8 non-null

| q | Answer | Finding |
|---:|---|---|
| 3 | “По словам Ada Marlow, Bo Winters сообщил, что условия обслуживания Zephyr QX-100 разрешают отправить устройство техническому специалисту для калибровки регулятора, а не для замены регулятора. Ada Marlow лишь передаёт эти слова; она не видела сами условия и не получила подтверждения этому сообщению.” | Faithful and explicit about both reporter layers, the clarification, contrast, and personal limits. [Packet](language-built-output-packet-v55.json#L178) |
| 4 | “According to Ada Marlow, Bo Winters said that the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not regulator replacement. Ada had not seen the terms herself or received confirmation of this message.” | Faithful. [Packet](language-built-output-packet-v55.json#L204) |
| 5 | “По словам Ada Marlow, передавшей сообщение Bo Winters, условия обслуживания Zephyr QX-100 якобы разрешают отправить устройство технику для калибровки регулятора, а не для его замены. Ada Marlow не видела сами условия и не получила подтверждения этого сообщения.” | Content and qualifications are otherwise faithful, but `передавшей сообщение Bo Winters` can mean transmitting Bo's message or transmitting a message to Bo because the name is indeclinable. It never directly says `Bo Winters сообщил`/`слова Bo Winters`. I classify the obscured inner-reporter role as an actor/qualification-language defect. The plausible genitive reading is why this is ambiguity rather than a definite reversed-role proposition. [Packet](language-built-output-packet-v55.json#L230) |
| 7 | “По словам Bo Winters, условия обслуживания Zephyr QX-100 разрешают отправить устройство техническому специалисту для калибровки регулятора, а не для замены регулятора. Ada Marlow лишь передала эти слова; она не видела сами условия и не получила подтверждения сообщения.” | Faithful: Bo is directly the reported source and Ada's outer relay/personal limits remain explicit. [Packet](language-built-output-packet-v55.json#L282) |

No accepted report turns permission into a booking, collection, verified term, or replacement.

### Question: 6/8 non-null

| q | Answer | Finding |
|---:|---|---|
| 0 | “Ada Marlow recorded the unresolved question of whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter. She still has no answer, and the note establishes neither inclusion nor exclusion of that cleaning.” | Original-source faithful, including the two distinct epistemic subjects; retained-selection violation for the personal recording act. [Packet](language-built-output-packet-v55.json#L363) |
| 2 | Same English answer as q0. | Same finding. [Packet](language-built-output-packet-v55.json#L415) |
| 4 | Same English answer as q0. | Same finding. [Packet](language-built-output-packet-v55.json#L467) |
| 5 | “Ada Marlow записала нерешённый вопрос о том, включает ли сервисное соглашение для Zephyr QX-100 профилактическую чистку фильтра. У неё по-прежнему нет ответа, и эта запись не устанавливает ни включение, ни исключение такой чистки.” | Original-source faithful; `У неё` keeps Ada's lack of an answer distinct from the record-level clause. Retained-selection violation for `записала`. [Packet](language-built-output-packet-v55.json#L493) |
| 6 | Same English answer as q0. | Same finding. [Packet](language-built-output-packet-v55.json#L519) |
| 7 | “Ada Marlow записала нерешённый вопрос о том, включает ли сервисное соглашение для Zephyr QX-100 профилактическую чистку фильтра. У неё по-прежнему нет ответа, и запись не устанавливает ни включение, ни исключение этой чистки.” | Original-source faithful with explicit personal and record subjects; retained-selection violation for `записала`. [Packet](language-built-output-packet-v55.json#L545) |

These rows do not exhibit the V54 local-ellipsis concern: each accepted RU answer says `У неё по-прежнему нет ответа`, so the personal epistemic subject is explicit. The defect is different: all six take `recorded/записала` from the private frame. Their verifiers mark `selected_by_retained_excerpt: true` even though the retained excerpt only says the unresolved question is Ada's. The question's presupposition cannot supply the action. This is a selection/source-authority failure, even though source-only answer grading can correctly find each answer entailed by the complete original source.

### Rejected offer: 6/8 non-null

| q | Answer | Finding |
|---:|---|---|
| 0 | “Ada Marlow declined the offer to send Zephyr QX-100 to the service centre for a thermostat measurement. She rejected the shipment rather than accepting it and had no plan to send it under that offer.” | Faithful same-event rejection, with Ada's no-plan subject preserved. [Packet](language-built-output-packet-v55.json#L626) |
| 2 | “Ada Marlow declined the offer to send Zephyr QX-100 to the service centre for a thermostat measurement; the shipment was rejected rather than accepted, and she had no plan to send it under that offer.” | Faithful; the passive rejection refers to the same offer Ada just declined. [Packet](language-built-output-packet-v55.json#L678) |
| 4 | “Ada Marlow declined the offer to send Zephyr QX-100 to the service centre for a thermostat measurement; the offered shipment was rejected rather than accepted.” | Faithful focused subset. [Packet](language-built-output-packet-v55.json#L730) |
| 5 | “Ada Marlow отклонила предложение отправить Zephyr QX-100 в сервисный центр для измерения параметров термостата; предложенная отправка не была принята.” | Faithful same-event nonacceptance. `параметров` is a generic measurement complement and does not invent a particular property. [Packet](language-built-output-packet-v55.json#L756) |
| 6 | “Ada Marlow declined the offer to send Zephyr QX-100 to the service centre for a thermostat measurement.” | Faithful focused answer; the authored contract permits rejection without restating no plan. [Packet](language-built-output-packet-v55.json#L782) |
| 7 | “Ada Marlow отклонила предложение отправить Zephyr QX-100 в сервисный центр для измерения параметров термостата.” | Faithful focused answer. [Packet](language-built-output-packet-v55.json#L808) |

The missing no-handover record is a retained-set omission. It does not make these focused offer answers false, and none claims a booking, accepted plan, completed measurement, or collection.

### Alternatives: 7/8 non-null

| q | Answer | Finding |
|---:|---|---|
| 0 | “Ada Marlow was considering two competing tentative explanations for Zephyr QX-100 failures: a loosely inserted internal connector or a faulty temperature probe. Neither explanation had evidence, and she had selected neither cause.” | Faithful. Past tense is ordinary narrative backshift in the same undated record, not a resolution endpoint. [Packet](language-built-output-packet-v55.json#L883) |
| 2 | “Ada Marlow is considering two competing tentative explanations for Zephyr QX-100 failures: a loosely inserted internal connector or a faulty temperature probe. Neither explanation has evidence, and she has selected neither cause.” | Faithful. [Packet](language-built-output-packet-v55.json#L935) |
| 3 | “Ada Marlow рассматривает две конкурирующие предварительные версии сбоев Zephyr QX-100: неплотно вставленный внутренний разъём и неисправный температурный зонд. Доказательств нет ни для одной версии, и она не выбрала ни одну причину.” | Faithful. `и` enumerates two alternatives under explicit competing/unestablished framing; it does not assert both as causes. [Packet](language-built-output-packet-v55.json#L961) |
| 4 | Same English answer as q0. | Faithful narrative backshift. [Packet](language-built-output-packet-v55.json#L987) |
| 5 | “Ada Marlow рассматривает две конкурирующие предварительные гипотезы о сбоях Zephyr QX-100: неплотно вставленный внутренний разъём и неисправный температурный зонд. Доказательств нет ни для одной из них, и ни одну причину она не выбрала.” | Faithful. [Packet](language-built-output-packet-v55.json#L1013) |
| 6 | Same English answer as q2. | Faithful. [Packet](language-built-output-packet-v55.json#L1039) |
| 7 | “Ada Marlow рассматривает две конкурирующие предварительные гипотезы о сбоях Zephyr QX-100: неплотно вставленный внутренний разъём и неисправный температурный зонд. Для обеих гипотез нет доказательств, и она не выбрала ни одну из причин.” | Faithful. [Packet](language-built-output-packet-v55.json#L1065) |

All preserve the specific loose insertion mechanism, both alternatives, shared lack of evidence, and Ada's personal nonselection.

## All nine nulls

| Case/q | Generated draft | Runtime cause | Draft/case disposition |
|---|---|---|---|
| report/0 | “Ada Marlow transmitted Bo Winters’s unverified report ... for calibration rather than replacement ...; the report does not consistently identify whether the calibration concerns the dial or the regulator.” | Guard rejects `attribution` before verification because `transmitted` is not recognized as the outer reporting relation. [Trace L7](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L7) | The hold is safe because the final metaclaim is false: the Russian span explicitly clarifies the regulator referent. A faithful answer was available, so case abstention remains unjustified. |
| report/1 | “Ada Marlow передала сообщение Bo Winters о том, что ... калибровки регулятора, а не ... замены ... Она ... не видела ... и не получила подтверждения.” | Verifier returns actor `changed`, aggregate proposition/action false, and selection false, reading indeclinable `Bo Winters` as the recipient of Ada's transmission. All anchors are current and exact. [Trace L9–L10](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L9) | Correct conservative rejection of an actor-ambiguous draft; the source supports a direct `Bo Winters сообщил` answer, so case abstention is unjustified. |
| report/2 | “According to Bo Winters, ... regulator calibration, not regulator replacement. Ada Marlow only transmitted Bo’s words and had not examined the terms or received confirmation ...” | Guard rejects `attribution` before verification: the outer Ada relation uses `transmitted`, outside the bounded reporter grammar. [Trace L12](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L12) | Draft is source-faithful; false deterministic hold. Its incorrect `missing_concepts` note about a specifically dial-calibration report does not enter public output. |
| report/6 | “According to Bo Winters, ... regulator calibration, not regulator replacement. Ada Marlow transmitted this report but had not seen the terms ... or received confirmation ...” | Same pre-verifier `attribution` rejection. [Trace L23](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L23) | Source-faithful draft; false deterministic hold. |
| question/1 | “Ада Марлоу записала нерешённый вопрос ... У неё ... нет ответа, а запись не устанавливает ...” | Guard rejects `attribution` before verification because the proper name was transliterated rather than preserved as exact `Ada Marlow`. [Trace L35](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L35) | Correct bad-draft hold; the draft also imports the recording act from the private frame. A faithful exact-name, neutral-provenance answer was available. |
| question/3 | “Ада Марлоу записала нерешённый вопрос ...” | Same exact-name/attribution guard rejection. [Trace L40](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L40) | Correct bad-draft hold and unjustified case abstention. |
| rejected/1 | “Ада Марлоу отклонила предложение ... По этому предложению она не планировала ...” | Pre-verifier `attribution` rejection because `Ada Marlow` was transliterated. [Trace L63](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L63) | Correct name-preservation hold; faithful answer with exact name was available. |
| rejected/3 | “Ада Марлоу отклонила предложение ... Предложение ... было отклонено ... и у неё нет плана ...” | Same exact-name/attribution rejection. [Trace L68](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L68) | Correct bad-draft hold and unjustified case abstention. |
| alternatives/1 | “Ада Марлоу рассматривает две ... версии ... Доказательств нет ... и Ада не выбрала ...” | Pre-verifier `attribution` rejection because both full and shortened personal names are transliterated. [Trace L89](../../../../bench-results/language-built-reliability-v55-trace.jsonl#L89) | Correct name-preservation hold; faithful exact-name answer was available. |

The report q1 rejection is the only `verification_rejected` row. The other eight are guard rejections and therefore have `verified_blocks: null`, which means verification never ran rather than that the semantic verifier returned false.

## Budget, transport, and retries

The run explicitly used 2,400 output tokens for both answer and retention roles. All 107 trace rows have `ok: true` and `schemaError: false`. Every one of the 24 answer-verifier responses is complete strict JSON with valid current coordinate membership. There is no provider/schema transport failure or terminal truncation.

The 32 answer-generation calls used 9,994 output tokens total (mean 312, maximum 556). The 24 answer-verifier calls used 14,041 (mean 585, maximum 1,063). One verifier exceeded 1,024 output tokens, so the explicit 2,400 diagnostic ceiling was operationally material. This run does not establish the same availability under the service's separate 1,024-token overlay.

Call count remained one generation call and at most one verifier call per row. The rejected-offer retention repair was the configured single structural repair, not a semantic retry. No rejected semantic answer was resubmitted.

## Bounded fixes supported by this evidence

1. **Restore direct inner-reporter wording for indeclinable names.** The consolidated generation prompt dropped the earlier concrete warning against `передала сообщение INNER`. Require `INNER said/reported` or `слова INNER`/`INNER сообщил` when the source names an inner reporter. This directly addresses report q1 and the accepted q5 ambiguity without an alias dictionary, new pass, or weaker verifier.
2. **Recognize bounded outer relay verbs.** Extend the existing outer-reporter grammar only for direct constructions such as `Ada transmitted/relayed Bo's words/report`, while preserving actor binding and the named inner reporter. This admits report q2/q6 to mandatory verification. It must not treat `transmitted a device/data` or an unbound name as reporting.
3. **Enforce retained selection for personal recording acts.** A bounded pre-verifier guard can reject subject-bound `SOURCE recorded/wrote/записал(а)` when that act is absent from the cited retained excerpt, while continuing to allow neutral provenance such as “Ada's recorded question” where it does not assert Ada performed the recording. The original frame and question must not satisfy this check. This closes the six accepted selection violations even when the fallible excerpt-selection model says true.
4. **Scope canonical-discourse validation to the selected support.** For a generated negated active claim whose exact support is a standalone leading denial and contains no unsafe discourse, do not let an independent rejection token elsewhere in its wider frame force a noncanonical hold. Still submit the whole frame to semantic verification and keep all existing rejection/hypothesis checks when they govern the support. This narrowly restores the no-handover candidate without accepting a rejected plan as active fact.
5. **Keep `source_context` non-authoritative.** The two max-length corrupt suffixes do not justify a new pass or acceptance relaxation. If diagnostics need readable scratch text, ask for shorter context or reserve modest headroom; acceptance must continue to depend on the complete frame/block, current anchors, category relations, aggregate dimensions, and selection.

No evidence here supports weakening exact-name preservation, anchor membership, negative relations, semantic dimensions, thresholds, or retry policy. The immutable references fixed the V54 copied-source-anchor failure class; the remaining defects are source-role wording, retained-selection enforcement, and one overly broad retention validation boundary.
