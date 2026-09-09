# V68 built-package source-first forensic review

Runtime: frozen `c60460d`
Evidence: [report](built-reliability.json), [trace](../../../../bench-results/language-built-reliability-v68-trace.jsonl), [source/output packet](language-built-output-packet-v68.json), and [approved original inputs](../v65/language-v19-blind-inputs.json).
Scope: four exposed V20-development cases, one run, eight query/answer/view coordinates per case. I did not read an output-grading receipt, call a provider, rerun the runtime, or edit implementation files.

## Independent conclusion

The built probe retained all four source cases completely and published an answer at all 32 coordinates. I found no definite material source, qualification, promotion, attribution, or language error in the public outputs. There were no nulls to classify.

One translation choice remains interpretively weaker than the others: rejected-plan q1 and q3 use `измерения балансировки ротора`, while q5 and q7 use the direct `измерения баланса ротора`. The first phrase is awkward and can evoke the balancing process rather than the rotor's balance property. I do not count it as a definite material change here because it still makes measurement, rather than balancing or repair, the proposed action and does not assert that balancing occurred. This exact pair should remain visible for independent source-language adjudication.

The report records zero case availability failures, zero answer-operation failures, 32/32 produced answers, four of four useful retained sets, four of four qualified retrieval cases, and zero source-byte changes. Every query reports `answerReason:"answered"`, one generated/passed/verified block, and no rejection count. Runtime positive booleans are not the basis for the source judgment above; the original propositions and public text are.

Coordinate order below is zero-based:

- q0 EN query → EN answer, inferred view
- q1 EN → RU, inferred
- q2 EN → EN, explicit view
- q3 EN → RU, explicit
- q4 RU → EN, inferred
- q5 RU → RU, inferred
- q6 RU → EN, explicit
- q7 RU → RU, explicit

## v19-held-report

Trace coordinates: extraction/retention rows 1–5; answer generation, language checks, and verification rows 6–37. Verifier rows are 9, 13, 17, 21, 25, 29, 33, and 37.

The original source establishes two independent records:

1. Ada Marlow has not read the service terms and lacks independent confirmation. Bo Winters told her that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension. The Russian clarification says measurement, not replacement, and identifies this as Bo's words in Ada's retelling rather than a condition personally verified by her.
2. No collection of Ada's device has been booked.

Retention preserves both:

- `Ada Marlow reports that Bo Winters said ... permit sending the device to a service bench to measure the tension of its return spring, not replace that spring`, followed by Ada's separate no-reading, no-independent-confirmation, and no-personal-verification limits. It is a qualified asserted `source_report`, with outer Ada and inner Bo.
- `Ada Marlow states that no collection of her device has been booked`, a separate self-attested negated event.

The retain verifier accepts both with exact multi-span accounting at row 3. Placement sends the report to the existing Zephyr page and the personal denial through a proposed Ada page choice at rows 4–5; both are ultimately written. No repair occurs.

All eight focused queries retrieve only the report record, which is the complete proposition needed by the question. EN answers use the exact complete-record copy. RU answers translate the whole record, preserving:

- Ada as outer reporter and Bo as inner speaker;
- permission to send, without saying the device was sent;
- service-bench destination;
- return-spring **tension measurement**;
- the explicit contrast with spring replacement;
- Ada's lack of reading, independent confirmation, and personal verification.

The headings `Reported by Ada Marlow` / `По словам Ada Marlow` are consistent with the complete body. The generated RU prose keeps both names in original spelling. The separate booking denial is correctly omitted from these focused report answers rather than being lost from retention.

The new `named_source_reference` is present in every generation/rendering-choice request with `exact_spelling:"Ada Marlow"` and `attribution_required:true` (rows 6–36). It is absent from the answer-verifier evidence, which contains the original qualification and frame anchors. Every verifier selects E1 and marks all source-alignment categories preserved. Some private `source_context`/detail strings at rows 13, 17, and 21 end awkwardly or contain stray Unicode; those fallible narratives are neither public source nor an accepted semantic fact. The independently compared answer text remains faithful.

## v19-held-question

Trace coordinates: retention rows 38–41; answer paths rows 42–73. Verifier rows are 45, 49, 53, 57, 61, 65, 69, and 73.

The original Russian source says Ada has an open question whether preventive coolant top-up for Zephyr QX-100 is included in the service contract. Ada has no answer, and neither inclusion nor exclusion of that service is established.

Retention produces exactly that single qualified question. It keeps Ada as the question holder, the preventive coolant-top-up service, contract inclusion as the unresolved proposition, Ada's personal no-answer status, and the separate passive non-establishment of both inclusion and exclusion. It does not turn the embedded question into a coverage fact or invent an external asking/recording event. Retention verification and placement both succeed without repair.

All eight outputs cite the one complete question record. Four EN outputs are exact copies; the four RU translations preserve the service, open-question status, Ada, and both unresolved alternatives. q3 says `Ada Marlow не знает, входит ли ...; у неё нет ответа` where the source literally says she has no answer. I treat that as a contextual personal-epistemic paraphrase, not a global ignorance claim: it keeps Ada as experiencer, immediately repeats her lack of an answer, and separately preserves that neither coverage outcome is established. This is a stated interpretive boundary rather than a verifier-derived conclusion.

Every generation request carries the exact named-source hint; every public output spells `Ada Marlow` unchanged. All language checks and complete-record source audits pass, with valid anchors to the question and no-answer/nonresolution clauses. No private frame material is added.

