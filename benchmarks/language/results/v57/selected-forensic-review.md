# V57 selected forensic review

## Scope and accounting

I reviewed the finalized [`language-selected-v57.json`](selected-diagnostic.json), its [`trace`](../../../../bench-results/language-selected-v57-trace.jsonl), and the invented V20-development/V19-held source cases. I did not inspect an output-grading receipt or call a model.

The report contains six cases and 48 query rows. It produced 31 non-null answers. All 31 are source-entailing; 30 answer the selected question faithfully, while fiction q3 is an accepted selection/usefulness error because it returns only the proposed-discussion record and omits the requested fictional promise. The 17 nulls comprise eight `no_eligible_evidence`, seven `empty_draft`, and two `draft_rejected`. There were no generation, language-policy, provider, or case-level availability failures. All source bytes remained unchanged.

Retention generated eight candidates and wrote five. Four of six cases have complete retained sets: hypothesis, exclusion, assistant, and undated. Report retained nothing: its substantive report was held during structural validation and its repaired substitute was rejected by semantic verification, while the separate no-collection record was held at placement. Fiction retained its proposed-discussion record but lost the fictional promise at placement.

Within each case, q0..q7 are EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, and RU→RU explicit.

## Renderer and verifier behavior

Every eligible single-record answer that was produced used a schema-valid `copy` or `translate` branch captured by the new rendering-choice trace. Same-language rows copied the exact canonical retained record; cross-language rows translated the complete record. The trace shows subsequent language checks and full semantic/source-frame verification for accepted blocks. I found no wrong-mode language failure in this run, no accepted block that bypassed the verifier, no malformed anchor/selection payload, and no private-frame text exposed through copy rendering.

The selected report never reached answer generation because retention produced no writable evidence. Its outcome therefore provides no V57 renderer evidence.

## Case findings

### `v19-held-report`

The initial substantive report candidate was source-faithful. It preserved Ada Marlow as outer relayer, Bo Winters as inner source, permission to send the device to a service bench for measuring return-spring tension rather than replacement, and Ada's personal lack of reading and independent confirmation. Its readable text ended with: `Ada Marlow has not read the service terms or independently confirmed this report, and she clarifies that these are Bo Winters's words in her retelling rather than a condition she verified.`

That candidate was held as `discourse_uncertain` before semantic verification. The exact local cause is the closed-list `hasReportUncertainty` grammar, not the intervening word `independently`: the helper explicitly permits `independently confirmed`. It requires the coordinated negative list to end at sentence/clause termination or one of its closed continuations. The comma-plus same-speaker clarification (`..., and she clarifies that these are Bo Winters's words in her retelling rather than a condition she verified`) falls outside that lookahead, so a faithful qualification is treated as absent. Replaying the exact trace candidate through `cleanCandidateBatch` with the exact structured source items reproduces zero admitted candidates and a `discourse_uncertain` hold whose reason says the source's lack of confirmation was not preserved.

The single structural repair then returned the no-collection booking denial in the failed report position. That changed the proposition instead of repairing the report. The mandatory verifier correctly rejected the replacement against the original report obligation. Separately, the originally valid no-collection candidate reached semantic verification but placement returned `ownership_uncertain`, so it was also held. As a result, all eight query rows are `no_eligible_evidence`. They are mechanically correct for the empty retained set but are source-level coverage losses.

This case shows one false structural uncertainty hold, one correctly rejected proposition-changing repair, and one placement loss. It does not exercise the new answer reporting-role floor.

### `v19-held-hypothesis`

Retention is complete and faithful. All eight answers preserve Ada's hypothetical two-month foam-filter check rule, the coupled conditional missed-check consequence, unknown actual requirements, and the absence of a reported real missed inspection. Same-language output copies the complete retained proposition; translations preserve its actor, interval, conditional scope, and qualification. I found no accepted error or null.

### `v19-held-exclusion`

Retention is complete and faithful. Six accepted answers (q0, q1, q2, q4, q6, q7) preserve the damaged support bracket as the warranty-excluded object and keep the uncertainty scoped to what the exclusion record establishes about fan-motor repair, without claiming that the whole contract is silent.

Q3 and q5 are correctly rejected bad translations over adequate evidence:

- q3 says `не определяет, покрывается ли ремонтом двигателя вентилятора`, making fan-motor repair the covering instrument rather than the covered service;
- q5 says `не определяет, покрывается ли ремонтом двигателя вентилятора гарантия`, making warranty the object covered by the repair.

Both are stopped by the bounded coverage-role floor before semantic verification. The holds are justified for those drafts, while the rows remain answer-production losses because faithful writable evidence existed.

### `v19-held-assistant`

