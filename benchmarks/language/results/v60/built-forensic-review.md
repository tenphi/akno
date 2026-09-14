# V60 built-package source-first forensic review

## Scope and disposition

I reviewed the original source items and published outputs in [`tmp/language-built-output-packet-v60.json`](language-built-output-packet-v60.json), then used [`bench-results/language-built-reliability-v60.json`](built-reliability.json) and its [trace](../../../../bench-results/language-built-reliability-v60-trace.jsonl) to identify retention, placement, rendering and verification mechanisms. I did not inspect a grading receipt, call a provider, retry a row, modify runtime code, or use private model narratives as source authority.

My independent source-first classification is:

- **29/32 published answers**, all 29 useful and source-faithful.
- **3/32 nulls**, all in `v18-held-report`. Each is an unjustified writable-case abstention: the original source, retained record and generated answer supply a faithful answer, but the answer verifier incorrectly treats the explicitly clarified dial/regulator referent as a conflict.
- **No accepted source-entailment, actor/action, qualification, language, disposition or promotion error** among the 29 published answers.
- **Complete material retention in all four cases.** Eight records are written: two report, three question, two rejected-offer and one alternatives record. The rejected case uses two records rather than three, but its combined rejected-plan record includes the separate no-plan proposition; no source meaning is lost.
- **Useful retrieval in all four cases.** Every query retrieves the relevant qualified record.
- **No typed availability failure:** 0/4 case availability failures, 0/32 answer-operation failures, no degraded retention or answer row, no language-policy rejection, and no source-byte change. The three nulls are `verification_rejected` with `semantic_support`, not provider, schema, language, routing or retrieval failures.

The probe uses `retain-extraction-language-v44`, `retain-verifier-language-v30`, `answer-generation-v56` and `answer-verifier-v37`, with explicit 2,400-token answer and retention ceilings.

## Case findings

### `v18-held-report`: complete retention, five faithful answers and three false semantic holds

The source establishes two independent durable propositions:

1. Bo Winters says that the Zephyr QX-100 service terms permit sending the device to a technician for dial calibration. Ada's Russian restatement says she is transmitting only Bo's words and clarifies the permitted service as regulator calibration rather than regulator replacement. Ada has not seen the terms and `подтверждения этому сообщению не получила`: she **has not received confirmation of the message**.
2. Ada has given no instruction to collect the device.

#### The confirmation predicate fix is exercised

The first extraction call generates:

> `... Ada Marlow is only transmitting Bo Winters's words, has not seen the terms themselves, and has not received confirmation of this message.`

This preserves Ada as the potential recipient of confirmation. It does not repeat V59's error of saying she personally did not confirm the message. The candidate also preserves Bo as inner speaker, Ada as outer recorder, permission rather than booking, regulator calibration rather than replacement, and the source's lack of firsthand inspection ([trace row 2](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L2)).

The retention verifier explicitly reads the Russian clause as Ada not receiving confirmation, classifies the Russian regulator statement as a clarification of the earlier reported service, and accepts all three semantic dimensions. The collection-instruction denial passes in the same batch ([trace row 3](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L3)). Both route to the existing equipment page ([rows 4–5](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L4)). No structural repair is invoked. V60's predicate-direction guidance therefore succeeds in this first-pass built case.

The final retained set is complete:

- one qualified report containing the full calibration/replacement contrast and Ada's exact personal limits;
- one direct negated claim that Ada gave no instruction to collect Zephyr QX-100.

#### Exact cause of the three nulls

All eight report generations retrieve the same report record. All eight rendering choices are schema-valid; English uses exact `copy` and Russian uses complete-record `translate`. Every draft preserves Bo/Ada attribution, the permitted technician sending, regulator calibration rather than replacement, and Ada's lack of seeing the terms or receiving confirmation. Every language check is compliant and every draft passes local guards.

Three answer verifier calls then reject faithful drafts:

| Packet answer | Coordinates | Draft | Verifier error |
| --- | --- | --- | --- |
| EN query → EN answer, inferred view | [generation row 8](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L8), [verifier row 9](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L9) | Exact copy of the retained record | Anchors only the English `dial calibration` span and says regulator calibration changes the object. |
| EN query → RU answer, inferred view | [generation row 12](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L12), [verifier row 13](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L13) | Faithful Russian translation | Again treats dial and regulator as different calibration targets. |
| EN query → RU answer, explicit view | [generation row 20](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L20), [verifier row 21](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L21) | Faithful Russian translation | Again ignores the Russian source clarification and returns proposition/action false. |

