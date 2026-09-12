# V77 top-level convergence and architecture review

Scope: independent review of the exposed V65–V76 evidence and the current answer/retention implementation. I did not inspect V77 outputs or V22 held-out source content, call a provider, or modify runtime, benchmark, issue, or PR state. V77 counts as iteration 1 of the newly authorized maximum of ten; the maximum should be treated as a stop ceiling, not a budget to consume.

## Main conclusion

PR #70 has largely converged on **conservative source safety**, but it has not converged on the existing **90% answer-usefulness target**. The remaining misses are dominated by withheld writable answers, not published inventions. Further phrase-by-phrase local grammar expansion is unlikely to produce stable convergence within ten revisions. It has repeatedly moved false holds between scenarios as Luna chooses a new faithful surface form.

I recommend preserving the original 90% reliability gate as a reported benchmark while declaring a distinct PR-completion target:

1. Keep every zero-error gate unchanged: zero accepted unsupported retained propositions, unsupported nonnull answers, qualification errors, requested-language errors, unsafe promotions, and source-byte changes.
2. Keep the original 90% independently useful qualified answer gate and report whether it passes. Separately declare **80% per split and run** as the minimum useful-answer target for completing this conservative, experimental PR; keep useful retention and useful retrieval at 80%.
3. Finish the already frozen V77 diagnostic without retroactive interpretation. Make at most one further runtime revision before the full V22 trial, and only for a systematic safety defect or a deterministic case-level false hold supported by source-owned structure.
4. Run the independently approved V22 full trial once with both targets predeclared. Do not relabel a miss of the original 90% gate as a pass. If the 80% completion target and every safety gate pass, finish PR #70 with an explicitly scoped experimental claim. If the completion target fails, spend further iterations only on a systemic, source-owned cause; never weaken source safety or tune and rerun the same exposed held-out split.

## What has converged

### Source safety

The architecture now has meaningful, layered safety controls:

- immutable original frames, exact evidence IDs and source/candidate anchor tables;
- typed discourse, polarity, source role, actor, property and time metadata;
- local rejection floors for high-risk language constructions;
- one source-bound structural repair with original-position and immutable-sibling checks;
- requested-language checking over public prose;
- a mandatory original-source semantic verifier for model-generated candidates and answers; and
- independent source-only grading that does not treat runtime booleans or private model readings as truth.

This has materially changed the failure profile. V65's full trial published eight coverage-role errors. Later exposed probes usually publish only source-faithful answers. V67 reported zero accepted source/qualification/language/promotion errors; V70 published 86/96 faithful answers but retained one polarity metadata error; V75 published 87/96 answers with no accepted error; and V76 found all 81 published answers source-faithful, qualified and language-compliant, with one merely nonresponsive answer. The notable intervening failures—continuity generalized to integrity in V68/V69/V71 and an untranslated term in V73—were visible and counted rather than hidden by a high aggregate score.

The zero-error gate remains necessary because the runtime verifier is fallible. V65's coverage inversion, the accepted continuity-to-integrity generalizations, incorrect private property-absence classifications, and V70's polarity mismatch all demonstrate that a valid structured verdict is not semantic proof. Runtime checks lower risk; independent original-source review remains the release authority for this benchmark.

### Typed availability and provenance

Recent revisions also distinguish source absence, valid rejection, malformed private verdicts and case availability more accurately. Provider-schema incompatibilities and UTF-16/code-point boundary failures were preserved and corrected without relabeling them semantic holds. Frozen source/dist hashes, exact revisions, trace lifecycle accounting, deployment receipts and independently reviewed protocol controls are now strong. These establish what ran and whether schemas transported; they do not establish answer quality, and the evidence generally says so.

## What has not converged

### Usefulness is volatile rather than monotonically improving

The exposed combined useful-answer results vary substantially:

| Revision | Useful answers | Material published issue or other safety defect |
| --- | ---: | --- |
| V66 | 59/96 | two mechanism generalizations |
| V67 | 75/96 | none adopted |
| V68 | 71/96 | mechanism generalization; citation-support issue under forensic reading |
| V69 | 68/96 | mechanism generalization |
| V70 | 86/96 | retained polarity metadata error |
| V71 | 81/96 | one incomplete mechanism translation |
| V72 | 67/96 | none published; major retention losses |
| V73 | 74/96 language-compliant | one requested-language error |
| V75 | 87/96 | none |
| V76 | 80/96 | none published; one nonresponsive answer and one availability case |

