# V75 selected-development source-first forensics — initial complete review

## Scope and method

This review covers the finalized 64-observation selected V75 probe at frozen runtime `c699916e8f0f8f6537dcb66558ded4f998cf8cfd`. I read the eight original sources in `tmp/v75-selected-forensic-sources.json` before inspecting `bench-results/language-selected-v75-trace.jsonl`, `bench-results/language-selected-v75.json`, and `tmp/language-selected-output-packet-v75.json`.

I did not use a grading receipt, private knowledge base, or fresh held-out input. Source truth comes from the original invented source bytes. Generated `record_readings`, verifier comparison prose, alignments, and positive booleans are fallible outputs rather than authority.

Query indices below are zero-based. Their fixed order is: EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, RU→RU explicit.

## Overall disposition

- The report contains 55 published answers and 9 nulls: 3 `draft_rejected`, 4 `verification_rejected`, and 2 `generation_failed`.
- I find all 55 published answers source-faithful, adequately qualified, and in the requested language. I found no accepted source, qualification, language, polarity, promotion, actor, property, or mechanism error.
- All nine nulls occur on writable cases whose originals support a faithful answer. They are therefore case-level coverage losses. Four are faithful drafts stopped by local or excerpt-selection judgments; three are bad or incorrectly scoped drafts correctly stopped; two are Russian drafts correctly stopped by the language checker.
- All eight cases have useful retained evidence and successful retrieval for all eight coordinates. The complete retained set has 11 records: report 2, hypothesis 1, counterfactual 2, exclusion 1, assistant 1, fiction 2, undated 1, and alternatives 1.
- There are no case availability failures and no source-byte changes. The two `generation_failed` answers are typed answer-operation failures after language rejection, not case availability failures.

## Original-source obligations and retention

### `v20-held-report`

The original establishes two independent propositions: Ada Marlow has not arranged delivery of her Zephyr QX-100, and Ada relays Bo Winters's account that the agreement permits sending the device to a workshop to measure the latch gap. It explicitly excludes changing the latch and states Ada's personal lack of reading and independent checking.

Extraction row 6 creates two records. Retention-verifier row 11 returns the source-selected polarity `negated` for the delivery denial and `affirmed` for the report, matching their metadata. Both are written after placement rows 16 and 21. The report record preserves Bo as inner source, Ada as outer relay, workshop sending, gap measurement, nonreplacement, and both personal epistemic limits. The delivery denial remains independent and readable. This is a complete and useful retained set.

The new negative-evidence disagreement branch is not exercised: both candidates have `polarity_evidence: null` because the source-selected polarity equals their server metadata.

### `v20-held-hypothesis`

The original makes Ada's three-month mesh-screen inspection rule hypothetical, makes the missed-check consequence conditional on that premise, states that Ada does not know actual requirements, and denies that an actual missed inspection is being reported.

Extraction row 188, verifier row 193, and placement row 198 produce one complete record with all four qualifications. Its affirmed polarity applies to Ada's introduction of the hypothetical premise, not to a real inspection obligation or actual miss. The retained set is complete and useful.

### `v20-held-counterfactual`

The original combines Ada's actual refusal/nonpurchase with an unrealized conditional: if she had bought the optional extension, fifth-year wheel-hub repair would have been covered. It expressly denies current coverage.

Initial extraction row 361 produces the refusal and a shorter counterfactual candidate. The single structural repair at row 368 targets original candidate index 1 and adds Zephyr QX-100, the explicit nonpurchase, and no-active-coverage consequence while preserving candidate 0. Verifier row 373 accepts both at their original positions; placement rows 378 and 383 write both. The final retained set is complete and useful.

### `v20-held-exclusion`

The original asserts that the warranty does not cover a cracked support plate. It says this record does not settle drive-shaft-repair coverage and explicitly denies making a whole-contract-silence claim.

Extraction row 532 keeps all three propositions in one negated, self-attested record. Verifier row 537 selects `negated`, matching metadata, and placement row 542 writes it. Coverage roles remain warranty→cracked plate; drive-shaft repair is an unresolved coverage object rather than a coverer. The retained record is complete and useful.

### `v20-held-assistant`

The original is the assistant's tentative belief that servicing might include a monthly connector-continuity test. It is a possible contractual term, not an established obligation; the assistant has read neither the agreement nor verified the interpretation.

Extraction row 724 and verifier row 729 preserve assistant attribution, continuity as the tested property, monthly frequency, both personal epistemic limits, possible-contractual-term sense, and tentative scope. Placement row 734 writes one complete useful record.

### `v20-held-fiction`

