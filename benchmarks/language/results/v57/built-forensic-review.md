# V57 built-package forensic review

## Scope and method

This is an independent, source-first review of frozen V57 (`12ba420`). I read the four original development cases in [language-v19-blind-inputs.json](language-v19-blind-inputs.json), the published evidence and answers in [language-built-output-packet-v57.json](language-built-output-packet-v57.json), the runtime report in [language-built-reliability-v57.json](built-reliability.json), and the 105 model trace records in [language-built-reliability-v57-trace.jsonl](../../../../bench-results/language-built-reliability-v57-trace.jsonl). I did not read an independent grading receipt.

Coordinates below use the fixed query order `q1` EN→EN inferred, `q2` EN→RU inferred, `q3` EN→EN explicit, `q4` EN→RU explicit, `q5` RU→EN inferred, `q6` RU→RU inferred, `q7` RU→EN explicit, and `q8` RU→RU explicit. “Trace row” means the one-based JSONL row.

## Disposition

V57 published 19 of 32 answers. In my reading, all 19 published answers preserve the source proposition, actor, status, and requested language; I found no definite accepted source, qualification, or language error. There are 13 nulls, and all 13 are unjustified at the *case* level because each original source supports a faithful answer to the query. That does not mean every rejected draft was safe: the wrong-language rendering and altered connector candidate were correctly kept out. The two rejected-plan semantic holds are false under the frozen collective visible-excerpt contract, as discussed below.

The nulls divide as follows:

| Cause | Coordinates | Count | Draft-level assessment |
| --- | --- | ---: | --- |
| Empty rendering choice after a wrong source reading | report q1 | 1 | Incorrect abstention; the source does answer |
| Semantic verifier treats the bilingual clarification as a contradiction | report q3 | 1 | Incorrect rejection of exact retained text |
| Model chooses English `copy` for requested Russian | question q6 | 1 | Correct language hold of this draft; useful translation lost |
| Semantic verifier applies per-citation selection although the visible excerpts collectively support the block | rejected q4, q7 | 2 | Incorrect hold under the frozen collective-support contract |
| Faithful source produces a materially altered retention candidate, which is held | alternatives q1–q8 | 8 | Correct hold of this candidate; complete case coverage lost |

The aggregate report agrees on the mechanical totals: `answered=19`, `empty_draft=1`, `verification_rejected=3`, `generation_failed=1`, and `no_eligible_evidence=8`. The one answer operation failure is question q6. The one case availability failure is the rejected-plan retention run. All four source trees remained byte-identical.

No trace record has a schema error. The only trace operation with `ok=false` is row 63, the typed `language_mismatch`. Output limits were answer 2,400 and retention 2,400 tokens; the largest observed output was 1,817 retention tokens and the largest answer-verifier output was 1,123. There is no evidence of truncation or budget clipping.

## `v18-held-report`

### Source and retention

The source is a bilingual nested report. Bo Winters says the service terms permit sending the device to a technician for *dial* calibration. Ada Marlow separately says she gave no instruction to collect it. The Russian item explicitly says Ada is relaying only Bo’s words, describes regulator calibration rather than regulator replacement, and says Ada neither saw the terms nor received confirmation.

Retention wrote two records. E1 preserves the reported permission, Ada→Bo reporting chain, calibration-versus-replacement exclusion, and both personal verification limits. E2 preserves the separate absence of a collection instruction. The queried report rows retrieve E1 only, which is the relevant record. Its current readable text is within V57’s 600-character renderer bound, so all eight report generations used the complete-record rendering schema.

I treat the Russian `регулятор` wording as a source-side clarification of the English `dial` referent in this bilingual record. On that reading, the retained “regulator calibration, not regulator replacement” does not invent a second component. There is a real lexical boundary here: a reader who treats `dial` strictly as a scale/dial face rather than a control could find the retained wording broader. The source’s “only Bo’s words” construction and its explicit replacement contrast make the clarification reading stronger in this case, but this is the one substantive interpretive uncertainty in the accepted report answers.

### Published rows

- q2, q4, q6, and q8 are complete Russian translations of E1. Each keeps Ada as the relayer, Bo as the inner reporter, permission rather than shipment performance, the calibration/replacement contrast, and Ada’s personal lack of inspection and confirmation.
- q5 and q7 are exact copies of the current E1 readable payload, with the citation appended.
- The q4 label `Сообщено Ada Marlow` and q8 label `Сообщила Ada Marlow` are stylistically awkward or locally ambiguous. The body immediately and explicitly says `Ada Marlow сообщает/передаёт только слова Bo Winters`, so neither label reverses the actors or creates a source error in the published proposition.

