# V67 selected-probe source-first forensic review

Runtime: `ac1059e4a3df85fbfef12749f65439a69434d56c`
Inputs: eight declared V21-development / `v20-held-*` cases, one run, eight coordinates each
Evidence reviewed: `bench-results/language-selected-v67.json`, `bench-results/language-selected-v67-trace.jsonl`, and `tmp/language-selected-output-packet-v67.json`. I did not inspect an independent grading receipt or any V21 held-out input.

## Result

The run produced 52 of 64 public answers and 12 nulls. All eight source cases retained their complete source proposition set: report 2/2, hypothesis 1/1, counterfactual 2/2, exclusion 1/1, assistant 1/1, fiction 2/2, undated 1/1, and alternatives 1/1. Retrieval supplied the focused qualified record(s) at every coordinate.

I find three clear accepted defects:

1. `v20-held-counterfactual`, q7 (RU query, RU answer, explicit view) says `приобретённое дополнительное продление ... покрыло бы ...` and then says Ada did not acquire it. The participle `приобретённое` asserts acquisition inside a source whose antecedent is expressly false. This is the same error correctly rejected at q5 (trace 94–95), but it survived q7.
2. `v20-held-fiction`, q4 (RU query, EN answer, inferred view) says only `According to Ada Marlow, in the fictional ... case ...` and cites `[memory/equipment:7]`. It omits Ada's actual act of proposing discussion and states the promise content while citing only the proposal record, whose retained excerpt does not contain that promise.
3. `v20-held-fiction`, q6 (RU query, EN answer, explicit view) similarly gives `In Ada Marlow's proposed fictional case ...` and cites only `[memory/equipment:7]`. Possessive/adjectival framing does not preserve the source proposition that Ada proposed **discussing** the case, and the selected citation does not itself supply the promise terms. This is both an action/qualification loss and a per-record selection failure.

The other 49 published answers are source-faithful in material content, qualification, roles, and requested language. Internal positive verdicts were not used as truth authority.

## Retention and routing

- **Report, trace 1–7.** Initial candidate 0 preserves Ada's independent no-delivery denial. Candidate 1 initially fails the local report-uncertainty floor, is repaired in its own original position, and then survives full verification. The admitted sibling is not mutated. The final report record correctly keeps Ada as outer relay, Bo as inner source, permission to send the device to a workshop, measurement of the latch gap rather than replacement/change of the latch, and Ada's separate lack of reading/checking/verification. Both route to the existing Zephyr page. This is complete 2/2 retention.
- **Hypothesis, trace 40–42.** One complete hypothetical record survives with Ada's introducing/analysis role, three-month mesh-screen assumption, coupled missed-check consequence, personal ignorance of actual requirements, and explicit no-real-missed-check scope.
- **Counterfactual, trace 76–78.** Both actual refusal/nonpurchase and the counterfactual fifth-year wheel-hub coverage proposition survive and route. The answer path can retrieve and cite both.
- **Exclusion, trace 104–106.** The single retained record contains all three source clauses: cracked-support-plate exclusion, record-level nonresolution of drive-shaft-repair coverage, and denial that the whole contract is silent.
- **Assistant, trace 143–145.** The record preserves assistant attribution, tentative monthly connector-continuity possibility, both personal epistemic limits, and possible-contract-term versus established-obligation distinction.
- **Fiction, trace 175–177.** Both Ada's actual proposal/no-real-contract proposition and the scoped fictional promise survive separately. The later q4/q6 defect is answer selection/composition, not extraction loss.
- **Undated, trace 201–203.** One complete proposal retains Ada as proposer, repair-terms review, next month relative to the undated original record rather than processing, unknown calendar month, no accepted plan, and no arranged meeting.
- **Alternatives, trace 235–236.** The record preserves Ada's consideration, both named alternatives, their preliminary/evidence-free status, and Ada's personal nonselection.

## Published-answer audit by case

### Report: 8/8 produced, all faithful

Trace 8–39 uses the complete-record renderer. English copies are byte-stable apart from citation presentation; Russian translations use the supplied `По словам Ada Marlow` heading and preserve protected names. `measure the gap at the latch` is consistently rendered as measuring `зазор у защёлки`; no temperature, generic-property, or replacement specialization appears. Having not read the agreement, independently checked the account, and personally verified/confirmed the conveyed meaning remain distinct. The separate no-delivery record is correctly omitted from this focused report answer while remaining retained.

### Hypothesis: 6/8 produced, all six faithful

q0/q2/q3/q4/q5/q6 preserve the hypothetical premise, every-three-month property, coupled conditional consequence, Ada's personal lack of actual-requirement knowledge, and absence of a real missed check. q1 and q7 drafts (trace 50 and 73) transliterate protected `Ada Marlow` as `Ада Марлоу`; the attribution guard holds them before verification. Those are justified bad-draft holds, not source-level abstentions.

### Counterfactual: 6/8 produced, five faithful and one accepted defect