Each rejected verdict reports exactly one changed source-alignment field, `object_and_mechanism`, and derives two false required booleans from it: `proposition_supported=false` and `action_arguments_preserved=false`. `qualification_scope_preserved=true` and `excerpt_selection.selected_by_retained_excerpt=true`, with `unselected_content=null`, in all three. The aggregate report records the resulting coarse rejection bucket as `semantic_support`; that bucket is the disposition, not an independent diagnosis. The asserted mismatch is not supported by the complete source. The Russian source says `Я передаю только слова Bo Winters` immediately before `разрешена калибровка регулятора, а не замена регулятора`; it is an explicit restatement of Bo's reported service, not an unrelated neighboring assertion or unsupported alias dictionary.

The inconsistency is visible within the same run. The identical English copy passes for the other English-query/explicit-view row ([rows 16–17](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L16)), and the same record meaning passes for both languages under the Russian query ([rows 24–37](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L24)). Those accepted verifier calls anchor the Russian clarification span and correctly treat regulator calibration as the source-selected referent.

Thus the observable null mechanism is the answer verifier returning the two false semantic booleans after marking `object_and_mechanism` changed. It is not a bad retained record, bad answer draft, language failure, rendering-schema failure, excerpt-selection failure, missing citation, truncation or availability event. The trace does not expose why the model ignored the clarification, so the internal cause remains unknown; the repeated dial/regulator rationale is the model's stated reason. All three nulls are false draft holds and unjustified case-level abstentions.

The five published report answers are faithful. English copies the retained record. Russian translations preserve regulator calibration, explicitly exclude regulator replacement, identify Bo as the reported speaker and Ada as the relay, and say Ada did not see the terms and did not receive confirmation.

### `v18-held-question`: complete three-record set and eight faithful focused answers

The source records:

- Ada's unresolved question about whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter;
- Ada's personal continued lack of an answer; and
- the note's separate statement that it establishes neither inclusion nor exclusion of that cleaning.

Extraction creates those three propositions separately ([trace row 39](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L39)). The open question passes structural validation. Original positions 1 and 2 initially lack the antecedent span that identifies what “the question” and “that cleaning” refer to. The repair request sends exactly those two original indices with their own drafts/issues and position 0 as read-only context. It returns:

- position 1 with the original question span added to Ada's no-answer frame;
- position 2 with the question span added to the note-level inclusion/exclusion frame.

The repairs preserve their original propositions and do not duplicate the admitted question ([trace row 41](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L41)). Positions 0/1 pass one verifier batch and repaired position 2 passes the next bounded batch, each with its own repair obligation ([rows 42–43](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L42)). All three are written.

Each focused query retrieves the open-question record. The eight answers identify Ada, the service agreement, preventive filter cleaning and unresolved/open status without asserting inclusion, exclusion or a booking ([rows 47–78](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L47)). Omitting the two separately retained explanatory records is sound for “which open question”: the selected answer states the question as unresolved, and it does not replace Ada's personal uncertainty with global ignorance or document silence.

I find all eight outputs source-faithful. Describing it as “Ada Marlow's unresolved question” is a focused identification of the source's recorded question, not an unsupported independent recording event.

### `v18-held-rejected`: complete two-record set, one correct repair and eight faithful answers

The source establishes four material statements:

1. Ada declined an offer to send Zephyr QX-100 to the service centre for a thermostat measurement.
2. She has no plan to send it under that offer.
3. No handover of the device has been booked.
4. The offered shipment was rejected, not accepted.

Extraction combines statements 1, 2 and 4 in one rejected-plan record and keeps statement 3 as an independent negated booking record ([trace row 80](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L80)). This is a complete semantic set despite having two physical records. The combined record still says Ada declined the offer, the offered shipment was rejected rather than accepted, and she has no plan to send the device under it.