The six nonnull outputs therefore contain no definite factual promotion, collection/booking implication, role reversal, or qualification loss.

### Holds

- **q1, `empty_draft`:** trace row 6 returned a schema-valid rendering choice with zero blocks. Its private reading said the source clarified “regulator, not a dial” and reported missing concept “A dial-calibration service report is not supported.” This misreads the bilingual clarification and suppresses an answer before language or semantic verification. The empty output is a model selection failure, not an absent record or guard rejection.
- **q3, `verification_rejected`:** rows 12–14 select `copy`, pass the English language check, and materialize the exact current E1 text. Row 15 then marks proposition and action arguments false because it compares source anchor 1 (`dial calibration`) only with answer anchor 1 (`regulator calibration`) while failing to reconcile Russian source anchor 4, which contains the regulator calibration/replacement clarification. Its generated `source_context` is also malformed at the end (`confirmation of theу?`), although the JSON and immutable anchors remain valid. This is a fallible semantic-verdict error, not a binding or copy-integrity failure.

The private source-frame and answer anchors reached the verifier and stayed byte-bound. The failure is interpretation across source anchors. Repeating or widening regex guards would not address it. The smallest supported change is to make the existing source-reading step state one reconciled bilingual referent and require the verifier’s `source_context`/alignments to account for every clarification anchor used by that reading. It should remain a fallible semantic comparison; an alias dictionary or automatic dial→regulator rewrite would be too broad.

## `v18-held-question`

### Source and retention

The source records Ada’s unresolved question about whether the service agreement includes preventive filter cleaning. A separate sentence says Ada still has no answer and the record establishes neither inclusion nor exclusion. Retention wrote E1 for the open question and E2 for the personal no-answer/neutrality statement. All eight query rows retrieve E1 only, which is sufficient for the focused “what question” query. E1’s actor, interrogative status, and unresolved qualification remain explicit.

### Published rows

q1, q3, q5, and q7 are exact English copies. q2, q4, and q8 are complete Russian translations. All seven retain Ada as owner of the question, the preventive-filter-cleaning subject, and uncertainty about coverage. None asserts that cleaning is included, excluded, or booked. `неурегулированный вопрос` in q8 is somewhat less idiomatic here than `нерешённый/неразрешённый`, but the full interrogative clause keeps its unresolved meaning; it is not a source or qualification error.

The V57 boundary between the selected record and the private frame worked here. The published answers need not repeat the frame-only act “recorded by me”; they preserve the selected retained question. Verifier source contexts and alignments accepted this without turning the recording act into a new required proposition.

### Hold

For q6, rendering-choice row 61 selects `copy` even though the requested output language is Russian. The trace’s `additionalLanguageProse` is the exact English canonical payload, proving that schema parsing and server materialization happened before the language decision. Row 62 returns `{compliant:false}`; row 63 publishes no block with typed reason `language_mismatch`. This is the intended safe failure for a wrong model-selected mode, not a checker-order or byte-materialization bug. It remains an unjustified writable-case abstention because the same record could have been translated, but forcing a route from script, receipt, or private configuration would violate the renderer design. A prompt/schema description that contrasts `copy` with `translate` using the requested language is the narrow available intervention; the runtime should continue to withhold the wrong-language copy.

## `v18-held-rejected`

### Source and retention

The source has three useful facts: Ada declined an offer to send the device to the service centre for thermostat measurement; she has no plan to send it under that offer; and no handover has been booked. A second sentence reiterates that the offered shipment was rejected rather than accepted.

The first extraction (trace row 73) generated all three facts faithfully. The standalone booking candidate says, exactly, that no handover of Zephyr QX-100, referred to as “the device,” has been booked. It was nevertheless held at deterministic validation as `time_unresolved`; the case is marked degraded with `derive_failed`. Repair row 75 targets `candidate_index=1`, the booking position, but returns a byte-equivalent copy of already admitted candidate 0 (the offer/no-plan record). The position transaction detects that duplicate/lost-position result around `retain.ts` line 618, rejects the repair, reports `derive_failed`, and preserves the original admitted candidates 0 and 2. Final verifier row 76 therefore accepts the original offer/no-plan and rejected-shipment records; it does not accept a repaired offer. The booking absence is not retained. This is a real retained-set omission and the sole case-level availability failure. Its structural trigger is the negative subject plus bounded quoted alias appositive before `has been booked`, which the booking/time floor reads as an affirmed booking.

