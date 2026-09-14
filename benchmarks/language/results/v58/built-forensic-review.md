# V58 built-package forensic review

## Scope

This is an independent source-first review of frozen V58 (`dae04e21bfe8b5b3f394b634bd8a8efa4f43ddee`). I compared the four original cases in [language-v19-blind-inputs.json](language-v19-blind-inputs.json), retained records and published answers in [language-built-output-packet-v58.json](language-built-output-packet-v58.json), aggregate/runtime fields in [language-built-reliability-v58.json](built-reliability.json), and all 144 records in [language-built-reliability-v58-trace.jsonl](../../../../bench-results/language-built-reliability-v58-trace.jsonl). I did not inspect an independent grading receipt.

Coordinates use the fixed order: `q1` EN→EN inferred, `q2` EN→RU inferred, `q3` EN→EN explicit, `q4` EN→RU explicit, `q5` RU→EN inferred, `q6` RU→RU inferred, `q7` RU→EN explicit, and `q8` RU→RU explicit. Trace rows are one-based JSONL records.

## Disposition

V58 published 29/32 answers. In my reading, all 29 preserve the source proposition, actor, nonfactual status, and requested language. I found no definite accepted source, qualification, or language error. The three nulls—report q1, q3, and q4—are unjustified writable-case abstentions: their model outputs are valid empty block sets based on an incorrect dial/regulator conflict reading, while the source offers a faithful report answer.

There are no answer operation failures, language-policy rejections, malformed schemas, or trace operations with `ok=false`. All query recalls return one qualified, relevant record. All 29 generated blocks pass local guards and the mandatory semantic verifier. Source bytes remain unchanged in all four cases.

The aggregate’s `usefulRetentionCoverage=4/4` is a runtime expectation metric rather than an independent complete-set judgment. I find three fully useful retained sets and one incomplete set: the report loses Ada’s separate no-collection-instruction proposition after correctly rejecting a flawed generated representation. This semantic retention hold is not an availability failure; the report shows `availabilityFailures=0/4` and no degraded call.

The declared ceilings are answer 2,400 and retention 2,400 tokens. The largest output is the report retention-verifier response at 2,112 tokens; the largest extraction is 1,853 and largest answer generation is 804. No output reaches the ceiling, and no schema or trace evidence indicates truncation.

## Retention, repair positions, and placement

### `v18-held-report`

Extraction trace row 2 returns two candidates:

1. A qualified nested report: Ada reports only Bo’s statement that the terms permit technician calibration of the regulator, rather than replacement, and explicitly says she has neither seen the terms nor received confirmation.
2. Ada’s personal denial of giving a collection instruction, followed by the generated meta-qualification that the object of `it` remains unspecified.

Verifier row 3 accepts candidate 0 on all three dimensions. Its four audited frame spans contain the English dial report, Russian regulator-calibration/replacement clarification, Ada’s two personal limits, and the wider English support span. The verifier explicitly interprets dial/regulator as the same source-clarified control and keeps Ada→Bo roles intact.

It correctly rejects candidate 1. The complete source resolves `it` to the device in the immediately preceding report; the candidate instead asserts that its object is unspecified. Proposition, action arguments, and qualification are all false. Because this is a semantic-verifier hold, no structural repair is allowed. Only candidate 0 is placed (`ownership` row 4 selects the existing product page).

The retained E1 is source-faithful, but the retained set omits the source-supported proposition “I, Ada Marlow, have given no instruction to collect [the device].” This is a genuine retention-coverage loss caused by an added unresolved-reference claim, not a source-frame accounting, placement, or service-availability failure. The smallest correction is extraction wording that resolves the exact antecedent without adding meta-commentary; the verifier should continue to reject “unspecified.”

### `v18-held-question`

Extraction row 32 returns three source-faithful candidates: Ada’s open question, Ada’s personal lack of an answer, and the note’s separate neutrality between inclusion and exclusion.

Original candidate position 1 says Ada has no answer and includes `Zephyr QX-100` in subject metadata and readable prose, but its deciding frame initially contains only `I still have no answer.` The V58 identifier/frame floor holds exactly that position. Repair row 34 returns position 1 with the same proposition plus the exact question antecedent in support and frame. Positions 0 and 2 remain unchanged. The repaired transaction is valid: verifier row 35 checks positions 0/1 and row 36 checks position 2; all receive complete span audits and all three semantic dimensions true. There is no duplicate, lost position, degradation, or second retry.

Placement rows 37–39 send the open question and note-neutrality records to the existing product page. The repaired personal-no-answer record selects its proposed destination. That fragments a redundant qualification across pages, but it is not a routing hold and does not remove it from retained knowledge. Each answer query retrieves the open-question E1; that record alone identifies Ada’s unresolved coverage question and is sufficient for the focused query.