These matrices differ stochastically even where the exposed cases are stable, so the table is diagnostic history, not a causal leaderboard. The last complete two-split/two-run trial, V65, produced 243/320 useful answers (75.94%), with per-split/run results from 54/80 to 71/80 and eight accepted errors. No later exposed result replaces that failed full trial.

Useful coverage losses recur through several paths:

1. **Retention multiplication.** Losing one central retained record often removes retrieval and all eight answer-language/view cells for a case. V68's report and undated losses, V69's report losses, V72's five incomplete sets, V73's built report loss and V76's fictional promise loss show this cliff.
2. **Faithful local false holds.** Closed regex grammars have rejected natural report uncertainty, counterfactual, source-clock and attribution forms that preserve the source. Later additions recognize the observed phrase, but another valid realization appears.
3. **Correct bad-draft holds.** Coverage-role reversals, name changes, untranslated ordinary terms, unsupported proposal acts and material mechanism generalizations should remain withheld. They are still usefulness losses because a faithful answer was writable, but removing the guard would trade recall for unsafe publication.
4. **Fallible semantic/schema decisions.** The semantic verifier sometimes invents a mismatch in its private comparison, assigns the wrong governing proposition, or emits an internally invalid null/anchor combination. Retrying could raise coverage, but the declared architecture intentionally has no semantic retry.
5. **Model-dependent generation.** Prompt clarifications often work in one run and fail in the next. Protocol echoes prove only that the schema can be produced, not that Luna will preserve a particular action, property or qualification across ordinary generations.

### The local-language layer has reached diminishing returns

The core paths are now large: `packages/core/src/write/retain.ts` is roughly 2,400 lines, `packages/core/src/ops/answer.ts` roughly 2,100, and their language-focused test suites and helpers add several thousand more. The local checks recognize bounded surface grammars for attribution, counterfactuals, coverage roles, personal negatives, report uncertainty, source clocks, booking aliases, fictional identity and related cases.

That investment is justified where a short grammar blocks a demonstrated unsafe admission. It is not a general natural-language parser. A local `true` only defers to semantic verification, while a local `false` irreversibly removes a potentially faithful candidate. Adding another nominal form or lexical continuation therefore tends to improve one frozen example while growing a new false-positive/false-negative boundary. V65–V76 provide repeated empirical examples of that tradeoff.

## Why 80% is the defensible bounded PR-completion target

The current gate already allows 20% incompleteness in useful retention and retrieval. With ten writable cases, 80% retention permits two incomplete cases. Each case has eight answer cells. A single missing record can remove eight of 80 answer cells; under a 90% answer gate that consumes the entire allowance, so any additional faithful-draft hold makes the run fail. Two incomplete cases can satisfy retention while necessarily failing answer usefulness. The three gates encode inconsistent tolerance for the same upstream event.

An 80% completion target aligns the three coverage measures:

- at least 8/10 complete useful retained sets;
- at least 32/40 useful query/view retrievals; and
- at least 64/80 independently useful qualified answers in each full split/run.

For the 64-cell selected diagnostic this means at least 52 useful answers; for the 32-cell built diagnostic, at least 26. Pooled totals must not rescue a failing probe or full split/run.

This adjustment is a product policy choice, not a statistical reliability claim or a retroactive pass of the original 90% gate. The cells are strongly correlated, the corpus is synthetic, and a score of 80% means the assistant may conservatively abstain on as many as one in five benchmark answer cells. Documentation should state that limitation plainly. The benefit is a coherent minimum for finishing a safety-biased experimental PR without permitting a source, qualification or language error. Keeping the 90% result visible preserves historical comparability and avoids presenting a changed target as the original release contract.

I would not reduce below 80%. V65 shows that 75% pooled coverage can coexist with wide per-run instability and accepted errors. A lower threshold would also fall below the existing retention/retrieval contract rather than align with it.

## When another local correction is justified

After V77, another runtime change should require all of the following:

