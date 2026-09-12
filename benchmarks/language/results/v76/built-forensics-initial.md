# V76 built probe — independent source-first forensics (initial)

Frozen runtime: `44e6e714f1758948f306ec90cdae9b0d453e3604`. Scope: four development cases, one run, 32 answer coordinates. I read `tmp/v76-built-forensic-sources.json` and the public packet before inspecting benchmark flags or trace verdicts. I did not inspect independent grading, fresh held-out input, or provider-control results as semantic evidence.

## Result

- Complete source-faithful retained sets: **4/4 cases**, **6/6 required records**.
- Useful retrieval: **32/32 coordinates**. Every answer selected the focused record that supports its asserted clauses.
- Published answers: **32/32 non-null and source-faithful**.
- Nulls: **0**.
- Accepted source, actor, predicate, object, property, qualification, polarity, language, or promotion errors: **0**.
- Availability failures: **0 cases**; retention and answers report no degraded operation.
- Source-byte changes: **0**; all four cases report `bytesStable:true`.

The benchmark's positive flags agree with this source review, but they are not the basis for the judgments above.

## Case audit

### `v19-held-report`

The two retained records are complete and distinct.

1. The report record preserves Ada Marlow as outer reporter, Bo Winters as inner source, the terms' permission to send the Zephyr QX-100 to a service bench, the purpose of measuring return-spring tension, and the explicit contrast with replacing the spring. It separately preserves that Ada has not read the terms, has no independent confirmation of the report, and treats the condition as Bo's wording in her retelling rather than one she verified. Its `source_report`, affirmed report-content polarity, and named attribution chain are faithful.
2. The independent denial preserves that no collection of Ada's device has been booked. Its negated polarity is correct. The unresolved typed subject does not supply the device identity, but the prose and owned source span do; this is not used to support the focused report answers.

All eight answers cite only `[memory/equipment:7]`, the report record. That is the correct focused selection for the query. English outputs reproduce the retained proposition; Russian outputs faithfully translate permission, measurement rather than replacement, both personal epistemic limits, and the Ada/Bo reporting roles. None imply a booking, actual shipment, completed measurement, spring replacement, or verified term.

Trace coordinates: extraction row 6; source verifier row 11; placement rows 16/21. Answer generation rows 45, 62, 83, 100, 121, 138, 159, 176; independent answer verification rows 50, 67, 88, 105, 126, 143, 164, 181. All eight published blocks survived language and mandatory source verification.

### `v19-held-question`

The single record preserves Ada's open question about whether preventive coolant top-up for Zephyr QX-100 is included in the service agreement, Ada's lack of an answer, and the source's exact epistemic state: neither inclusion nor exclusion has been established. `kind:question`, `commitment:none`, and affirmed polarity describe the existence of the open question; they do not affirm coverage.

All eight answers cite the question record and preserve the same meaning in the requested language. The Russian sentence `ни включение этой услуги, ни её исключение не установлены` leaves the agreement state unresolved; it does not claim that agreement terms are an actor that failed to establish a result and does not answer the embedded coverage question.

Trace coordinates: extraction row 188; verifier row 193; placement row 198. Answer generation rows 218, 235, 256, 273, 294, 311, 332, 349; verifier rows 223, 240, 261, 278, 299, 316, 337, 354.

### `v19-held-rejected`

The final retained set contains both required records:

1. Ada declined the offer to send Zephyr QX-100 to a laboratory for rotor-balance measurement; the shipment was rejected rather than accepted, and she has no plan to send the device under it. `kind:plan` denotes the offered course of action, while `disposition:rejected` and the prose prevent adoption or intent.
2. No pickup of Zephyr QX-100 has been booked, with negated polarity.

The initial no-pickup candidate was locally held because its frame also contained rejected-plan discourse. The sole full-candidate repair at trace row 368 retained original index 1, narrowed the decisive second source quote to `No pickup of the device has been booked.`, kept the admitted rejection sibling immutable, and preserved the relevant antecedent context. The complete two-candidate batch then received positive original-source verification at row 373. This was a successful structural repair, not a semantic retry.

All eight focused answers cite `[memory/equipment:6]`, the rejected-offer record. They preserve Ada as rejecting actor, the offered sending action, device, laboratory destination, rotor-balance measurement purpose, rejection/nonacceptance, and lack of a plan. Omitting the separate pickup denial is proper focused selection because no published clause depends on it. No answer implies actual shipment, measurement, pickup, or accepted plan.

Trace coordinates: extraction row 361; repair row 368; verifier row 373; placement rows 378/383. Answer generation rows 407, 424, 445, 462, 483, 500, 521, 538; verifier rows 412, 429, 450, 467, 488, 505, 526, 543.

### `v19-held-alternatives`

The single retained record preserves Ada's actual discussion of two competing preliminary malfunction hypotheses: a slipping drive belt and a jammed cooling fan. It also preserves that neither has supporting evidence and that Ada has not selected a cause. `commitment:tentative` applies to the hypotheses; the prose still states the discussion act as actual.

All eight answers cite this record and preserve both alternatives, their competing/preliminary status, lack of evidence, Ada's discussion role, and her personal nonselection. English and Russian component vocabulary is translated appropriately. None promote either alternative to an established cause.

Trace coordinates: extraction row 550; verifier row 555; placement row 560. Answer generation rows 580, 597, 618, 635, 656, 673, 694, 711; verifier rows 585, 602, 623, 640, 661, 678, 699, 716.

## Stage and availability accounting

There are no answer holds to classify. Every coordinate reached answer generation, language validation, and the mandatory source verifier, and every final block was published. The one retention repair is described above. There are no `bad_response`, schema-invalid, transport-unavailable, token-cap, language rejection, or semantic-negative answer outcomes in the report.

The trace has balanced model/transport lifecycle records; the report records no case availability failure. Provider protocol echoes are excluded from this semantic assessment.

## Bounded conclusion

This built probe needs no corrective runtime scope based on its four cases. It demonstrates complete retention and faithful focused answers for these exposed sources in this single run. It does not establish behavior on the concurrently running selected set, repeated cells, or fresh held-out V21 inputs, and it does not by itself authorize the conditional full trial.