This is direct evidence that the V58 floor remains rejection/repair-only: complete-source identifier occurrence did not approve the initial candidate; readable identity and an exact antecedent span were required, then full source semantics remained mandatory.

### `v18-held-rejected`

Extraction row 73 produces two records, and verifier row 74 accepts both:

- E1 combines Ada’s explicit rejection rather than acceptance of the service-centre thermostat-measurement offer with her personal lack of a plan under that offer.
- E2 preserves the separate statement that no handover of the device has been booked.

There is no repair call. E1 is placed on the existing product page (row 75); E2 selects its proposed destination (row 76). E2 keeps the source’s generic `the device` wording and a generic subject rather than inventing a Zephyr identifier. In complete context the referent is likely Zephyr QX-100, so the record is less independently identifiable than it could be, but it does preserve the authored booking denial without a false product assignment. I do not count that conservative wording as a missing proposition.

The live candidate does not use the new quoted-alias form, so this probe does not exercise that exact grammar. It demonstrates that the case no longer incurs V57’s `time_unresolved`/duplicate-repair degradation. The frozen compiled controls, rather than this live output, are the evidence for the quoted-alias path itself.

### `v18-held-alternatives`

Extraction row 110 produces one complete record and row 111 accepts it on all dimensions. It preserves:

- Ada as the person considering the explanations;
- the two alternatives, an internal connector *that was inserted loosely* and a faulty temperature probe;
- tentative/unestablished status;
- absence of evidence for both; and
- Ada’s selection of neither cause.

The phrase “that was inserted loosely” retains the source attachment of `неплотно` to `вставленный`; it does not repeat V57’s “internally loose connector” change. The record is placed on the existing product page at row 112. This is a complete and independently useful retained set with no repair.

## Published answers and nulls

### Report

Five of eight report rows publish. The exact answer bodies are:

- **q2:** `**Сообщила Ada Marlow:** По словам Ada Marlow, Bo Winters сообщает, что условия обслуживания Zephyr QX-100 разрешают отправить устройство технику для калибровки регулятора, а не для замены регулятора; Ada Marlow не видела самих условий и не получила подтверждения этого сообщения.`
- **q5 and q7:** exact copy of E1: `**Reported by Ada Marlow:** According to Ada Marlow, Bo Winters says that the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not replacement of the regulator; Ada Marlow has not seen the terms or received confirmation of this message.`
- **q6:** `**Сообщено Ada Marlow:** По словам Ada Marlow, Bo Winters сообщает, что условия обслуживания Zephyr QX-100 разрешают отправить устройство техническому специалисту для калибровки регулятора, а не для замены регулятора; Ada Marlow не видела самих условий и не получила подтверждения этого сообщения.`
- **q8:** the same complete Russian proposition, using `специалисту` and `не видела условий`.

All preserve permission rather than shipment performance, Ada as outer source, Bo as inner reporter, calibration versus replacement, and Ada’s personal lack of inspection and confirmation. `Сообщено Ada Marlow` is locally recipient-ambiguous and `Сообщила Ada Marlow` is stylistically awkward, but each body immediately states `По словам Ada Marlow, Bo Winters сообщает`; no actor reversal or lost qualification results.

As in my V57 review, I interpret the Russian source as clarifying the English `dial` referent to `регулятор`, with replacement of that same control excluded. A narrower reading of English *dial* as only a scale/dial face would make “regulator” broader; this lexical ambiguity should remain visible rather than be silently treated as an alias rule. Within this bilingual source’s explicit “only Bo’s words” restatement, I do not classify the five outputs as definite component errors.

The three nulls are all generated empty drafts:

- **q1, trace rows 5–6:** the private reading calls regulator versus dial an unresolved conflict and lists a dial-calibration report as missing.
- **q3, rows 11–12:** the reading is truncated mid-phrase in `selected_meaning` (“whether the calibrated component is the”) but the overall JSON is valid; its ambiguity field again declares dial and regulator conflicting, then returns no blocks.
- **q4, rows 13–14:** the private reading correctly says the later Russian source explicitly clarifies regulator calibration, but still refuses the English-query term `dial` and lists a dial report as missing.

No guard or verifier rejects these rows because there is no block to check. They are selection/interpretation abstentions in the first and only answer-generation call. Their inconsistency is especially clear because q2 answers the same English question faithfully in Russian, while q5–q8 answer the regulator-worded Russian question. The retention verifier had already reconciled the exact source spans; no span, storage, retrieval, or language datum is absent.

### Open question

All eight rows answer from the single complete E1 record. q1, q3, q5, and q7 are exact English copies:

> **Open question:** Ada Marlow has an unresolved question about whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter.

The Russian translations are:

