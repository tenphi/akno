# V63 built-package source-first forensic review

## Scope and authority

This review covers the single completed V63 built run on frozen commit `e3749bad7fa65c6835e44e5e5ceb8f8857b1a984`. I compared the original source in [`language-built-output-packet-v63.json`](language-built-output-packet-v63.json) with retained records, public answers, and exact diagnostic fields in [`language-built-reliability-v63.json`](built-reliability.json) and [`language-built-reliability-v63-trace.jsonl`](../../../../bench-results/language-built-reliability-v63-trace.jsonl). I did not inspect an output-grading receipt or run a provider.

The original item text is authoritative. Generated `record_readings`, `source_context`, comparison prose, expected-review text, and positive booleans are fallible diagnostics. I use them only to locate dataflow and guard decisions, then compare the retained/public text with the original source.

## Run-level disposition

| Run | Cases | Retained records | Retrieved query rows | Published answers | Writable nulls | Availability failures | Accepted source/qualification/language defects |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 4 | 7/7 material records | 32/32 | 28/32 | 4 | 0 | 0 found |

The runtime report records 15 `complete`, 13 `partial`, and 4 `not_answered` outcomes. All 28 non-null answers are useful on a source-first reading; the `partial` operation label does not by itself identify missing public semantics. The four nulls are unjustified writable-case abstentions because the source and retained evidence support faithful answers. They are deterministic guard holds, not operation or provider availability failures.

All four cases report `retentionAvailabilityFailure=false`, `availabilityFailure=false`, stable source bytes, successful replay, and no retention degradation. The answer and retention ceilings are each 2,400 tokens. There are no malformed transport responses, token truncation failures, retries, or language-policy rejections in the final report.

## `v18-held-report`

### Source and retained set

The first source item has two independent statements: Bo Winters says the service terms permit sending Zephyr QX-100 to a technician for dial calibration; Ada Marlow says she gave no instruction to collect it. The second item identifies itself as Ada's relay of Bo's words, explicitly says regulator calibration is permitted and regulator replacement is not, and adds Ada's personal limits: she has not seen the terms and has not received confirmation of the message.

Trace rows 2-5 retain the complete material set as two records:

- `mem_836e47ad`: a source-report record attributed outwardly to Ada and inwardly to Bo, preserving permission to send the device to a technician for regulator calibration, the exclusion of regulator replacement, and both Ada-specific verification limits. Its support and private frame contain both original items.
- `mem_9aa810f3`: Ada's separate self-attested negation that she gave no instruction to collect Zephyr QX-100.

The retention verifier admits both with all three semantic dimensions true and no mismatches. The split is source-faithful: it does not attach the collection denial to Bo or turn service permission into shipment, booking, or completion. Both records are written to the existing equipment page.

### Public answers and four holds

Every query retrieves only the report record, which directly answers the focused report question. The separate collection denial remains in the complete retained set and need not appear in this focused answer.

The four English outputs (`q1`, `q3`, `q5`, `q7`) are exact copies of the current readable retained record. They preserve Ada as reporter, Bo as inner source, the technician destination, regulator-calibration-versus-replacement contrast, and both personal limits. Treating `dial calibration` in the first item as clarified by the second item's explicit `калибровка регулятора, а не замена регулятора` is supported by the original bilingual source. No output claims a booked shipment, completed service, or independently verified term.

`q1` has operation outcome `partial` because its private generation result lists “Whether Ada Marlow personally recorded the report” as a missing concept. The public answer nevertheless says `Reported by Ada Marlow`, and the original Russian item says Ada is relaying Bo's words. The private missing-concept note neither removes public content nor establishes a source error.

The Russian drafts at trace rows 12, 19, 26, and 33 are also materially faithful:

- `q2` and `q4`: `**Сообщено Ada Marlow:** По словам Bo Winters, ...`
- `q6` and `q8`: `**Сообщила Ada Marlow:** По словам Bo Winters, ...`