The two written records are source-faithful. E1 contains the decline and personal no-plan clause. E2 says the offered shipment was rejected, and its private frame also contains the exact E1 offer sentence. All answer rows retrieve both E1 and E2. Because there are two records, the one-record renderer does not activate; these rows use legacy composition.

### Published rows

q1 and q5 include both rejection and Ada’s personal no-plan qualification. q2, q3, q6, and q8 give the focused answer that Ada declined the service-centre thermostat-measurement offer. The source expectation expressly permits that focused omission of the redundant no-plan clause. All six keep the actor, object, destination, purpose, and rejection status; none implies acceptance, booking, shipment, or completed measurement. I find no accepted error.

### Holds

- **q4:** the generated Russian block faithfully says Ada declined the service-centre thermostat-measurement offer and cites E1 plus E2. Verifier row 90 marks selection false because E2 alone does not name the thermostat purpose. That applies a per-citation requirement the frozen prompt does not state: it asks whether every material answer proposition is selected by the visible retained *excerpts* collectively. E1 visibly selects the full declined offer and purpose; E2 visibly contributes the same rejection. No private frame is needed. This is a false semantic hold.
- **q7:** rows 98–99 repeat the same per-citation selection error. The verifier also demands E1’s personal no-plan clause and calls its omission a proposition/qualification loss. That conflicts with the prompt’s ordinary focused-block rule (“an independent neighboring proposition in a cited record need not be repeated”), the case expectation, and q2/q3/q6/q8, which publish the same focused proposition. This is also a false semantic hold.

My initial review treated each cited record as independently required to select the whole block, because that is a defensible stricter provenance policy and E1 alone would suffice. I preserved that reading in `language-v57-built-forensic-initial.md`. It is not the contract frozen in V57. Under the implemented collective-support contract, both drafts are source-supported and should have passed. The narrow fix is prompt/test clarification that visible excerpts may support a block collectively while private frames never add selection. The complete-record all-clause rule must remain limited to the renderer arm; ordinary focused blocks should not inherit it from one cited record.

## `v18-held-alternatives`

The source says Ada considers two competing explanations: a *loosely inserted internal connector* or a faulty temperature probe. Both remain assumptions, neither has evidence, and Ada selected neither cause.

Extraction row 104 preserves the two alternatives and all shared qualifications, but changes `неплотно вставленный внутренний разъём` to “an internally loose connector.” Retention verifier row 105 correctly identifies the lost insertion relation/manner, sets proposition and action arguments false, and holds the only candidate as `discourse_uncertain`. Nothing is placed or retrieved, so all eight answer rows end as `no_eligible_evidence` without generation calls.

This is correct rejection of a semantically degraded candidate and complete loss of useful retention/answer coverage. The source-frame audit is functioning: exact source and candidate spans reached verification, and the model distinguished deficient insertion from a connector that is itself loose. The smallest supported repair is extraction guidance and a targeted semantic contrast preserving the attachment of `неплотно` to `вставленный`. A component or failure-mode dictionary is unnecessary. The complete one-record renderer cannot help because the source-faithful record never reaches storage.

## Renderer, anchors, and availability conclusions

The V57 rendering pilot activates only for the single-record report and question rows. Across those 16 calls it returns seven `copy` choices, seven `translate` choices, one empty block choice, and one wrong-language `copy`. Exact copy bytes are server-materialized and then language-checked; translations remain model text. Every nonnull rendered block passes the existing language and semantic checks. The trace distinguishes the pre-language rendering choice from the published answer, so the English question q6 payload is not an accepted output.

Immutable segment tables are present in the answer-verifier calls. Exact answer text anchors and exact original-frame anchors remain separate. I found no stale, foreign, missing, or mismatched anchor reference, no private-frame text disclosed in an answer, and no case where a frame alone expanded the selected proposition. The two rejected-plan holds do not demonstrate a correct frame boundary: E1 and E2’s visible excerpts already support the focused rejection collectively, so the verifier did not need E2’s frame and should not have failed selection.

The evidence supports four bounded next scopes:

1. Reconcile all source anchors in the existing bilingual `record_readings`/semantic comparison so a clarification is not reduced to the first-language surface form.
2. Strengthen rendering-choice guidance for requested output language while preserving the post-materialization language hold.
3. Admit only the negative-booking shape with a bounded quoted alias appositive; retain the negative source-frame and semantic gates.
4. Clarify collective visible-excerpt support and focused omission for ordinary blocks without allowing private frames to select content.
5. Preserve modifier attachment for “loosely inserted connector” during extraction.

These mechanisms account for the observed failures. They do not justify an alias dictionary, automatic language inference, retry, extra model pass, private-frame selection, or a broader natural-language parser.