Retention is complete and faithful. All eight answers preserve the assistant as the source of a preliminary reading, a possible quarterly functional check of the status display, the assistant's personal lack of contract examination and confirmation, and possible-condition rather than established-requirement scope.

The four Russian translations use the new morphology-bound passive label `Сообщено ассистентом` and then retain the assistant as the actor of the interpretation and personal limits. They pass language review, the narrowed attribution floor, and mandatory semantic verification. Named-source recipient ambiguity is not introduced. I found no accepted error or null.

### `v19-held-fiction`

Extraction produced two source-faithful candidates: Ada's proposed discussion/no-real-agreement proposition and the fictional Vulpine Mutual promise to Bo Winters. Both passed semantic retention verification. The plan routed to the product page and wrote. The promise candidate, despite subject `Zephyr QX-100`, an exact proposed product page, and complete fictional roles, received `selection: uncertain` from ownership and was held. This is a placement loss; V57 did not change ownership policy.

Seven answer calls correctly returned zero blocks after reading the reduced evidence and explicitly observing that the retained plan did not state the fictional axle-cap promise. These `empty_draft` results are defensible for the evidence actually supplied, but remain source-level coverage losses caused by the missing retained promise.

Q3 is an accepted selection/usefulness error. Its answer is only: `Ada Marlow предлагает обсудить вымышленный пример о Zephyr QX-100 ... реального соглашения здесь нет.` This is source-entailing and preserves Ada's proposer role, but it does not answer which fictional axle-cap promise was proposed for discussion. The generation result itself lists the promise content under `missing_concepts`; emitting the plan block does not make that missing answer complete. The verifier checked source support for the cited plan and accepted it, demonstrating that source entailment alone does not establish query responsiveness.

### `v19-held-undated`

Retention is complete and faithful. The record preserves Ada as proposer, review of the Zephyr QX-100 warranty exclusions next year, `next year` measured from the undated source record rather than current processing time, an unrecoverable calendar year, Ada's non-adoption, no arranged meeting, and continued proposal status.

All eight answers are faithful complete-record renderings. The English rows copy the retained record. Russian translations consistently preserve Ada as proposer, attach the preliminary/tentative label to the proposal timing, state the source-record anchor and unknown calendar year, and keep both personal negative actions. I found no accepted actor, clock, commitment, or language error.

## Failure classification

- Complete retained sets: 4/6.
- Written retention candidates: 5/8.
- Non-null production: 31/48.
- Source-entailing non-null answers: 31/31.
- Fully responsive non-null answers: 30/31.
- Accepted selection/usefulness errors: 1, fiction q3.
- Accepted source, qualification, role, or language errors: none observed.
- Correctly rejected bad drafts: 2, exclusion q3 and q5.
- No eligible evidence: 8, all report rows, downstream of retention validation/repair/placement losses.
- Empty drafts: 7, fiction rows other than q3, downstream of the promise placement loss.
- Typed availability failures: 0.
- Source-byte changes: 0/6.

## Bounded next findings

1. **Treat a closed personal-uncertainty proposition plus its bounded same-speaker report clarification as one unit.** The report false hold is caused by terminal lookahead after an otherwise recognized `has not read ... or independently confirmed ...` list. A safe extension can consume the actual shape `, and she/he/they clarifies/clarify that these/this are/is NAME's words/report in her/his/their retelling rather than a condition/term/requirement she/he/they verified`, then require sentence or input termination. Keep positive confirmation, a different named subject, retraction, additional trailing clauses, and arbitrary `and` continuations negative. This remains a screening rule before mandatory semantics; pronoun identity and inner-speaker identity still require the full verifier.

2. **Do not let structural repair replace the failed proposition.** The repair transaction preserved its index mechanics, but this run shows a semantically unrelated sibling substituted into the failed report slot. Existing semantic verification correctly contained it. A bounded repair obligation should require the repaired candidate to retain the failed candidate's selected proposition identity before admission; the original candidate remains an obligation, never evidence.

3. **Make complete source-backed product identity usable by ownership without bypassing policy.** The fictional promise has an exact Zephyr subject and exact proposed/existing product page yet placement chose uncertain. Dynamic selection remains mandatory, but the prompt/schema can make the supplied identity relation explicit and require a concrete mismatch before `uncertain`. This is broader ownership calibration and should not be described as fixed by the V57 answer changes.

4. **Require a produced block to answer a selected question, not merely cite a supported neighboring record.** Fiction q3 selected a source-supported plan while its own reading admitted the requested promise was missing. In the existing generation schema/call, blocks should be disallowed when all requested content remains in `missing_concepts`; the verifier should treat absent requested proposition content as a selection failure. This needs no additional pass or retry.

The run does not support weakening the coverage floor, reporter floor, language check, or semantic verifier. It also provides no reason to change models, thresholds, or retry policy.