All four retain regulator calibration, exclude regulator replacement, keep Bo as the inner source, and state that Ada did not see the terms and did not receive confirmation. Their preceding language checks are `compliant=true` at rows 11, 18, 25, and 32. The final report then gives each `generated_blocks=1`, `passed_guards=0`, `verified_blocks=null`, `reason=draft_rejected`, and `rejection_counts.attribution=1`. There is no answer-verifier call for these rows.

The exact local cause is the named-reporter grammar in [`answer.ts`](../../../../packages/core/src/ops/answer.ts). `validateDraft` applies `attributedReportsSupported`, which requires the retained `source_speaker` (`Ada Marlow`) to occupy a recognized reporting role. `hasBoundReporter` recognizes bounded forms such as `Ada Marlow сообщила ...`, `по словам Ada Marlow`, and related report nouns, but not a reporting predicate before a named source. The following `По словам Bo Winters` correctly binds Bo and cannot satisfy Ada's outer role.

I reproduced that boundary against the frozen compiled [`dist/ops/answer.js`](../../../../packages/core/dist/ops/answer.js) without calling a model. [`report-attribution-reproduction.json`](report-attribution-reproduction.json) records `supported=false` for all four exact drafts and `supported=true` for the bounded control `Ada Marlow сообщила: По словам Bo Winters, ...`. This confirms the final report's attribution category and rules out the language checker or semantic verifier as the hold source.

These are four false holds on useful Russian answers. A bounded next correction should either instruct complete-record translation to render a named Russian reporter before the reporting verb, or admit a narrowly source-conditioned, clause-initial `Сообщил/Сообщила <exact retained speaker>:` construction. A generic predicate-before-name rule would risk borrowing a name from another reporting chain; exact speaker equality, a clause boundary, a colon/record separator, quote masking, and negative/reversal controls are necessary. The awkward impersonal `Сообщено Ada Marlow` form should not motivate broad grammar admission when the natural active form already exists.

## `v18-held-question`

The source records Ada's unresolved question about whether the service agreement includes preventive filter cleaning, followed by her personal lack of an answer and a note-level statement that neither inclusion nor exclusion is established.

Trace rows 35-38 retain two source-faithful records:

- the open question itself, kind `question`, commitment `none`, disposition `active`;
- the distinct claim that Ada still has no answer and the note establishes neither inclusion nor exclusion.

Both pass retention verification with the personal and record-level epistemic subjects kept distinct. Both are written; there is no omission from the complete retained set.

All eight focused answers select the open-question record and state that Ada's unresolved question is whether the agreement includes preventive cleaning of the filter. The four English copies and four Russian translations (`профилактическая очистка/чистка фильтра`) preserve the question and do not answer its embedded coverage proposition. Selecting only the open-question record is sufficient for these focused queries: `unresolved/open` preserves the unanswered status, while the separately retained neither-inclusion-nor-exclusion record remains available without being forced into every response.

Trace rows 42, 46, 50, 54, 58, 62, 66, and 70 show one verifier verdict each. Every verdict has all three booleans true, `selected_by_retained_excerpt=true`, all actor/object/qualification relations `preserved`, and no mismatches. I find no personal-to-record subject shift, coverage inference, invented booking, or language defect in the public answers.

## `v18-held-rejected`

The source states that Ada declined an offer to send Zephyr QX-100 to the service centre for a thermostat measurement, has no plan to send it under that offer, no handover has been booked, and the offered shipment was rejected rather than accepted.

Trace rows 72-77 retain two records. Original extraction position 0 is a rejected plan that preserves Ada's decline, the device, destination, purpose, rejected/nonaccepted status, and no-plan qualification. Original position 1 is the separate negated booking claim.