q0/q1/q2/q4/q6 preserve the false purchase antecedent and unrealized/no-actual-coverage scope. q3 is held by attribution after rendering `Ada Marlow` as `Ада Марлоу` (trace 89), a justified protected-name hold. q5 says `приобретённое дополнительное продление` despite the source's explicit nonpurchase; the verifier correctly rejects all three semantic dimensions and excerpt selection (trace 94–95). q7 repeats the material acquired-extension contradiction but is published, as described above.

### Exclusion: 7/8 produced, all seven faithful

The published forms keep warranty as coverer and cracked support plate as excluded object, and phrase drive-shaft repair as the unresolved coverage question. They do not make repair cover the shaft/warranty and do not generalize record nonresolution to contract silence. q5 is stopped by a deterministic semantic-support/coverage-role guard before verifier; its withheld draft is not a justified case abstention because adequate retained evidence exists. The hold is safe, and the public outputs demonstrate that the intended active/nominal coverage grammar is available in the same run.

### Assistant: 7/8 produced, all seven faithful

Monthly `connector continuity` remains the tested property: `проверка непрерывности соединения разъёма`, `тест непрерывности разъёма`, and `проверка непрерывности цепи разъёма` are natural target-language renderings rather than generic integrity. Assistant attribution, tentative `might include`, lack of reading, lack of verifying the interpretation, and possible contractual term remain explicit. q3 reaches verification and is semantically rejected; this is a safe bad-draft hold over otherwise writable evidence, not an availability failure.

### Fiction: 5/8 produced, three faithful and two defective

q0/q2/q5 faithfully preserve Ada's proposal to discuss, Vulpine Mutual as fictional promisor, fictional Bo as recipient, free hinge-pin replacements, first eleven days, fictional-only scope, and no real agreement. q1 and q7 are held by attribution because their selected block does not preserve the required named outer proposal source. q3 generates ordinary English `hinge-pin` inside Russian prose; language check returns `compliant:false` at trace 186 and the answer call closes with `language_mismatch` at 187. That is a justified language hold. q4 and q6 are the accepted proposal/citation defects listed above.

### Undated: 6/8 produced, all six faithful

q0/q1/q2/q3/q4/q6 retain Ada as actual proposer, the repair-terms object, source-relative `next month`, the distinction from processing time, unknown calendar month, no plan acceptance, and no meeting arrangement. The Russian wording `это означает месяц после недатированной исходной записи` adds no causal relation. q5 instead adds `поэтому`, making calendar unknowability follow from nonacceptance/no meeting. The verifier correctly rejects it with explicit unsupported-content and changed-qualification mismatches at trace 225–226. q7's draft at trace 233 is materially faithful (`месяце после недатированной первоначальной записи ... не после обработки`), but a deterministic discourse guard holds it before verification. That is a false hold/coverage loss in the local source-clock/discourse floor, not a semantic error or transport failure.

### Alternatives: 7/8 produced, all seven faithful

The produced answers preserve both competing hypotheses, preliminary status, no supporting evidence, and Ada as the person who considered and selected neither cause. Singular case agreement is occasionally awkward but remains Russian and does not alter meaning. q3 transliterates the protected name to `Ада Марлоу` and is held by attribution before verifier, a justified bad-draft hold.

## Null and availability inventory

- **Attribution/name guard (6):** hypothesis q1/q7, counterfactual q3, fiction q1/q7, and alternatives q3. The hypothesis/counterfactual/alternatives cases change the protected name; the fiction cases also fail to bind the actual discussion proposer.
- **Deterministic semantic/discourse guards (2):** exclusion q5 (coverage role) and undated q7 (faithful source-clock paraphrase; false hold).
- **Independent semantic-verifier negatives (3):** counterfactual q5 (correct acquired-extension rejection), assistant q3 (safe semantic rejection), undated q5 (correct unsupported causal relation rejection).
- **Language failure (1):** fiction q3, explicit unprotected English `hinge-pin` in Russian prose, trace 186–187.

There are no operation-level transport failures, malformed-schema/unavailable outcomes, retries, or hidden second answer attempts. `generation_failed` in the report for fiction q3 is the operation-level presentation of the recorded language-check failure, not provider unavailability.

## Bounded implications

The V67 report, clock, and technical-property changes are exercised successfully: the repaired report survives, six published undated answers preserve the new English/Russian source-entry meaning, and the assistant translations retain continuity rather than generic soundness. Nonrecurrence alone would not prove causality, but the trace shows the intended branches and complete source distinctions in actual accepted paths.

The evidence does not support broadening semantic gates. The smallest next work is:

1. Apply the existing counterfactual nonpurchase/purchase comparison consistently to participial target-language forms such as `приобретённое ...` before publication; keep the full semantic verifier authoritative.
2. Require a focused fictional-promise block to select/cite the retained record that contains the promise, and preserve the separate actual `SOURCE proposed discussing` action whenever the query asks for that proposal. Do not let `According to SOURCE` or `SOURCE's proposed case` stand in for that action.
3. Diagnose the exact deterministic predicate that rejects undated q7's faithful `месяце после недатированной первоначальной записи` wording and extend only the same-clause source-entry grammar if needed. The accepted canonical wording already provides a safe generation target.

Because three material accepted defects remain, this forensic evidence does not support starting a full fresh held-out trial under the plan's zero-accepted-error gate.
