# V59 selected-probe source-first forensic review

## Scope and method

I reviewed only the finalized [selected report](selected-diagnostic.json), its [trace](../../../../bench-results/language-selected-v59-trace.jsonl), and the invented V19-held sources in `tmp/language-v20-blind-inputs.json`. I did not inspect an output-grading receipt, call a provider, rerun a row, or change runtime. Original source text controls the semantic findings below; model and guard verdicts are execution evidence rather than ground truth.

The frozen run completed all six cases without a typed availability failure, answer-operation failure, language-policy rejection, or source-byte change. It published **42/48** answers: report 8, hypothesis 8, exclusion 8, assistant 8, fiction 6, undated 4. This is production coverage, not an independent usefulness score.

## Retention

Four of six original-source sets are complete: exclusion, assistant, fiction, and undated.

- **Report is incomplete after placement.** Extraction and semantic verification preserve two distinct propositions: (a) Ada Marlow states no collection of her device has been booked; and (b) Bo Winters's reported permission to send Zephyr QX-100 to a service bench for return-spring tension measurement, not spring replacement, with Ada's unread/unconfirmed limits. Both are source-faithful and separately verified at [trace lines 1–3](../../../../bench-results/language-selected-v59-trace.jsonl#L1). Ownership returns `uncertain` for the collection denial and it is held at placement, while the main report is written at [trace lines 4–5](../../../../bench-results/language-selected-v59-trace.jsonl#L4). This is a retained-set/routing loss, although the focused report query does not ask for collection status.
- **Hypothesis is incomplete after validation.** The initial extraction correctly emits original indices 0–2: the coupled hypothetical inspection rule/consequence, the group-relative statement that actual requirements are unknown to us and the rule is only a hypothesis, and Ada's statement that she does not report an actual missed inspection. Validation holds indices 1 and 2. The one repair request correctly targets **original indices 1 and 2**, supplies their corresponding original drafts and issue groups, and keeps index 0 as read-only admitted context; it does not confuse repair-array offsets with source positions ([trace lines 38–41](../../../../bench-results/language-selected-v59-trace.jsonl#L38)). Both repairs remain held by structural validation, so only index 0 reaches and passes semantic verification ([trace line 42](../../../../bench-results/language-selected-v59-trace.jsonl#L42)). The V59 index-binding change therefore worked in this sample, but did not make either repaired record survive. The focused hypothetical-rule answers can still be complete without the two neighboring negative/unknown propositions.
- **Exclusion** retains the support-bracket noncoverage and keeps the fan-motor question scoped to what this exclusion record does not determine; it explicitly avoids claiming that the contract is silent. This is faithful ([trace lines 77–78](../../../../bench-results/language-selected-v59-trace.jsonl#L77)).
- **Assistant** retains the tentative quarterly status-display-check reading, assistant attribution, lack of contract examination/confirmation, and possible-condition rather than established-requirement status ([trace lines 113–114](../../../../bench-results/language-selected-v59-trace.jsonl#L113)).
- **Fiction** retains separate proposed-discussion and fictional-promise records. The promise keeps Vulpine Mutual as promisor, Bo Winters as recipient/character, free axle-cap replacements, the first ten weeks of ownership, and fiction-only scope ([trace lines 149–150](../../../../bench-results/language-selected-v59-trace.jsonl#L149)).
- **Undated** retains Ada as proposer, review of Zephyr QX-100 warranty exclusions next year, her personal non-adoption/non-arrangement, proposal-only status, record-relative clock, and unrecoverable calendar year ([trace lines 178–179](../../../../bench-results/language-selected-v59-trace.jsonl#L178)).

## Published answers

I found no clear source-entailment, qualification, actor, language, or selection error in the 42 published answers.

- All eight **report** answers preserve outer Ada, inner Bo, permission rather than booking/performance, return-spring tension measurement rather than replacement, and Ada's personal verification limits. Omitting the separate collection denial is appropriate for this focused question.
- All eight **hypothesis** answers preserve the two-month hypothetical rule and its coupled conditional consequence. They do not present the rule as an actual requirement or claim that a real inspection was missed. Their omission of the source's separate group-relative actual-requirements statement is focused-answer incompleteness only if the question is read to request that neighboring proposition; the question asks which hypothetical rule Ada introduced, so I treat the answers as complete for the query.
- All eight **exclusion** answers preserve both the bracket denial and the narrow epistemic subject: the exclusion record does not settle fan-motor coverage and does not imply whole-contract silence.
- All eight **assistant** answers preserve the assistant as epistemic subject, tentative possibility, quarterly functional status-display check, both personal limits, and non-established status.
- The six published **fiction** answers preserve promisor, recipient, component, free replacement, ownership interval, and fiction-only scope. Some focused answers describe this as Ada's fictional example without separately repeating that she proposed discussing it; because the question itself supplies that frame and asks for the promise, this does not change the selected promise. The two answers that cite both retained records also preserve Ada's proposal and absence of a real agreement.
- The four English **undated** answers preserve Ada's actual proposal act, proposal-only/nonactionable status, personal non-adoption and non-arrangement, record-relative `next year`, and unrecoverable calendar year.

## Nulls and exact stages

There are six writable nulls. None is an availability failure.

1. **Fiction q1 and q3 (English query, Russian answer)** reach semantic verification and are rejected for retained-excerpt selection. Each draft cites only the fictional-promise record but adds that Ada proposed discussing the example and that no real agreement exists. Those clauses are supported by the private original frame and the sibling proposal record, but they are not selected by the cited retained excerpt. The verifier returns all three semantic booleans true and `selected_by_retained_excerpt:false` ([trace lines 157–158](../../../../bench-results/language-selected-v59-trace.jsonl#L157), [163–164](../../../../bench-results/language-selected-v59-trace.jsonl#L163)). These are correct rejections of malformed citation selection, but source-faithful answers were available; the resulting case abstentions are coverage losses.
2. **Undated q1, q3, q5, and q7 (all Russian-answer rows)** are rejected by deterministic discourse validation before semantic verification. Their generated answer text is source-faithful: each names Ada as proposer, retains the review object, personal no-plan/no-meeting status, record-relative next year, and unknown calendar year ([trace lines 187, 194, 201, 208](../../../../bench-results/language-selected-v59-trace.jsonl#L187)). The report exposes only `rejection_counts.discourse=1`, so it does not identify which subguard failed; claiming a narrower cause from this trace would be unsupported. These are conservative false holds of adequate drafts and therefore four answer-coverage losses.

The undated drafts use existing recognized forms such as `отсчитывается от времени записи` and `календарный год восстановить нельзя`. The newly added V59 `дата/календарный … установить нельзя` branch is therefore **not exercised by this live output**, and this run cannot establish its causal effectiveness.

## Bounded findings

The evidence supports two follow-ups without weakening semantic verification or adding retries:

1. Expose the specific deterministic answer-guard reason in trace/receipt data, or unit-reproduce each subguard over the exact four Russian drafts before changing grammar. All four faithful drafts currently collapse into the coarse `discourse` bucket, which is insufficient for a principled fix.
2. For ordinary composition with multiple retrieved records, require each added clause to cite the retained record that selected it. The existing verifier correctly catches the fiction selection leak; generation should either omit Ada's proposal/no-agreement clauses from an E1-only promise answer or cite the sibling proposal record.

The report routing loss and the two hypothesis validation losses remain upstream completeness issues. V59's repair-coordinate redesign prevents the previously observed target/draft mismatch, but this single run does not show repaired records surviving or prove the new clock syntax beyond its deterministic tests.