Position 1 initially renders `No handover of Zephyr QX-100 has been booked` while its only frame says `the device`; the deterministic identifier/frame check rejects it because the named subject is absent from readable source frame. The single repair call at row 74 has `index_basis=zero_based_original_extraction_order`, one `repair_targets` entry for `candidate_index=1`, and position 0 only in `read_only_admitted_context`. The repair keeps position 1, its proposition, qualification, support, text, subject, and destination, and adds the bounded antecedent frame `send Zephyr QX-100 to the service centre`. Row 75 presents the original position-1 candidate as a repair obligation and admits the repaired record with all three booleans true. No duplicate, index drift, sibling substitution, or semantic change occurs.

All eight answers retrieve only the rejected-offer record. They preserve Ada's rejection, sending Zephyr QX-100 to the service centre, thermostat measurement, nonacceptance, and her lack of a plan under the offer. The Russian forms `измерение термостата` / `измерение параметров термостата` are ordinary translations of the source's thermostat measurement and do not claim a performed measurement. The independent no-handover-booking proposition is omitted from these focused answers but remains in the complete retained set; that is a scoping choice, not retention loss.

Trace rows 81, 85, 89, 93, 97, 101, 105, and 109 show all answer-verifier dimensions and selections passing without mismatches. No answer promotes the offer to a plan, acceptance, shipment, handover, or completed measurement.

## `v18-held-alternatives`

The source says Ada is considering two competing fault hypotheses: a loosely inserted internal connector or a faulty temperature probe. Both remain assumptions, neither has evidence, and Ada selected neither cause.

Trace rows 111-113 retain this as one complete tentative record with the whole original item as support and frame. It preserves Ada as the considering and nonselecting person, both distinct mechanisms, tentative status, lack of evidence for each, and no selected cause. The verifier admits it with all dimensions true and placement chooses the existing equipment page.

All eight answers select the complete record. English copies retain `an internal connector that was loosely inserted`; Russian translations retain `неплотно вставленный внутренний разъём`. Every output also preserves the faulty temperature probe, tentative/assumption status, absence of evidence for either, and Ada's nonselection. Trace rows 117, 121, 125, 129, 133, 137, 141, and 145 contain fully positive anchored verdicts with no mismatches. I find no causal promotion, dropped alternative, generalized component, actor loss, or language defect.

## Rendering, source anchors, and diagnostic limits

All 32 generation results use the bounded complete-record renderer: 16 schema-valid `copy` choices and 16 schema-valid `translate` choices, four of each per case. The exact current retained record is the selected unit. No answer expands selection from a private frame, and every published answer cites only its selected `E1` record.

Twenty-eight blocks reach the answer verifier. All 28 verdicts contain one source alignment for `E1`; every `actor`, `object_and_mechanism`, and `qualification` relation is `preserved`; all three semantic booleans and `selected_by_retained_excerpt` are true; all `unselected_content` values are null; and all mismatch arrays are empty. The four report translations stop at the local attribution guard before verification.

The verifier's private `source_context` is not consistently clean prose. Report rows 9, 16, 23, and 30 end mid-sentence at their bounded field limit; row 9 ends with the stray characters `收到`, and row 23 contains invisible Unicode near the truncation. Alternatives rows 117 and 125 also end mid-clause. These strings are neither public answers nor source authority. In the same verdicts, exact immutable source anchors, answer anchors, and public text preserve the required propositions. I therefore do not count the malformed private summaries as accepted output defects.

The corrected V62 omitted-anchor distinction is not exercised by a failure here. There are no schema-invalid `omitted` plus non-null anchor verdicts and no verification-unavailable rows. A valid negative alignment would have rejected publication regardless of positive booleans, but all 28 actual alignments are `preserved`.

## Conclusion

V63 retains the full material proposition set in all four cases and publishes 28 source-faithful, qualified answers. I find no accepted source, qualification, factual-promotion, or target-language error. The sole observed defect is four repeated writable-case abstentions for the report's Russian translation: materially faithful drafts are rejected by a bounded named-reporter grammar that does not recognize predicate-before-name Russian labels. The evidence supports one local reporter-binding correction with strict clause, exact-name, quote, and reversal boundaries; it does not support weakening source alignment, semantic verification, selection, or language checks.
