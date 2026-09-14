# V58 selected forensic review

## Scope and accounting

I reviewed only the finalized [`language-selected-v58.json`](selected-diagnostic.json), its [`trace`](../../../../bench-results/language-selected-v58-trace.jsonl), and [`language-selected-output-packet-v58.json`](language-selected-output-packet-v58.json), using the invented original sources as authority. I did not inspect an independent grading receipt or call a model.

The report contains six cases and 48 query rows. It produced 36 non-null answers. All 36 are source-entailing, but seven exclusion answers omit the requested fan-motor-repair uncertainty because that source proposition did not survive retention. Thus 29/36 non-null answers are fully responsive on my source-first review. The 12 nulls comprise eight `no_eligible_evidence`, one `empty_draft`, and three `draft_rejected`. There were no typed provider, case-level availability, language-policy, or source-byte failures.

Retention generated eight candidates and wrote six. Four cases have complete retained sets: report, assistant, fiction, and undated. Hypothesis retained nothing after a semantic rejection. Exclusion retained the bracket exclusion but lost its independent record-scope limitation about fan-motor repair.

Within each case, q0..q7 are EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, and RU→RU explicit.

## Case findings

### `v19-held-report`

Retention is complete and faithful. The main record preserves Bo Winters as the embedded source, Ada Marlow as recipient/outer reporter, permission to send the device to a service bench to measure return-spring tension rather than replace the spring, and Ada's lack of reading and independent confirmation. The exact V57 false-hold shape was avoided here: the candidate ends the recognized negative list at the sentence boundary. The separate no-collection-booking denial also passes the alias/identifier checks and routes to a source-backed proposed page.

All eight answers are source-faithful and preserve the nested roles, action/object contrast, and personal uncertainty. The new reporting-role floor does not block the canonical `According to/По словам Ada Marlow, Bo Winters ...` construction, and every answer reaches full semantic verification. No answer improperly includes the unrelated booking denial.

### `v19-held-hypothesis`

The generated candidate preserves the hypothetical two-month foam-filter rule, the conditional missed-check consequence, and Ada's statement that she reports no actual missed inspection. It changes `Настоящие требования нам неизвестны` (“the actual requirements are unknown to us”) to unqualified `the actual requirements are unknown`. The verifier identifies that epistemic-subject broadening and rejects proposition and qualification scope.

This is a justified rejection of the generated candidate, not a false verifier hold. The original source nevertheless contains a complete answer, so all eight downstream `no_eligible_evidence` rows are production coverage losses caused by generation dropping `to us` before retention. No answer model runs.

### `v19-held-exclusion`

Extraction correctly separates two propositions. The first, Ada's asserted damaged-support-bracket warranty exclusion, writes and is faithful. The second readable candidate is also source-faithful in prose: the exclusion record does not determine whether fan-motor repair is covered and does not assert that the whole contract is silent. Its asserted/affirmed claim typing is incompatible with the unresolved proposition, so structural cleaning requests repair. The repair replaces it with a duplicate bracket-exclusion proposition. Mandatory repair-obligation verification correctly rejects that changed proposition.

Seven non-null answers cite only the surviving bracket record and state only that the damaged bracket is not covered. Those sentences are source-entailing, but the question asks both what the exclusion says about the bracket and what it establishes about fan-motor repair. They omit the latter half and are accepted selection/completeness errors. Q2 instead returns zero blocks, a defensible decision for the reduced evidence but still a source-level answer coverage loss.

The new coverage-role floor is not exercised by an accepted inversion in this case; the missing proposition never reaches answering.

### `v19-held-assistant`

Retention is complete and faithful. All eight answers preserve the assistant's preliminary possible quarterly status-display check, personal non-examination/nonconfirmation, and possible-condition rather than established-requirement scope. The Russian translations use the bounded `Сообщено ассистентом` label and keep the assistant as the actor of the interpretation and personal limits. All pass language review, deterministic attribution, and semantic verification. I found no accepted error or null.

### `v19-held-fiction`

