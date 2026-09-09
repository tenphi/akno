# V71 built-package source-first forensic review

## Scope and result

I reviewed the four built-package development cases and all 32 query coordinates from:

- `tmp/language-built-output-packet-v71.json`
- `bench-results/language-built-reliability-v71.json`
- `bench-results/language-built-reliability-v71-trace.jsonl`

I read each original source before considering runtime validation. I did not read an independent grade, inspect fresh V21 held-out material, call a provider, rerun a probe, or edit runtime code.

Independent conclusion: all four retained sets are complete and materially faithful; all six retained records have source-supported typed metadata; retrieval supplies the record relevant to every focused query; and all 32 published answers are useful and source-faithful. I found no accepted source, actor, predicate, object, property, polarity, time, qualification, citation, or language error. There are no nulls, local holds, semantic holds, schema failures, cap failures, or provider availability failures in this built run. Source bytes are stable in every case.

The report's `complete` versus `partial` outcome labels do not alter this source judgment. Every `partial` coordinate still contains one verified, useful answer block; the distinction comes from benchmark outcome bookkeeping rather than a missing material proposition in these focused answers.

## Retention and qualification

### `v19-held-report`

The original establishes four separate matters: Ada has not read the service terms; she has no independent confirmation; Bo told her the terms permit sending the device to a service bench to measure return-spring tension; and the meaning is measurement rather than replacement, relayed as Bo's words and not a condition Ada verified. It separately denies that collection of Ada's device has been booked.

Trace row 2 generates two records. The main record preserves Bo as inner reporter and Ada as outer relayer, permission rather than booking or completed service, the service bench, the exact return-spring tension property, the measurement/replacement contrast, unread terms, lack of independent confirmation, and Ada's personal nonverification. Its affirmed polarity governs the positive relayed report despite those negative epistemic limits. The sibling preserves the separate no-collection-booking proposition with negated polarity. Trace row 3 independently returns matching `affirmed` and `negated` source polarities and all three semantic dimensions true. Both records are retained, so this is a complete and correctly qualified set.

The main record's phrase `reported condition` remains explicitly contractual in context: it follows `the ... terms permit`, and the sentence says Ada did not verify that condition. It does not recast the term as a physical device state.

### `v19-held-question`

The original is Ada's open question whether preventive coolant refill is included in the service contract, coupled with Ada's lack of an answer and the fact that neither inclusion nor exclusion is established. Trace row 39 preserves all three propositions in one question record. Its `kind: question`, `commitment: none`, active disposition, affirmed polarity, Ada attribution, and self-attested basis fit the source: the affirmed proposition is the existence and content of the unresolved question, not either embedded coverage answer. Trace row 40 independently selects affirmed polarity with all semantic dimensions true. The one-record set is complete.

### `v19-held-rejected`

The source says Ada declined, rather than accepted, an offer to send Zephyr QX-100 to a laboratory for a rotor-balance measurement; she has no plan to send it under that offer. A separate clause says no pickup has been booked. Trace row 75 preserves the rejected offer and no-plan scope in one plan record and the no-pickup denial in a second record. The rejected plan correctly remains affirmed: the positive fact is Ada's rejection, while disposition carries `rejected`. The sibling denial is negated. Trace row 76 reports the same two source polarities with all semantic dimensions true. The retained set is complete.

### `v19-held-alternatives`

The original says Ada is actually discussing two competing preliminary malfunction hypotheses, a slipping drive belt and a jammed cooling fan; neither has evidence and Ada has selected neither cause. Trace row 112 preserves the actual discussion, both exact alternatives, their tentative status, group-wide lack of evidence, and Ada's personal nonselection. Its affirmed polarity, tentative commitment, and active disposition correctly distinguish the factual discussion from the unestablished hypotheses. Trace row 113 independently selects affirmed polarity with all semantic dimensions true. The single record is complete.

## Public answers and citations

### Report — queries 0–7, generation rows 8, 12, 16, 20, 24, 28, 32, 36

Every block cites only the main reported-service record at `[memory/equipment:7]`, which is the record answering the focused report query. The separate no-collection record is retained but need not be selected for this question. English outputs reproduce the complete retained proposition. Russian outputs faithfully translate permission to send the device to a service bench for measuring return-spring tension and the contrast with replacement. They keep Bo as the reporting source, Ada as relayer, Ada's unread-terms and no-independent-confirmation limits, and her personal nonverification. No answer changes permission into a booking, shipment, completed measurement, or verified term. Language and verifier calls immediately following those generation rows accept the actual public text.

### Open question — queries 0–7, generation rows 44, 48, 52, 56, 60, 64, 68, 72

Each block cites the sole question record at `[memory/equipment:7]`. All English and Russian variants preserve Ada as the person with the open question and no answer, preventive coolant top-up as the service, the service contract as the scope, and the independent non-establishment of both inclusion and exclusion. None answers the embedded coverage question or turns uncertainty into a contract-wide exclusion. All eight pass language and source verification.

### Rejected offer — queries 0–7, generation rows 81, 85, 89, 93, 97, 101, 105, 109

Each focused answer cites the rejected-offer record at `[memory/equipment:7]`; omission of the separately retained pickup denial is appropriate for the offer question. All outputs preserve Ada as rejecting actor, the offer to send Zephyr QX-100, laboratory destination, rotor-balance measurement purpose, explicit rejection rather than acceptance, and no plan under that offer. Russian `измерение балансировки ротора` is stylistically awkward in two variants, while `измерение баланса ротора` is more idiomatic in others, but neither introduces a different tested property or operation. This is wording quality, not a material source error. All eight pass the recorded language and semantic checks.

### Competing hypotheses — queries 0–7, generation rows 117, 121, 125, 129, 133, 137, 141, 145

Each block cites the sole tentative record at `[memory/equipment:7]`. All variants preserve Ada's actual discussion activity, both competing hypotheses, their preliminary/tentative status, the absence of supporting evidence for both, and Ada's personal nonselection. None promotes either alternative to an established cause. The Russian labels `Предварительный статус` and `Предварительно` remain attached to the tentative record and do not weaken the explicit body. All eight pass language and semantic checks.

## Availability, routing, and limits

Retention generation/verifier spans are rows 2–3, 39–40, 75–76, and 112–113. No candidate is held or repaired in these cases. Routing places all six records, and every query retrieves its focused record. Each answer has one generated block, one guard-passing block, and one verified block. There is no `bad_response`, invalid structured output, language rejection, verification unavailability, or token/cap failure in the trace. This observed success does not establish general model competence or universal budget sufficiency.

All four report entries say `bytesStable: true`; the run did not alter source bytes. Ordinary hypothetical neighboring prose was not promoted into retained factual knowledge.

## Final classification

- Complete retained sets: **4/4**.
- Correctly typed retained records: **6/6**.
- Useful retrieval observations: **32/32**.
- Non-null published answers: **32/32**.
- Independently judged useful answers: **32/32**.
- Accepted material errors: **0**.
- Nulls or justified/false holds: **0**.
- Availability/schema/cap failures: **0**.
- Source-byte changes: **0**.

This is a bounded judgment of these exposed built cases. Positive runtime verdicts were not treated as proof; they are reported only after the independent source comparison above.
