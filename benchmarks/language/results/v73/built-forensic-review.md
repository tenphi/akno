# V73 built probe: independent source-first forensic review

## Scope and result

I read all four original sources, retained sets, retrieved evidence, and 32 public answer coordinates in `tmp/language-built-output-packet-v73.json` before inspecting the frozen report and trace. I did not use an independent grade or source-review as a truth label, inspect fresh held-out inputs, call a provider, rerun a benchmark, or change runtime files.

The source-first result is:

| Measure | Result |
| --- | ---: |
| Complete useful retained sets | 3/4 |
| Useful qualified retrieval observations | 24/32 |
| Produced answers | 24/32 |
| Useful source-faithful produced answers | 24/24 |
| Null answers | 8/32 |
| Accepted source/qualification/language/promotion errors | 0 |
| Case availability failures | 0/4 |
| Source-byte changes | 0/4 |

Question, rejected offer, and competing hypotheses are completely retained. The report case retains only the independent no-collection-booking denial and loses its central nested report. The eight report queries retrieve that unrelated denial but correctly do not answer from it; the nulls are safe public behavior yet unjustified coverage losses because the source and a faithful generated report record were available.

## Case findings

### `v19-held-report`: incomplete retention; 0/8 answers

The source establishes two independent propositions:

1. Ada Marlow says no collection of her device has been booked.
2. Ada relays Bo Winters's report that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension, rather than replace the spring. Ada has not read the terms, has no independent confirmation of the report, and did not personally verify the reported condition.

Trace row 2 extracts both. The booking denial is faithful, correctly negated, asserted, active, and self-attested. The 358-unit main report is also faithful and within the 400-unit cap. Its readable text preserves outer Ada and inner Bo, permission rather than booking or performance, service-bench destination, return-spring tension measurement, the no-replacement contrast, unread terms, lack of independent confirmation, relay status, and Ada's personal nonverification. Its source-report attribution, asserted inner report, affirmed embedded permission, active record status, support, frame, and empty relations are coherent.

No repair call occurs because this wording passes the local report-presentation checks. Row 3 sends both records to semantic verification. The verifier accepts the booking denial but rejects the main report with `proposition_supported: false`. Its mismatch says the candidate contains a stray Japanese word `報告`. The actual candidate text contains no such word. The token appears only in the verifier's own `candidate_meaning` explanation (`independently confirmed the報告`). The verifier therefore invents content in its private comparison and rejects the source-faithful candidate for that invented content. This is a semantic-verifier false hold, not a source error, language error in generated knowledge, report-text repair failure, cap failure, schema failure, or justified withholding.

Only the booking denial is written. It is accurately retrieved for all eight report questions but is not useful evidence for the requested return-spring report. Context remains empty and all eight outputs are `no_eligible_evidence`. No answer model or answer verifier is called. The abstentions avoid fabrication, but complete retention, useful retrieval, and answer coverage fail.

This run does not exercise V73's segmented report-text repair branch: the extraction candidate already satisfies the local readable-report guard and reaches semantic verification without repair.

### `v19-held-question`: complete retention; 8/8 useful answers

The Russian source is Ada's personal open question whether preventive coolant top-up for Zephyr QX-100 is included in the service contract. Ada has no answer, and neither inclusion nor exclusion is established.

The retained question preserves Ada as the experiencer, the preventive top-up service, contractual-inclusion question, lack of an answer, and the symmetric unresolved inclusion/exclusion status. Typed `kind: question`, `commitment: none`, active disposition, self-attested basis, and factual-ineligibility flags are appropriate. It does not answer the embedded question or invent an external asking/writing act.

All eight retrievals and answers use this record. English and Russian outputs preserve the same question and epistemic scope. Russian variants such as `не установлено ни включение ... ни её исключение` are natural equivalents and do not assert document silence or universal ignorance. All citations support every public clause. The `absent_from_both` tested-property classifications are appropriate here because no operation tests a named property.

### `v19-held-rejected`: complete retention; 8/8 useful focused answers

The source establishes Ada's rejection of the offer to send Zephyr QX-100 to a laboratory for rotor-balance measurement, her lack of a plan under that offer, and the independent fact that no pickup is booked. The offered shipment is rejected rather than accepted.

Rows 42 and 44 produce a faithful rejected-plan record and repair the initially underframed pickup denial. The repair adds exact Zephyr antecedent context without changing the no-pickup proposition. Row 45 accepts both. The retained metadata correctly distinguishes an asserted rejected plan with affirmed embedded shipment action from the separate asserted negated booking event. Neither record asserts actual shipment, measurement, pickup, or acceptance.

The retained set is complete. All eight focused answers cite only the rejected-offer record and faithfully identify Ada's rejection, laboratory shipment offer, rotor-balance measurement, and no plan under that offer. Omitting the independent no-pickup sibling is allowed for this focused question. Russian `измерение балансировки ротора` and `измерение баланса ротора` both preserve the proposed rotor-balance measurement without claiming balancing or measurement occurred.

The private tested-property audit is wrong on seven of these eight accepted paths. Answer-verifier rows 51, 55, 59, 63, 71, 75, and 79 select `absent_from_both` even though both cited source and public answer explicitly name rotor-balance measurement. Row 67 correctly selects `preserved`. These seven inconsistent private classifications do not make the public answers false, but they show that the dedicated property audit remains fallible.

### `v19-held-alternatives`: complete retention; 8/8 useful answers

The source says Ada actually discusses two competing preliminary fault hypotheses for Zephyr QX-100: a slipping drive belt and a jammed cooling fan. Neither has supporting evidence, and Ada has not selected a cause.

Rows 81–82 retain and verify one complete record. The readable text and metadata preserve Ada's actual discussion, both alternatives, their preliminary/competing status, lack of evidence, and Ada's personal nonselection. Tentative commitment qualifies the hypotheses rather than denying that Ada discusses them; active is record validity rather than progressive-time evidence.

All eight English and Russian answers preserve every coupled qualification and do not promote either hypothesis to an established cause. `подтверждающие свидетельства` and `подтверждающие доказательства` are both faithful for supporting evidence. Every citation selects the complete record. The private `absent_from_both` property label is appropriate because this is a hypothesis discussion, not an operation with a named tested property.

## Stage and accounting distinctions

The report records 24 produced answers, eight `no_eligible_evidence` outcomes, no operation/provider failures, no language-policy holds, and one retention hold at semantic verification. Those stage counts match the trace.

The authored benchmark heuristics report 4/4 useful retention and case-level qualified retrieval. They should not be used as independent semantic coverage. Source-first complete retention is 3/4 because the main report proposition is lost. Observation-level useful retrieval is 24/32 because the surviving booking denial does not answer any of the eight report queries. This distinction does not identify an accepted public error: all 24 produced answers remain independently useful and faithful.

The central new defect is the verifier treating a token it introduced in its own comparison prose as though it appeared in the candidate. The seven rotor-property `absent_from_both` results are separate accepted-path private audit errors. Neither issue changes source bytes, creates an unsafe factual promotion, or justifies weakening source verification. The frozen evidence should preserve the exact false-hold payload and the fact that the V73 report-text repair branch was not exercised by this built report case.
