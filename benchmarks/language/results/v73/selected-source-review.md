# V73 selected-packet source-only review

This review grades only `tmp/language-selected-output-packet-v73.json` against its original sources and queries under `tmp/v73-source-grading-contract.md`. It covers 8 cases and all 64 answer coordinates.

## Exact totals

### Case-level retention (8 cases)

- Useful complete retention: **7/8**
- Every retained record source-entailed: **8/8**
- Knowledge language compliant: **8/8**
- Qualifications preserved in retained material: **7/8**
- Unsafe factual promotion: **0/8**

The empty `v20-held-undated` retained set is vacuously free of unsupported retained propositions, hence `retainedSourceEntailed: true`, but it is neither useful nor qualification-preserving. There is no record carrying Ada's actual proposal, its source-relative next-month timing, the unknowable calendar month, or the no-plan/no-meeting limits.

### Answer-level results (64 coordinates)

- Semantically useful qualified answers: **51/64**
- Fully language-compliant useful qualified answers (`usefulQualifiedAnswer && languageCompliant === true`): **50/64**
- Useful qualified retrievals: **56/64**
- Justified abstentions: **0/64**
- Answer qualifications preserved: **51/64**
- Unsafe factual promotions: **0/64**
- Source-entailed non-null answers: **51/51**; **13** null coordinates have `sourceEntailed: null`
- Language-compliant non-null answers: **50/51**; **1/51** is noncompliant and **13** null coordinates have `languageCompliant: null`

## Evidence and distinctions

`v20-held-report` retains both the independent no-delivery statement and the requested nested report. All eight answers preserve Ada as outer reporter, Bo Winters as inner reporter, permission to send the device to the workshop for latch-gap measurement rather than latch replacement, and Ada's unread and independently unchecked status.

`v20-held-hypothesis` retains the three-month mesh-screen rule as Ada's hypothetical premise, including the conditional missed-check consequence, her lack of knowledge of actual requirements, and the denial of any actual missed check. Retrieval is useful in all eight coordinates. One Russian-answer coordinate is null, leaving **7/8** useful qualified answers.

`v20-held-counterfactual` completely retains Ada's refusal/nonpurchase and the unrealized fifth-year wheel-hub coverage. The six non-null answers preserve the false purchase antecedent and lack of active coverage. Two Russian-answer coordinates are null, leaving **6/8** useful qualified answers despite **8/8** useful retrievals.

`v20-held-exclusion` preserves the cracked-support-plate exclusion and the coupled scope limits: drive-shaft coverage remains unanswered, and the record does not assert silence across the whole contract. Seven answers reproduce those limits; one Russian-answer coordinate is null.

`v20-held-assistant` is complete across retention, retrieval, and answers. It preserves the assistant as speaker and the monthly connector-continuity test as a tentative, unread, unverified possible contract term rather than an established obligation.

`v20-held-fiction` completely retains Ada's proposal and the scoped fictional promise by Vulpine Mutual to fictional Bo Winters for free hinge-pin replacements during the first eleven days of ownership. One explicit Russian-answer coordinate is null. The implicit English answer is a valid focused subset: it completely preserves the selected fictional-promise proposition, while Ada's separate proposal-to-discuss act is already supplied by the wh-question and need not be repeated. One otherwise useful Russian answer leaves the common noun “hinge-pin” untranslated; its source entailment, semantic usefulness, and qualification preservation pass independently, while requested-language compliance fails.

`v20-held-undated` has no retained or retrieved records and all eight answers are null. The original source nevertheless answers both queries: Ada actually proposes a repair-terms review in the month after an undated original record, the calendar month cannot be determined, and she has accepted no plan and arranged no meeting. These downstream nulls are not justified abstentions. Their `qualificationPreserved: false` values mean no output exists to carry the qualifications; their source-entailment and language values are null under the contract.

`v20-held-alternatives` preserves Ada's consideration of a bent guide versus a loose belt fastening as competing preliminary hypotheses, the absence of evidence for each, and her nonselection. All eight answers are useful, qualified, entailed, and language compliant.

Across the packet, all 13 nulls occur where the original source contains an answer, so none is a justified source-only abstention. Retrieval grades match within each paired query/view coordinate. Null handling, usefulness, qualification preservation, source entailment, and requested-language compliance are graded independently.

## Limitations

This is a bounded source-only review of the supplied selected diagnostic packet. It does not inspect runtime behavior, traces, verifier decisions, verdicts, aggregate scores, plans, prior selected grades, other reviewers' work, or fresh held-out inputs, and it does not establish the complete release gate.

## Correction receipt

The initial JSON and initial selected Markdown are preserved unchanged. After independent reconsideration of `tmp/language-v73-fiction-adjudication.md`, the final JSON changes only the implicit EN→EN fiction answer's `usefulQualifiedAnswer` and `qualificationPreserved` values from `false` to `true`, plus its reason. The final semantic usefulness and answer-qualification totals are therefore **51/64**. Fully language-compliant useful coverage remains **50/64**, because the separate implicit EN→RU fiction answer remains semantically useful and qualified but `languageCompliant: false`. The accepted language violation remains **1/51** non-null answers.