The original contains an actual Ada proposal to discuss a fictional case and, within that case, Vulpine Mutual's promise to fictional Bo Winters of free hinge-pin replacements during the first eleven ownership days. No real contract or actual-world promise follows.

Extraction row 897 creates the proposal and promise separately. Verifier row 902 preserves the full fictional frame, promisor, recipient, free replacement action, object, duration, and no-real-contract scope. Placement rows 907 and 912 write both. This is a complete useful retained set.

### `v20-held-undated`

The original establishes Ada's proposal to review repair terms next month, relative to the undated original record rather than processing time. The calendar month cannot be recovered. Ada has accepted no plan and organized no meeting.

Extraction row 1061, verifier row 1066, and placement row 1071 write one useful record preserving the proposal, actor, repair-term review, next-month relation to the source record, unknown calendar month, no plan, and no meeting. The visible retained prose does not repeat the original's explicit negative clause “not after processing.” Its affirmative source-record anchor semantically identifies the correct clock and excludes processing as the anchor, so I treat the core temporal obligation as preserved. The omission is still material to later excerpt selection: private-frame-only recovery of that explicit contrast is rejected inconsistently across otherwise equivalent Russian outputs.

The V74 clock-repair transaction is not exercised in this case; the initial candidate passes directly.

### `v20-held-alternatives`

The original says Ada is considering a bent guide versus a loosened belt fastening as tentative competing hypotheses. She has selected neither, and neither has supporting evidence.

Extraction row 1234 and grouped span audit/verifier row 1239 keep both alternatives, Ada's actual consideration, preliminary status, personal nonselection, and group-wide absence of evidence in one record. Placement row 1244 writes it. This is complete and useful. No hypothesis becomes established, selected, or changed into an actual discussion.

## Published answers and holds by case

| Case | Published | Null | Source-first result |
|---|---:|---:|---|
| report | 8 | 0 | All eight preserve Bo→Ada attribution, latch-gap measurement, nonreplacement, and Ada's personal unread/unchecked limits. Omitting the separately retained no-delivery denial is appropriate for the focused report answer. |
| hypothesis | 8 | 0 | All eight preserve the hypothetical three-month premise, conditional missed-check consequence, unknown real requirements, and no actual miss. |
| counterfactual | 6 | 2 | Six published answers are faithful. Two faithful Russian drafts are false-held by the finite local discourse grammar. |
| exclusion | 7 | 1 | Seven are faithful. One malformed Russian coverage-role inversion is correctly held locally. |
| assistant | 7 | 1 | Seven are faithful. One continuity→integrity translation is correctly rejected by the semantic verifier. |
| fiction | 5 | 3 | Five are faithful. Two leave `hinge-pin` untranslated and fail language policy; one cites only the promise record while adding Ada's proposal act and is correctly rejected. |
| undated | 6 | 2 | Six published answers are faithful. Two source-faithful structured translations are rejected because their processing-clock exclusion is absent from the visible selected excerpt. |
| alternatives | 8 | 0 | All eight preserve the exact competing alternatives, Ada's consideration/nonselection, tentative status, and lack of evidence for both. |

### Counterfactual local false holds

- Query 1, generation row 422: `По словам Ada Marlow, нереализованный вариант заключался в том, что приобретение ... покрыло бы ремонт ступицы колеса в пятом году. Ada Marlow его не приобрела, поэтому это не было её действующим покрытием.`
- Query 3, generation row 453: `По словам Ada Marlow, нереализованный вариант состоял в том, чтобы приобрести ...: в таком случае ремонт ступицы колеса был бы покрыт в пятом году. Ada Marlow не приобрела ... поэтому оно не являлось её действующим покрытием.`

Both drafts are faithful to the original and cited E1. Neither reaches the answer verifier. A deterministic replay against frozen `tmp/core-v75/dist/memory/counterfactual-wording.js` returns `false` from `hasNominalCounterfactual` for both, and neither contains a fallback discussion cue such as `контрфактическ` or `если бы`. `proseStatusSupported` therefore produces the reported local `discourse` rejection. This is a finite recognition false hold, not a semantic-verifier judgment.

The other six counterfactual answers reach verifier rows 411, 442, 473, 489, 509, and 525 and pass selection plus all three semantic dimensions.

### Exclusion bad draft held

Query 1, generation row 591 says `не устанавливает, покрывается ли ремонтом приводного вала`. This malformed instrumental construction makes drive-shaft repair the apparent coverer and leaves the covered subject absent. Frozen `coverageRolesSupported` returns `false`; the draft never reaches the answer verifier and the report records local `semantic_support` rejection. The guard correctly prevents publication of a materially bad draft.

