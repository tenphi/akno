# V61 built-package source-first forensic review

## Scope and independent disposition

I compared the four original sources and public outputs in [`language-built-output-packet-v61.json`](language-built-output-packet-v61.json), then used [`language-built-reliability-v61.json`](built-reliability.json) and its [trace](../../../../bench-results/language-built-reliability-v61-trace.jsonl) to identify retention, repair, placement, rendering and verification mechanisms. I preserved the earlier report-only review in [`built-report-preliminary.md`](built-report-preliminary.md).

I did not inspect a grading receipt or fresh held-out inputs, call a provider, modify runtime code, or treat benchmark expectation fields or private model narratives as source authority.

My source-first classification is:

- **32/32 nonnull answers.** I find all 32 useful and source-faithful for their focused questions.
- **No accepted source-entailment, actor/action, qualification, language, disposition or promotion error.** One Russian report label is locally case-ambiguous but the complete sentence resolves the source roles; I preserve that as a language-quality risk below.
- **Six written records and one validation-held candidate.** Report writes two, question writes two, rejected offer writes one and alternatives writes one.
- **Complete material retention in three of four cases.** The rejected-offer case loses the independent “no handover has been booked” proposition after a repair wording triggers the affirmative-booking time floor. Its focused offer/rejection record remains complete for all eight asked questions.
- **No case availability failure or answer-operation failure:** 0/4 and 0/32 respectively. Every retention operation returns `status:ok`, none is degraded, every answer reason is `answered`, all four sources replay, and every source's bytes remain stable.
- **All four queries retrieve qualified relevant evidence.** The aggregate benchmark's 4/4 useful-retention metric is case-level and does not expose the rejected case's one-proposition omission.

The frozen run uses answer generation v57, answer verifier v38, retention extraction v44 and retention verifier v30, with the declared isolated 2,400-token ceilings.

## `v18-held-report`: complete retention and eight faithful answers

The source says Bo Winters reports that the Zephyr QX-100 terms permit sending the device to a technician for dial calibration. Ada's Russian restatement says she is conveying only Bo's words and states regulator calibration rather than regulator replacement. Ada has not seen the terms and has not received confirmation of that message. Separately, Ada gave no instruction to collect the device.

Extraction creates two records ([rows 1–2](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L1)):

1. the complete Bo-through-Ada regulator-calibration/not-replacement report, including Ada's two personal limits;
2. Ada's direct no-collection-instruction assertion.

The retention verifier treats the Russian item as a clarification, explicitly excludes the independent collection denial from the report candidate, and accepts both candidates with empty mismatches and all three booleans true ([row 3](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L3)). Both are placed and written without repair ([rows 4–5](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L4)). The complete retained set is source-faithful.

All eight focused answers select the report record. The four English variants are exact current-record copies; the four Russian variants are complete translations. They retain Bo as inner speaker, Ada as outer transmitting source, permission rather than booking, regulator calibration rather than replacement, and Ada's lack of firsthand access and received confirmation ([rows 6–37](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L6)).

Every answer verifier returns empty mismatches, three true semantic booleans, three preserved alignments, and excerpt selection true with null unselected content. The V60 dial/regulator false-hold signature does not recur. This does not establish that omitting the query caused the changed outcome; the trace exposes no causal model state.

One Russian answer begins `**Сообщено Ada Marlow:**` ([rows 10–13](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L10)). With an indeclinable name, that short passive label can locally be read as “reported to Ada” or “reported by Ada.” The body immediately says `Bo Winters говорит` and `Ada Marlow передаёт только слова Bo Winters`, so the complete answer unambiguously restores Bo as inner speaker and Ada as relay. I therefore do not count an actor or source error, but `По словам Ada Marlow` is clearer and is used in the other Russian drafts.

## `v18-held-question`: complete two-record retention after exact position-1 repair

The original source contains three coupled meanings:

- Ada's own recorded unresolved question: whether the service agreement includes preventive filter cleaning;
- Ada still has no answer;
- the note establishes neither inclusion nor exclusion of that cleaning.

Extraction uses two candidates ([rows 38–39](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L38)):

- original position 0 is the open question;
- original position 1 combines Ada's personal lack of an answer and the note's separate neither/nor statement.