- **q2:** `**Открытый вопрос:** Ada Marlow не разрешила вопрос о том, включает ли сервисное соглашение на Zephyr QX-100 профилактическую очистку фильтра.`
- **q4:** `**Открытый вопрос:** у Ada Marlow остаётся нерешённым вопрос о том, включает ли договор обслуживания Zephyr QX-100 профилактическую очистку фильтра.`
- **q6:** the q4 structure with `сервисное соглашение` and `профилактическую чистку`.
- **q8:** `**Открытый вопрос:** у Ada Marlow остаётся нерешённый вопрос о том, включает ли сервисное соглашение Zephyr QX-100 профилактическую чистку фильтра.`

Each keeps the question open and attaches it to Ada; none decides inclusion, exclusion, or booking. q2’s active wording literally says Ada “did not resolve the question,” which is less neutral than “Ada has an unresolved question.” The original also says Ada still has no answer, and the answer does not add a result or another actor, so I treat it as an awkward but source-supported personal nonresolution rather than a material error. The answer does not repeat the private-frame recording act; that is consistent with the selected-record rule.

### Rejected offer

All eight rows render the complete E1 record. q1, q3, q5, and q7 publish the exact English text:

> **Rejected:** Ada Marlow declined, rather than accepted, an offer to send Zephyr QX-100 to the service centre for a thermostat measurement, and she has no plan to send it under that offer.

q2 and q4 translate it as `Ada Marlow отклонила, а не приняла ... для измерения термостата, и у неё нет плана ...`; q6 uses `измерения параметров термостата` and `в рамках этого предложения`; q8 uses `она не планирует отправлять его`. All preserve Ada’s rejection, shipment object, destination, thermostat-measurement purpose, and personal no-plan clause. None creates acceptance, a booking, shipment performance, or a completed measurement.

Because recall returns E1 alone, these rows use complete-record rendering rather than collective legacy composition. Every clause of E1 is present. The verifier’s focused ordinary no-plan omission rule is therefore not invoked, and the V57 multi-citation failure shape does not recur.

### Competing alternatives

All eight rows render complete E1. q1, q3, q5, and q7 publish the exact English record:

> **Tentative:** Ada Marlow is considering two competing tentative explanations for failures of Zephyr QX-100—an internal connector that was inserted loosely or a faulty temperature probe—but neither explanation has evidence and she has selected neither cause.

The four Russian translations use either `неплотно вставленный внутренний разъём` or the equivalent `внутренний разъём, вставленный неплотно`, alongside `неисправный температурный зонд`. All explicitly preserve no evidence for either and Ada’s nonselection. The repeated `предварительных` is stylistically heavy but keeps tentative scope. There is no established cause, generalized installation defect, or actor loss.

## Rendering, anchor, and availability audit

All 32 query rows enter the one-record complete renderer. The model choices are 14 `copy`, 15 `translate`, and three empty report choices. Every nonempty choice reaches the requested-language check and semantic verifier; none fails either. Copy text is the current canonical payload, translation text remains model-generated, and citations are appended only after acceptance. The trace contains no raw draft that differs from the published nonnull answer.

Verifier inputs keep immutable answer segments and original-frame spans separate. I found no missing, duplicate, stale, or foreign segment reference; no frame-only proposition is disclosed; and no private frame supplies selection. The question’s repair adds an exact original antecedent to retention support/frame, while the answer still selects only the retained question. The report collection denial is present only as an unselected private neighbor of E1 after its own flawed candidate is held; no answer imports it.

Availability and semantic disposition must remain separate:

- **Service/model availability:** zero case failures and zero answer operation failures.
- **Structural repair:** exactly one repair, original question candidate position 1, accepted without degradation and then semantically verified.
- **Semantic retention hold:** report candidate 1 is correctly held for its false “unspecified object” qualification; this creates an incomplete retained set.
- **Placement:** every accepted candidate gets `page_1` or `proposed`; there is no routing hold. Two secondary records select proposed destinations, causing benign fragmentation but no loss.
- **Retrieval:** every query retrieves one relevant qualified record; the focused answer source is sufficient in all four cases.
- **Answer semantics:** 29 accepted, all source-faithful in my reading; three valid empty drafts are source-answerable interpretation failures.

## Bounded next scope

The evidence supports one remaining direct correction: the existing answer source-reading contract should treat an explicit cross-language restatement consistently whether the query repeats the earlier term or the later clarified term. The retention verifier already demonstrates the needed behavior on exact spans. A new alias dictionary, deterministic word substitution, semantic retry, or extra model pass is not supported.

The report’s lost collection denial is a second extraction-quality issue: retain the authored denial with its resolved device antecedent and no generated explanation about extraction ambiguity. The current semantic rejection must remain.

V58 already demonstrates the identifier-frame repair and connector-insertion preservation. The live rejected case does not exercise the quoted-alias branch, and the current one-record recalls do not exercise collective multi-citation selection; those changes remain supported by compiled/local controls rather than this particular live output. No threshold, schema, output cap, routing bypass, or semantic-verifier relaxation is warranted.