Only original candidate index 1 requires repair. Its prose names Zephyr QX-100 while the initial frame contains only “the device.” The repair request binds index 1 to that exact no-handover proposition and keeps admitted index 0 in read-only context. The repair adds the exact Zephyr identifier span from turn 1111 before the no-handover span; it does not substitute the rejection or no-plan proposition ([trace row 82](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L82)). Full-source verification accepts both the immutable rejected-plan record and repaired booking denial with correct original-position obligation ([trace row 83](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L83)).

There is no retained-set omission:

- no-plan is present in the rejected record;
- rejection/not-acceptance is present in the same record;
- no booked handover remains a separate active negated claim;
- the repair does not change a passive, unspecified booking agent into Ada.

All eight focused answers select the rejected-plan record and preserve Ada as the declining actor, sending Zephyr QX-100 to the service centre, thermostat measurement as purpose, rejected/not-accepted status and her lack of a plan under that offer ([rows 86–117](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L86)). Russian `измерение термостата` and `измерение параметров термостата` are faithful renderings of the source's generic “thermostat measurement”; neither invents a particular measured property or result.

### `v18-held-alternatives`: complete one-record set and eight faithful answers

The Russian source says Ada considers two competing explanations for Zephyr QX-100 failures: a loosely inserted internal connector or a faulty temperature probe. Both remain hypotheses, neither has evidence, and Ada selected neither cause.

The single retained record preserves all of those meanings with tentative commitment ([rows 119–121](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L119)). No repair occurs. All eight answers keep:

- the insertion relation—`loosely inserted internal connector` / `неплотно вставленный внутренний разъём`;
- the faulty temperature probe as the second alternative;
- competing hypothesis status;
- absence of evidence for each alternative; and
- Ada as the person who selected neither cause.

English copies and Russian translations at [rows 122–153](../../../../bench-results/language-built-reliability-v60-trace.jsonl#L122) are source-faithful. I find no action-modifier, actor, shared-qualification or language error.

## Rendering and diagnostic observations

All 32 answer generations use the bounded one-record renderer: 16 English `copy` choices and 16 Russian `translate` choices. Every rendering-choice trace reports `schemaValid:true`; every answer and answer-verifier model call returns a schema-valid outcome. The three report rejections occur after successful generation/language/local validation and are counted only as `semantic_support` holds.

Several private verifier `source_context` or comparison fields end with stray or truncated characters (for example rows 17, 33, 37, 133, 137 and 149), and some accepted short comparisons paraphrase Ada's lack of received confirmation as lack of personal confirmation. These fields are fallible diagnostic narratives. They are not published answer prose, source authority or schema failures. The actual accepted report answers retain the correct received-confirmation predicate, and their anchored qualification details are positive. Still, the private wording shows that V60's extraction guidance did not make answer-verifier interpretation deterministic; that verifier version did not change.

The new person-subject/person-page suggestion is not exercised by these four built cases. The report's separate denial concerns Ada's explicit instruction and resolves the device to Zephyr QX-100; the rejected case also has an unambiguous product antecedent. The new Russian clock grammar and per-record multi-citation guidance are likewise not exercised: none of these sources has relative time, and every answer cites exactly one selected record.

## Bounded follow-up supported by this evidence

The remaining defect is narrow but repeated within the report matrix: the answer verifier marks `object_and_mechanism` changed on three faithful drafts and cites only the first English `dial` span in support of that result, despite the later Russian clarification. Generation, retention verification and five sibling answer-verifier calls interpret the complete frame correctly. Whether the rejected calls actually failed to attend to the later span, misunderstood the discourse relation, or followed another hidden path cannot be established from the trace.

A future fix should keep the rejected verdict final—no retry, threshold exception or alias dictionary—and make complete-source clarification accounting explicit inside the existing verifier call before object comparison. The source must establish that relation; query wording and private generation readings cannot. Any such change must retain the ability to reject truly unrelated bilingual component statements. This probe alone does not establish which same-call structural representation best achieves that, so it supports preserving the exact false-hold evidence rather than broadening a lexical equivalence rule.

## Final assessment

V60 repairs the built retention failure that motivated its epistemic-action guidance: the report survives with “has not received confirmation,” and the complete material retained set is present in every case. The three remaining nulls are downstream semantic false holds over faithful drafts, caused by inconsistent treatment of an explicit bilingual clarification. All 29 published answers are useful and source-faithful on this independent review, with no accepted language, qualification or promotion error and no typed availability failure.