Position 0 passes structural validation. Position 1's first frame contains only `I still have no answer. This note establishes neither inclusion nor exclusion of that cleaning.` Its readable text names Zephyr QX-100 and preventive filter cleaning, but that identifying antecedent is absent from its deciding frame. The repair request therefore contains only original `candidate_index:1`, its exact original candidate and the identifier/frame validation issue; position 0 appears only in `read_only_admitted_context` ([row 41](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L41)).

The returned position-1 repair:

- preserves Ada's no-answer predicate and the note as subject of the neither/nor predicate;
- adds the exact position-0 question source span to its frame to resolve `that cleaning`;
- does not return or duplicate the admitted open-question record;
- changes the top-level generated polarity label from `negated` to `affirmed`, consistently treating the durable proposition as an asserted record of two epistemic absences rather than asserting either coverage answer.

The verifier receives this repair under the same original-position obligation. It separately compares Ada's personal knowledge and the note's inconclusiveness, returns all three booleans true for positions 0 and 1, and writes both ([rows 42–44](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L42)). No actor is transferred from Ada to the note or from the note to the agreement.

All eight answers select only the open-question record, which directly answers which question remains open. English copies and Russian translations preserve Ada, the service agreement, preventive filter cleaning and unresolved status ([rows 45–76](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L45)). They neither answer the embedded question nor claim coverage, exclusion, global ignorance or agreement silence. Omitting the second retained record is sound focused selection; complete-record rendering still includes every clause of the selected first record.

## `v18-held-rejected`: faithful focused record, independent no-handover record lost at validation

The original source establishes:

1. Ada declined an offer to send Zephyr QX-100 to the service centre for a thermostat measurement;
2. she has no plan to send it under that offer;
3. no handover of the device has been booked; and
4. the offered shipment was rejected, not accepted.

Extraction position 0 combines the declined offer and Ada's offer-specific no-plan statement. Its rejected disposition also preserves the source's nonacceptance meaning. Position 1 attempts to preserve the independent no-handover statement as `Ada Marlow states that no handover of Zephyr QX-100 has been booked` ([rows 77–78](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L77)).

Position 1 initially fails because `Zephyr QX-100` is absent from its one-sentence deciding frame. The repair request is correctly keyed to original index 1 and keeps admitted position 0 read-only. The response remains on index 1 and returns:

> Ada Marlow states that no handover of the device referred to as Zephyr QX-100 has been booked.

It cites the exact no-handover sentence and an exact `Zephyr QX-100` span ([rows 79–80](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L79)). This remains a source-faithful attempted repair, although the alias direction is less natural than naming Zephyr first and apposing “the device.”

The repaired position never reaches semantic verification. Its wording is outside the bounded negative-booking exception, which recognizes a form such as `no handover of Zephyr QX-100, referred to as “the device,” has been booked`. In the returned restrictive form, `negativeSubject` stops its prepositional subject tail at `as`, so it cannot consume `of the device referred to as Zephyr QX-100`. The separate `quotedAlias` removal handles only the opposite, comma-delimited form with the named subject first and a quoted generic alias second. Nothing is stripped here, and `hasAffirmedBooking` therefore treats the remaining `has been booked` as affirmative-looking. Because the candidate has `time:null`, validation holds it as `time_unresolved`. The final report records original candidate 1 as `outcome:held`, `holdStage:validation`, `reason:time_unresolved`; there is no repair obligation for it in the verifier payload.

Row 81 contains only position 0. It is accepted with all three booleans true and written to the equipment page ([rows 81–82](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L81)). The retained set therefore preserves decline/rejection, the offered sending action, destination, generic thermostat-measurement purpose and Ada's lack of a plan, but **omits the independent no-booked-handover proposition**. This is a real retention-coverage loss even though the operation is available and the asked questions remain answerable.

All eight questions ask which thermostat-measurement offer Ada declined. Every answer selects the written position-0 record and preserves the complete retained clause, including her no-plan statement ([rows 83–114](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L83)). Russian `измерение параметров термостата` remains generic thermostat measurement; it does not name a particular property, method or result. No answer claims booking, acceptance or completed measurement. All eight are useful and source-faithful despite the broader retained-set omission.

## `v18-held-alternatives`: complete retention and eight faithful answers

The source says Ada considers two competing explanations for Zephyr QX-100 failures: a loosely inserted internal connector or a faulty temperature probe. Both remain assumptions, neither has evidence, and Ada selected neither cause.

