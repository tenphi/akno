# V72 built probe: independent source-first forensic review

## Scope and result

I reviewed the four original source packets before inspecting the retained prose, public answers, and runtime verdicts. This is an independent forensic assessment of the single frozen V72 built run (`93c7444ff2d860d88649af97db3ccf75bc6c82fd`). I did not read an independent grade, call a provider, or rerun the probe. The deterministic rejected-candidate replay imported `cleanCandidateBatch` from `tmp/core-v72/dist/write/retain.js`; it did not use the live worktree runtime.

**Correction receipt:** the initial review named the preceding V71 SHA `304b2195…`. The V72 frozen SHA is `93c7444ff2d860d88649af97db3ccf75bc6c82fd`; only this provenance label was corrected, and the initial text is preserved in `tmp/language-v72-built-forensic-review-initial.md`.

The run produced 24 of 32 answers. All 24 published answers are source-faithful and useful for their focused query. The eight nulls all belong to `v19-held-alternatives` and arise from a source-true record being held before retrieval. There are no availability, operation, language, cap, schema-transport, citation, or source-byte failures in the report. The important failures are retention completeness and verifier audit accuracy:

- Full source retention is complete for **2/4 cases**: report and question.
- Rejected retains the focused rejected offer but loses the independent no-pickup fact.
- Alternatives retains nothing, although its repaired candidate is faithful.
- Ten accepted answer-verifier verdicts incorrectly mark an explicitly named tested property `absent_from_both`. This is an audit-classification defect; the corresponding public wording remains faithful.

## Case findings

### `v19-held-report`: complete retention; 8/8 faithful answers

The source has two independent propositions: Ada has not booked collection, and Ada relays Bo's report that the terms permit sending Zephyr QX-100 to a service bench to measure return-spring tension rather than replace the spring. Ada has not read the terms, lacks independent confirmation of the report, and did not personally verify the condition.

Trace row 2 extracts both propositions. Their retained metadata is coherent:

- the booking denial is a self-attested, asserted, active, negated claim;
- the main report is an asserted source report with outer Ada and inner Bo, affirmed embedded permission, and the full bilingual clarification in its frame.

Trace row 3 verifies both and both are routed. The retained main text preserves possession of no independent confirmation (`has no independent confirmation`), rather than changing it into merely not receiving confirmation. It separately preserves personal nonverification. The report's `polarity: affirmed` describes the embedded permission/report content; the separate denial correctly has `polarity: negated`.

All eight answers (packet coordinates q0–q7; verifier rows 9, 13, 17, 21, 25, 29, 33, and 37) cite only `memory/equipment:7`, the main report record. They preserve Ada as outer reporter, Bo as the reported speaker, permission rather than booking/performance, service-bench destination, return-spring tension measurement, the replacement contrast, and Ada's three epistemic limits. The English and Russian outputs are grammatical and remain within source scope. Omitting the unrelated no-booking record is correct for this focused report query.

The property audit is internally wrong on q0/q1/q2/q3/q5/q7 (rows 9, 13, 17, 21, 29, 37): it reports `tested_property.relation: absent_from_both` with both anchors/properties null even though source and answer explicitly say the operation measures **return-spring tension**. Rows 25 and 33 correctly classify that property as `preserved`. This inconsistency does not make the six answers false—the operation comparison and public prose still preserve the property—but it demonstrates that the new state distinction does not yet force the verifier to select an explicit material property.

### `v19-held-question`: complete retention; 8/8 faithful answers

The source is Ada's own open question whether preventive coolant top-up for Zephyr QX-100 is included in the service agreement. Ada has no answer, and neither inclusion nor exclusion is established.

Trace rows 39–40 extract and verify one question record with `kind: question`, `commitment: none`, self-attested basis, Ada as the experiencer, and both the personal lack of an answer and record-level non-establishment. All eight answers (q0–q7; verifier rows 45, 49, 53, 57, 61, 65, 69, 73) preserve those scopes. None answers the embedded coverage question or invents an asking, writing, agreement, or external-agent event. Russian `не установлено ни включение ... ни исключение` and its word-order variants are faithful.

Every question verdict uses `tested_property: absent_from_both`. That is appropriate here: coolant top-up is the service whose contractual inclusion is questioned, not a property tested by an operation. Under the focused-supported-subset contract, the answer need not repeat a matrix predicate supplied only by the query; here the answers in fact preserve all deciding source predicates anyway.

### `v19-held-rejected`: focused record faithful; independent no-pickup record falsely held

The source establishes (1) Ada declined an offer to send Zephyr QX-100 to a laboratory for rotor-balance measurement and has no plan to send it under that offer, and (2) independently, no pickup was booked and the offered shipment was rejected rather than accepted.

Trace row 75 initially emits both. The rejected-plan record is faithful and correctly typed `kind: plan`, asserted/rejected, affirmed: that metadata records the rejected course of action and does not assert intent or acceptance. The no-pickup candidate is initially held because its readable/frame text lacks the declared Zephyr identifier. Row 77 repairs it to the faithful independent statement `Ada Marlow states that no pickup of Zephyr QX-100 has been booked.` with exact source/antecedent spans.