- the failure is localized from immutable source/candidate bytes, not inferred from a private explanation or adjacent trace row;
- it affects a whole retained proposition or a repeated family of answer cells, rather than one stylistic rendering;
- the correction uses source-owned structure, an exact witness, typed dependency, or deterministic boundary;
- it neither treats metadata/private readings as source authority nor mechanically inserts semantic prose;
- negative quotation, negation, retraction, sibling, actor and ownership controls are possible;
- every admitted form still reaches the existing full-source semantic verifier, including explicit negative-verdict integration tests; and
- the change does not add a model pass, retry, model switch, larger cap, broader citation authority or weaker semantic/language gate.

V77's bounded identity and counterfactual work fits this standard because the observed losses were case-level and the new witnesses are source-owned. An additional synonym, word-order alternative, role label or prompt reminder does not.

If V77 exposes a new accepted error, correct that safety defect before any full trial. If it exposes only scattered faithful false holds, accept them as the cost of conservative recall unless one structural cause dominates at least a case-sized block. In particular, do not broaden existing finite grammars merely because the semantic verifier is mandatory: the verifier has already produced false positive approvals and false negative rejections.

## Bounded finish plan

1. **Iteration 1 — V77:** complete the already frozen diagnostics and independent source-first grading. Record results under the original diagnostic plan. Before any full V22 run, declare both the unchanged 90% benchmark gate and the separate 80% PR-completion target.
2. **Optional iteration 2:** allow one coherent correction only if V77 identifies a zero-error blocker or one deterministic structural cause responsible for a material block of coverage. Skip this revision if V77 has no accepted safety error and is adequate to proceed to measurement; exposed usefulness need not reach 90% to authorize the full measurement.
3. **First full V22 trial:** freeze the chosen runtime and run the independently approved V22 development and held-out splits twice, once each as declared. Report the original 90% answer gate, the 80% completion target, 80% retention/retrieval, unchanged zero-error gates and availability gate side by side. The V22 held-out results then become exposed and must not be used to tune and rerun that same gate.
4. **Bounded failure response:** if the 80% completion target or a safety gate fails, preserve the result. Continue only for a systemic cause expressible through source-owned structure and only with a newly independently authored held-out corpus for another full measurement. I recommend at most two such revision/fresh-corpus cycles, even though the absolute authorization ceiling is ten. Stop earlier when the remaining losses are scattered surface forms.
5. **Finish PR #70:** a miss of 90% remains a failed original reliability gate. If the separately declared 80% target and all safety gates pass, the PR may still finish as a scoped experimental safety improvement with that limitation prominent. If the bounded systemic work still misses the completion target, finish with an honest failed/experimental disposition rather than continuing local grammar work.

This decision improves convergence because it separates three questions that the prior loop conflated: whether a revision is source-safe, whether it reaches the original ambitious reliability target, and whether the PR is useful enough to finish as an experimental safety improvement. It keeps the 90% historical result honest while giving the work a coherent stopping floor. The likely path uses two runtime iterations plus one full evaluation; additional iterations require a systemic cause and fresh evaluation authority, not merely unused budget.

## Architectural work to defer from PR #70

A broader successor should reduce dependence on free-form local-language recognition rather than add to it. The most promising direction is a source-bound proposition representation that separates actor, governing predicate, polarity, object/property, epistemic scope and time relation before rendering, with exact source witnesses for each selected field. For simple single-record recall, deterministic/extractive rendering or complete-record translation already has a clearer authority chain than free composition. Mixed-record synthesis would still need semantic verification and independent evaluation.

That is a redesign: it changes the boundary between extraction, storage, selection and rendering and needs a fresh threat model and corpus. It should not be attempted inside the remaining PR #70 iteration cap.

## Release wording limits

Even a V22 result meeting the PR-completion target would support only a bounded claim: on this frozen invented English/Russian corpus, at the declared 2,400-token evaluation ceiling, the system met conservative source-safety gates and at least 80% useful coverage in each split/run. The publication must separately state whether the original 90% gate passed. It would not establish general multilingual reliability, human-level semantic verification, or behavior under the local service's separately configured 1,024-token overlay. Those limits should accompany the result rather than be inferred from artifact detail.