Retention is complete. The plan record preserves Ada as proposer and no-real-agreement scope. The fictional claim preserves Vulpine Mutual as promisor, fictional Bo Winters as recipient, free axle-cap replacements, and the first-ten-weeks limit; its deciding frame now contains the source-backed Zephyr antecedent. Both records pass semantics and route to the existing product page.

Six accepted answers (q0, q2, q4, q5, q6, q7) are source-faithful and answer the fictional-promise query. Q1 and q3 are correctly rejected bad drafts: they cite only the fictional promise record and omit Ada Marlow entirely, although the question asks what Ada proposed discussing. The attribution/agency floor contains those drafts before semantic verification. These are justified draft holds over adequate evidence, so they remain production losses rather than source-level reasons to abstain.

### `v19-held-undated`

Retention is complete and faithful. It preserves Ada as proposer, review of Zephyr QX-100 warranty exclusions, next year relative to the original undated record rather than current processing time, unrecoverable calendar year, non-adoption, no meeting, and continued proposal status.

Seven accepted answers (q0–q4, q6, q7) preserve these details and the named actor. Q5 is a pre-verifier `discourse` hold. Its draft is substantively faithful, including `в следующем году относительно исходной записи`, an unrecoverable calendar year, Ada's non-adoption/non-arrangement, and continued proposal status. It also leaves the literal English token `“next year”` inside otherwise Russian prose when denying the current-time interpretation. Language review returned compliant, but a deterministic discourse guard rejected it. The trace does not identify which of the bundled `proseStatusSupported`/`noncanonicalMemoryStatusSupported` checks failed, so attributing it more narrowly would be speculative. It is a conservative false hold over adequate evidence.

## Failure classification

- Complete retained sets: 4/6.
- Written candidates: 6/8.
- Non-null production: 36/48.
- Source-entailing non-null answers: 36/36.
- Fully responsive non-null answers: 29/36.
- Accepted selection/completeness errors: 7, exclusion q0/q1/q3/q4/q5/q6/q7.
- Accepted source-entailment, qualification, role, or language errors: none observed.
- Justified semantic retention rejection: hypothesis candidate with broadened epistemic subject.
- Correctly rejected bad answer drafts: fiction q1 and q3.
- Conservative false answer hold: undated q5.
- Downstream no evidence: eight hypothesis rows.
- Empty draft over incomplete retained evidence: exclusion q2.
- Availability failures: 0.
- Source-byte changes: 0/6.

## Bounded findings

1. Preserve explicit epistemic subjects during retention generation. `unknown to us` cannot become unqualified global unknownness. This belongs in the existing complete-proposition generation and action/qualification comparison contract; the verifier correctly enforced it and should not be relaxed.

2. Make unresolved propositions structurally representable without coercing them into asserted affirmative claims. The exclusion prose was faithful before cleaning, but incompatible typing triggered a repair that substituted a sibling proposition. A bounded generated schema/prompt rule should represent the unresolved record with the permitted question/none form and keep the repair obligation tied to that same proposition. No second repair or retry is warranted.

3. Do not emit a partial block when the selected question has an unsupported half. The answer generator knew only the bracket proposition survived. It should return the supported part only if the public answer can explicitly identify the uncovered requested part without asserting source absence; otherwise return no block. The verifier's selection judgment should treat omission of a requested independent proposition as incomplete even when the cited surviving sentence is entailed.

4. Keep the canonical fiction composition that cites both proposal and promise when the question binds Ada's proposal to the embedded promise. The two rejected one-record Russian drafts demonstrate why a promise alone cannot supply the proposer relation. The existing floor is doing useful containment and should remain mandatory.

5. Split deterministic discourse telemetry by guard or add a non-public precise rejection code. V58's undated q5 is visibly faithful, but `discourse` aggregates several floors and prevents an evidence-led diagnosis. This can improve observability without changing acceptance, calls, or retry behavior.

The evidence does not support weakening semantic verification, adding a retry, changing the model, or changing the gate.