Frozen V72 `cleanCandidateBatch` replay establishes the next failure precisely: the initial no-pickup candidate is `validation_failed` for the missing readable/frame identifier; the repaired candidate is then held `discourse_uncertain` because its broad frame also contains the rejected offer and trips `asserted commitment is incompatible with modal, fictional or rejection scope in this frame`. The repaired proposition itself is a plain asserted current no-booking fact. This is a local whole-frame false hold, not a semantic rejection or a justified abstention. Row 78 therefore verifies only the rejected-plan record.

All eight public answers (q0–q7; verifier rows 83, 87, 91, 95, 99, 103, 107, 111) cite that surviving record and faithfully answer the focused offer query. They preserve Ada's rejection, lack of a plan under the offer, Zephyr QX-100, laboratory destination, and rotor-balance measurement. They do not claim shipment, booking, measurement, or acceptance. The missing no-pickup record is a retained-set completeness loss, but its omission from this focused offer answer is allowed.

The tested-property audit again misclassifies explicit content on q1/q3/q4/q6 (rows 87, 95, 99, 107): `rotor-balance`/`баланс ротора` is present in both source and answer, yet the verdict selects `absent_from_both`. Rows 83, 91, 103, and 111 correctly select and preserve it. The q1 Russian `измерения баланса ротора` and q3 `измерения балансировки ротора` are somewhat different phrasings, but neither asserts that balancing occurred; in the full offer context both denote the proposed rotor-balance measurement. I do not classify either as a material source error.

### `v19-held-alternatives`: complete source-true candidate falsely rejected; 8/8 null

The source says Ada actually discusses two competing preliminary fault hypotheses—a slipping drive belt and a jammed cooling fan. Neither has supporting evidence, and Ada has not selected a cause. Tentativeness qualifies the hypotheses, not whether Ada discusses them.

Trace row 113 extracts a semantically complete candidate but labels the whole record asserted. The local cleaner correctly holds that initial representation as `noncanonical_without_context`, because the preliminary hypotheses require noncanonical commitment metadata. Row 115 repairs only the metadata/text presentation: it uses `commitment: tentative` and preserves the actual discussion, both alternatives, their lack of evidence, and Ada's personal nonselection.

Trace row 116 rejects that repaired record with `qualification_scope_preserved: false`, claiming tentative commitment broadens to Ada's discussion act. That conclusion conflicts with the verifier payload's own `record_scope`, which explicitly defines this coupled case: when an asserted discussion is coupled with competing preliminary hypotheses, tentative qualifies those hypotheses and does not make the discussion act uncertain. The repaired public proposition is source-faithful. This is a semantic-verifier false hold, not a bad-draft hold.

Because nothing is retained, all q0–q7 results are `no_eligible_evidence`; no answer generation or verification call occurs. These are eight availability-safe nulls but not justified case abstentions: adequate source evidence existed and the only repaired candidate should have survived under the declared typed semantics.

## Counts and stage inventory

| Category | Count | Evidence |
| --- | ---: | --- |
| Source cases | 4 | report, question, rejected, alternatives |
| Fully retained source sets | 2/4 | report and question |
| Partially retained sets | 1/4 | rejected: no-pickup fact lost |
| Empty retained sets | 1/4 | alternatives |
| Produced public answers | 24/32 | all non-alternatives coordinates |
| Independently source-faithful produced answers | 24/24 | no accepted content, qualification, polarity, role, citation, or language defect found |
| Null answers | 8/32 | alternatives q0–q7, all `no_eligible_evidence` |
| Local false-held source proposition | 1 | rejected no-pickup repair after row 77 |
| Semantic false-held source proposition | 1 | alternatives row 116 |
| Incorrect `absent_from_both` property audits | 10 | report rows 9/13/17/21/29/37; rejected rows 87/95/99/107 |
| Availability/operation failures | 0 | report metrics and trace |
| Source byte changes | 0/4 | every case reports `bytesStable: true` |

The benchmark's `usefulRetentionCoverage: 3/4` is a case-level heuristic and should not be read as complete proposition coverage. Source-first completeness is 2/4 because the rejected case loses a separate asserted no-pickup record.

## Bounded next scope

1. The rejected-case loss supports candidate-specific repair context and independent proposition frames. A repaired no-pickup assertion should not inherit the neighboring rejected-offer scope merely to resolve `Zephyr QX-100`. Preserve the exact antecedent span while keeping the deciding no-pickup frame isolated; keep full-source semantic verification mandatory.
2. The alternatives failure needs consistency between the typed `record_scope` and verifier decision: the existing coupled discussion/hypothesis rule must be applied to the source/candidate comparison, without treating tentative metadata as uncertainty about the actual discussion. This is a contract application fix, not a relaxation of tentative semantics.
3. `absent_from_both` needs a provider-visible dependency: when a selected source/answer operation explicitly names a tested property, the property state cannot be absent. The current verifier can acknowledge the property inside `object_and_operation` while nulling the dedicated property audit. Preserve ordinary operations with no tested property and retain mandatory semantic dimensions; do not introduce a dictionary or infer properties absent from prose.

These defects justify targeted structural/schema and contract-consistency work. They do not show a need for another model call, retry, larger cap, or weaker semantic gate.