The one extracted record preserves all of those meanings. The retention verifier returns empty mismatches and all three booleans true; ownership selects the existing equipment page ([rows 115–118](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L115)). No repair occurs.

All eight answers preserve:

- the specific loose-insertion mechanism for the internal connector;
- the faulty temperature probe as a distinct alternative;
- competing tentative/hypothesis status;
- no evidence for either alternative; and
- Ada as the person who selected neither cause.

The English copies and Russian complete translations at [rows 119–150](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L119) add no established fault, selected cause, generic installation error or global evidentiary claim.

## Renderer, frame and verifier accounting

All 32 generations use the one-record renderer:

- 16 English `copy` choices;
- 16 Russian `translate` choices;
- 32/32 schema-valid rendering choices;
- 32/32 compliant answer-language checks.

Generation receives the exact question in every row. All 32 support-verifier payloads omit `question` and carry `rendering_scope:complete_retained_record`, because all four cases meet the one-record rendering criteria at answer time. Each verifier still receives the complete answer segments, current retained excerpt, required qualification, and exact bound original-frame bytes for the selected record.

Across the 32 verifier verdicts there are:

- zero mismatches;
- 32 true `proposition_supported` values;
- 32 true `action_arguments_preserved` values;
- 32 true `qualification_scope_preserved` values;
- 32 true excerpt selections with null `unselected_content`; and
- 96 `preserved` alignments, with no `generalized`, `changed`, `omitted` or `not_selected` relation.

No answer includes a proposition available only from an unselected private frame. The selected report frame includes both source items but the answer stays within the retained report; the selected question frame is the question source span; the selected rejected frame is position 0's offered-action/no-plan source; and the alternatives frame is its complete source item. The held no-handover repair is never cited.

Some private verifier `source_context` fields end in stray characters or truncated fragments. They remain schema-valid fallible notes and are not published answers or source authority. Exact anchors, booleans and selection fields are intact. This limits causal interpretation of the narratives but does not itself create an accepted output error.

## Availability, typed failures and bounded follow-up

The probe has no provider, schema, language, routing, answer-operation or source-byte availability failure. The only hold is a typed retention validation hold on rejected position 1. It is not semantic rejection and does not mark the case unavailable because position 0 is written and all queries are answered.

The evidence supports one narrow follow-up. The lower-risk generation instruction is to keep the repaired denial direct—`No handover of Zephyr QX-100 has been booked`—after adding the exact antecedent span. That uses grammar the cleaner already recognizes, but remains fallible.

If V62 addresses the structural false hold, extend only `negativeSubject` for the exact restrictive naming tail produced here: a clause-start `no handover` (or the existing closed event-head set), `of the device/item/unit/product referred to as`, a short uninterrupted identifier/name, and the immediately governing `has/have been booked`. The exception should classify only that auxiliary as governed by the negative subject. It should not rewrite identity or authorize the claim; the existing subject/frame identifier check, original-position repair obligation and full-source semantic verifier remain mandatory.

Controls should keep a positive or later booking held when the naming tail contains a finite predicate, punctuation, conjunction or a second clause; cover missing `no`, `referred to as X is ready`, a separate `and/but ... is booked`, and a quoted/hypothetical denial with a semantic-negative verdict. Candidate whitespace folding means raw newlines should be tested as normalized prose, not treated as a distinct safety boundary. Do not disable the booking-time floor, allow an arbitrary `referred to as ...` suffix, or infer that every `has been booked` sentence is negative. The exact original-index repair binding worked; the loss comes from the repaired wording's interaction with the local negative-subject grammar, not index substitution.

No further answer-verifier change is supported by this built run. Query omission transported correctly and all 32 support decisions were positive, but a single probe cannot establish causality or reliability. The locally ambiguous `Сообщено Ada Marlow` label and private diagnostic truncations should remain visible evidence rather than be converted into a new broad parser or acceptance exception.

## Final assessment

V61 produces a faithful answer for every built query and accepts no definite source, qualification or language error on this independent review. It completely retains report, open-question and alternatives meanings. The rejected-offer record is sufficient for the focused queries, but the complete retained set is missing the independent no-handover denial because a faithful original-index repair is held at validation as `time_unresolved` before semantics. That is the sole concrete built coverage defect; it is distinct from availability and from the correctness of the 32 published answers.