The other seven exclusion drafts reach verifier rows 575, 620, 641, 662, 679, 700, and 717 and preserve the original coverage roles and record-scoped uncertainty.

### Assistant property error held

Query 1, generation row 771 translates connector continuity as `проверку целостности соединителя`, changing the tested property from continuity to generic integrity. Verifier row 776 marks `proposition_supported: false`, `action_arguments_preserved: false`, and `object_and_operation.relation: changed`, with an explicit continuity-versus-integrity mismatch. The report correctly records `verification_rejected`/`semantic_support`.

The private property alignment calls this `absent_from_both` even though the operation comparison correctly identifies the property change. That is a private classification weakness, but the mandatory overall verdict rejects the draft and no public error results. The other seven assistant answers preserve continuity and all qualifications.

### Fiction language and selection failures

- Queries 1 and 3, answer rows 951 and 982, have no parsed public value because the Russian drafts retain the ordinary component term `hinge-pin`. Language-check rows 950 and 981 classify that supplied hint as `foreign_ordinary` and return noncompliant. These are correct language-policy rejections. The trace's broad `other_provider_failure` class does not change the typed `language_mismatch` reason or make either a case-availability failure.
- Query 7, generation row 1049 says `По предложенному Ada Marlow вымышленному случаю` while citing only E2, the promise record. E2's readable excerpt identifies Ada's fictional case but does not select the separate proposal-to-discuss act. Verifier row 1054 sets selection false and both proposition/action booleans false. The proposition is true in the complete original source, but unsupported by that selected readable record. The rejection correctly enforces citation scope; the writable case could have succeeded by citing E1 too or omitting the proposal wording.

The five published fiction answers preserve Vulpine Mutual, fictional Bo, free hinge-pin replacements, eleven ownership days, and fictional-only scope. Focused E1-only promise answers need not repeat the independently retained proposal act.

### Undated excerpt-selection inconsistency

All four Russian generations use the new structured `translated_record` branch. Its three fields preserve proposition/nontemporal scope, source-clock anchor, and remaining clock qualifications within the existing call.

- Query 1, generation row 1108 and verifier row 1113: all three semantic booleans are true, but selection is false solely for `Следующий месяц не отсчитывается от времени обработки.`
- Query 5, generation row 1184 and verifier row 1189: all three semantic booleans are true, but selection is false solely for the equivalent `Этот месяц не отсчитывается от времени обработки.`

Those explicit exclusions are source-faithful but appear only in the immutable original frame, not the visible retained excerpt. The verifier therefore enforces the frozen no-frame-expansion rule. This is not an original-source error in either draft; it is a selected-record boundary failure and hence a case-level coverage loss.

Verifier rows 1151 and 1227 accept equivalent processing-clock exclusions with selection true. That is an inconsistent fallible selection judgment over materially equivalent record/frame relations. The accepted answers remain source-true, so the inconsistency creates false holds rather than an accepted error.

The four English copies and the two accepted Russian translations all preserve Ada's proposal, source-relative next month, unknown calendar month, and absence of plan or meeting.

## Trace lifecycle and availability

The finalized trace has 1,401 JSONL rows. Lifecycle start/completion events are balanced except for the terminal benchmark bookkeeping outside model wrappers; there is no model-call or transport throw. The two fiction language failures have completed answer and language transports with typed `language_mismatch`. Every case reports `availabilityFailure: false`, stable bytes, successful retention, and nonempty retrieval for all eight coordinates.

Private bounded narrative fields occasionally end with truncation artifacts or stray padding characters. I did not use those strings as evidence. Their associated immutable anchors, source bytes, generated draft bytes, typed schema fields, and public outputs determine the conclusions above.

## Bounded implications

The observed counterfactual losses support a generation-side presentation constraint before expanding local grammar: for a counterfactual retained record, render the false antecedent in an explicit conditional clause (`если бы ...`) and the actual nonpurchase/noncoverage in a separate explicit clause. The existing floor already recognizes that source-backed structure. If grammar support is considered, it should add only the two complete observed nominal constructions together with immediate nonpurchase and inactive-coverage closure and semantic-negative controls; the helper must remain an admission floor.

The undated loss is different. The structured renderer is faithfully reintroducing a frame-only explicit exclusion that the visible retained record omitted. The smallest coherent correction is to align the retained clock record and rendered obligations in the same retention transaction: either preserve the explicit excluded processing clock in current readable text, or do not require/render that frame-only clause when selected evidence lacks it. Automatically treating private frame text as selected authority would weaken the established citation boundary.

No evidence here supports weakening the coverage, language, property, citation-selection, or semantic-verification gates. The exclusion, assistant, and fiction holds show those gates preventing concrete bad drafts.