## v19-held-rejected

Trace coordinates: retention rows 74–78; answer paths rows 79–110. Verifier rows are 82, 86, 90, 94, 98, 102, 106, and 110.

The source establishes:

1. an offer to send Zephyr QX-100 to a laboratory for a rotor-balance measurement;
2. Ada's rejection of that offer and lack of a plan to send the device under it;
3. the offered shipment was rejected rather than accepted;
4. separately, no pickup of the device has been booked.

Retention writes two records. The first is a `plan` with asserted commitment, rejected disposition, and affirmed embedded polarity. Its prose keeps the laboratory, rotor-balance measurement, Ada's rejection, her lack of a plan, and rejected-versus-accepted contrast. The second keeps the unbooked pickup as a negated active claim and resolves the device antecedent to Zephyr QX-100. This is a complete retained set, and neither candidate needs repair.

All queries focus on the rejected offer and cite only its complete record. Omitting the independent unbooked-pickup record from these answers is valid selection, not a retention or retrieval gap. EN answers copy the record. RU q5/q7 use the precise `измерения баланса ротора`; q1/q3 use the awkward `измерения балансировки ротора` noted in the conclusion. Every RU answer still presents an offer to **measure**, not an actual measurement, balancing operation, shipment, or booking. All preserve Ada's rejection, her lack of a plan, and rejection rather than acceptance.

The exact-name hint reaches all eight generation calls, and all public answers retain `Ada Marlow`. Language checks and source audits accept all blocks. The source audit's positive object relation is not treated as authority for the two wording variants; the independent semantic assessment above is based on the English source and Russian output.

## v19-held-alternatives

Trace coordinates: initial extraction rows 111–113; structural repair row 114; retention verification/placement rows 115–116; answer paths rows 117–148. Verifier rows are 120, 124, 128, 132, 136, 140, 144, and 148.

The original source directly asserts that Ada is discussing two competing preliminary fault hypotheses for Zephyr QX-100: a slipping drive belt or a jammed cooling fan. Neither has supporting evidence, and Ada has not selected a cause. Tentativeness belongs to the hypotheses; the discussion act is actual.

The initial model candidate contains the complete faithful prose but labels the tuple `kind:event`, `commitment:asserted`. Local cleaning holds original candidate index 0 as `noncanonical_without_context`, because the preliminary unsupported hypotheses require typed noncanonical status. The single existing repair call receives only that original position and returns the byte-equivalent prose/support/frame with `kind:claim`, `commitment:tentative`. It does not alter the discussion verb, actor, alternatives, evidence limits, nonselection, subject, or placement.

Row 115 is the direct V68 tentative-scope exercise. The verifier receives the original two source items, exact frame spans, the repaired position obligation, and the conditional `record_scope`. It explicitly reads Ada's discussion as asserted while applying tentative status to the embedded hypotheses, and accepts all three semantic dimensions. This is consistent with the declared qualification contract; the label supplies no discussion act because that act is explicit in both source and candidate.

All eight answers render the entire retained record. EN uses exact copy. RU keeps `Ada Marlow`, the actual present discussion predicate `обсуждает`, both alternatives, their preliminary/unsupported status, and Ada's personal nonselection. The visible headings vary among `Предварительный статус` and `Предварительно`; the body itself unambiguously calls the hypotheses preliminary and states the discussion directly. I therefore do not read the heading as denying that discussion occurred, while noting that a global tentative heading is less explicit about the two-layer scope than the body.

Every generation request contains the record-local exact-name requirement, and every output retains the original spelling. The answer verifier also receives the conditional tentative scope at all eight coordinates and keeps its ordinary three booleans, per-source alignments, and excerpt-selection requirement. There is no schema error, malformed verdict, guard rejection, retry, or missing answer.

## Availability, routing, citations, and residual scope

- Availability: all four cases have `retentionAvailabilityFailure:false`, `availabilityFailure:false`, `error:null`, and no degraded reason. All 32 answer operations complete.
- Retention: six source-faithful records are written in total (2 + 1 + 2 + 1). The only repair is alternatives original index 0, and it preserves the candidate's material bytes while correcting typed kind/commitment.
- Retrieval: every query retrieves one relevant complete record. Independent siblings remain stored but are not needed by the focused questions.
- Rendering: each selected record qualifies for the one-record renderer. EN uses exact copy; RU uses strict translate mode. The question is omitted only from complete-record verifier payloads, as designed; generation still sees it.
- Citations: report/question/alternatives answers cite `memory/equipment:7`; rejected answers cite `memory/equipment:6`. Each citation points to the selected retained line, and no answer cites an unrelated sibling.
- Language: all 16 RU outputs translate ordinary terms and preserve `Ada Marlow`, `Bo Winters`, and `Zephyr QX-100` where selected. No output transliterates or drops a required named source.
- Source bytes: all four `bytesStable` flags are true and the aggregate source-byte-change count is zero.

No bounded runtime correction is justified by a definite failure in this four-case probe. The two `измерения балансировки ротора` variants and the q3 `не знает` paraphrase should remain disclosed for independent language/source interpretation. Changing a guard or adding a lexical dictionary from these ambiguous phrases would be broader and less reliable than the current full-source verification. The fresh held-out corpus remains the proper test of whether the V68 attention and scope changes improve general availability without new source errors.
