# V56 selected forensic review

## Scope and accounting

I reviewed only the finalized [`language-selected-v56.json`](selected-diagnostic.json), its [`trace`](../../../../bench-results/language-selected-v56-trace.jsonl), and the finalized invented-source packet [`language-selected-output-packet-v56.json`](language-selected-output-packet-v56.json). I did not inspect an output-grading receipt or call a model.

The report contains six cases and 48 query rows. It produced 27 non-null answers: 25 are source-faithful and two contain accepted source-role/scope errors described below. The 21 nulls comprise four `draft_rejected`, one `generation_failed`, eight `empty_draft`, and eight `no_eligible_evidence`. There was one answer-operation failure and one language-policy rejection, but no case-level or retention availability failure. All source bytes remained unchanged, and all ordinary-prose/replay checks reported success.

Retention wrote seven of nine generated candidates. Five of six cases have their complete intended retained sets. The fiction claim was held at semantic verification, and the undated proposal remained held at structural validation after the one repair. The report case retained and routed both the substantive nested report and the separate no-collection-booking denial. This is a complete outcome in this trial; V56 made no placement or ownership implementation change, so it does not establish that an earlier placement failure mechanism was fixed.

Within each case, q0..q7 are EN→EN inferred, EN→RU inferred, EN→EN explicit, EN→RU explicit, RU→EN inferred, RU→RU inferred, RU→EN explicit, and RU→RU explicit.

## V56 rendering branch and verifier transport

The single-record rendering branch was used for the hypothesis, exclusion, assistant, and fiction answer calls. It was not used for the report: the complete retained report payload was 410 characters including its visible label and therefore exceeded the frozen pilot bound. The trace shows `rendering_mode: copy` for eligible same-language output and `rendering_mode: translate` for eligible cross-language output, followed by materialization before deterministic guards and the existing verifier. The verifier received `rendering_scope: complete_retained_record`, immutable source-frame anchors, answer anchors, source alignments, the three semantic booleans, and excerpt selection. I found no foreign/stale anchor, malformed verdict, audit leakage into public output, or accepted block that skipped verification.

The branch does not itself prove semantic correctness. Its source-backed canonical record was copied exactly in same-language hypothesis, exclusion, and assistant rows, and the translated results still depended on model translation, language review, guards, and semantic review. One cross-language exclusion request failed before answer verification because the language check was applied to the English canonical rendering for a Russian request.

## Case findings

### `v19-held-report`

Retention is complete and source-faithful. The written report preserves Ada Marlow as outer relayer, Bo Winters as the embedded source, permission to send the device to a service bench to measure return-spring tension rather than replace the spring, and Ada's lack of reading and independent confirmation. The separate denial, `Ada Marlow states that no collection of her device has been booked`, also writes and routes.

Six of seven non-null answers (q0, q1, q2, q4, q6, q7) preserve those roles and qualifications. Q3 is an accepted reporting-role error: `По словам Bo Winters, Ada Marlow передала, что ...` makes Bo the source for the proposition that Ada relayed the terms, reversing or materially obscuring the source's Ada-outer/Bo-inner construction. The verifier nevertheless marked actor alignment and all three semantic dimensions true.

Q5 is a false deterministic attribution hold. Its draft was `По словам Bo Winters, которые пересказала Ada Marlow, ...`; despite awkward agreement, it expresses Bo's words as content relayed by Ada and preserves the service action, contrast, and both personal limits. It never reached semantic verification. Adequate writable evidence existed, so the null remains an answer coverage loss.

### `v19-held-hypothesis`

Retention is complete and faithful. All eight answers are faithful complete-record renderings. They preserve Ada's hypothetical two-month foam-filter rule, the coupled conditional consequence for a missed check, unknown actual requirements, and the fact that Ada reports no real missed inspection. Same-language outputs copy the retained record; cross-language outputs translate it. Every block reaches the full verifier with valid source/answer anchors.

### `v19-held-exclusion`

Retention is complete and faithful. Six non-null answers (q0–q4 and q6) preserve the damaged support bracket as the warranty-excluded object and keep the uncertainty scoped to what the exclusion record establishes about fan-motor repair, without claiming that the whole contract is silent.

Q5 is an accepted action/object-role error: `сама запись ... не определяет, покрывается ли ремонтом двигатель вентилятора` asks whether the fan motor is covered *by repair*, whereas the source says the record does not determine whether *repair of the fan motor* is covered. Later correct contract-silence wording does not erase that incompatible first proposition. The semantic verifier accepted it.

Q7 is `generation_failed`, not a semantic abstention. For the requested Russian answer, the trace's language check received the unchanged English complete retained record and returned `compliant:false`; the operation then ended `language_mismatch` before a generated answer or verifier call. This is a pilot/language-check integration failure over adequate evidence, not a justified source-level null.

### `v19-held-assistant`

Retention is complete and faithful. The record keeps the assistant as the source of a preliminary reading, a possible quarterly status-display check, the assistant's personal lack of contract examination and confirmation, and possible-condition rather than established-requirement scope.

All five non-null answers (q0, q1, q2, q4, q6) are faithful. Q0/q2/q4/q6 copy the complete retained English record; q1 translates the complete proposition into Russian.

Q3, q5, and q7 are false pre-verifier attribution holds. Each Russian translated draft begins with a source-bound passive/nominal label such as `Сообщено ассистентом` and then explicitly attributes the preliminary version to the assistant and preserves both personal limits. Language review passed, but the bounded attribution floor rejected all three before semantic verification. The drafts are source-faithful despite some stylistic stiffness.

### `v19-held-fiction`

Extraction produced two source-faithful propositions: Ada's proposed discussion/no-real-agreement plan and the fictional Vulpine Mutual promise to Bo Winters. The plan wrote. The promise candidate was held at semantic verification because its generated text said `In Ada Marlow's invented example`. The verifier interpreted the possessive as an unsupported claim that Ada created the example.

That rejection is at least a semantic false hold, or at minimum genuinely disputed. In ordinary context, “Ada Marlow's invented example” can identify the fictional example she just proposed discussing rather than assert authorship, and the complete source expressly links Ada to proposing that example. The candidate otherwise preserves Vulpine Mutual as fictional promisor, Bo as fictional recipient/character, free axle-cap replacements, the first ten weeks, and fiction-only scope. A safer generator could avoid the ambiguity with `In the invented example Ada proposed discussing`, but the held candidate did not clearly add a different proposition.

Because only the plan remained, every query's generation reading correctly observed that the retained record did not contain the axle-cap promise and returned zero blocks. Thus all eight `empty_draft` rows are reasonable decisions for the reduced evidence actually supplied, but all eight are source-level answer coverage losses caused by the upstream retention hold. They are not evidence that the original source lacked an answer.

### `v19-held-undated`

The extracted proposal correctly identifies Ada, review of the Zephyr QX-100 warranty exclusions next year, non-adoption, no arranged meeting, and unknown calendar date. The initial candidate was held by the source-clock validation floor. The single repair then stated: `next year understood from the moment of the source record rather than from today or processing time; the source record has no date, so the specific calendar year cannot be recovered`, while retaining Ada and both negative actions.

That repaired record is source-faithful. It was still held as `time_unresolved` before semantic verification because the bounded source-clock recognizer accepts forms such as measured/counted/reckoned/relative to the record but not `understood from the moment of the source record`. This is a deterministic lexical false hold, not an invented time or a genuine unresolved-source defect.

With no persisted evidence, all eight rows are `no_eligible_evidence`. They are mechanically correct for the empty retained set and source-level coverage losses caused by validation. No answer model or semantic verifier ran for them.

## Failure classification

- Complete retained sets: 5/6 cases under a source-first reading; the fiction set is incomplete. The undated case has no persisted record despite a faithful repaired candidate.
- Non-null production: 27/48.
- Clearly faithful non-null answers: 25/27.
- Accepted source errors: 2 — report q3 reporting-role reversal/obscuring, and exclusion q5 repair-as-covering-instrument scope.
- False deterministic answer holds: 4 — report q5 and assistant q3/q5/q7.
- Answer-generation/language integration failure: 1 — exclusion q7 checked the English canonical record against a Russian target and failed before verification.
- Empty drafts over reduced evidence: 8 — all fiction rows, downstream of the disputed/likely false retention semantic hold.
- No eligible evidence: 8 — all undated rows, downstream of a false source-clock validation hold.
- Typed provider/transport availability failures: 0. The sole answer operation failure is the typed language mismatch above.
- Source-byte changes: 0/6.

## Bounded findings for a later revision

1. **Bind language review to the materialized target-language payload.** In the pilot path, translation must be materialized before `additionalLanguageProse` is checked; the checker must never assess the English canonical record as the Russian answer. Keep the same checker verdict authoritative and fail closed—this needs ordering/binding correction, not a retry.

2. **Generate one canonical nested-report construction.** Prefer `According to Ada, Bo reported ...` / `По словам Ada, Bo сообщил ...`, with Ada's verification limits in the same complete proposition. This prevents the accepted outer/inner reversal and avoids expanding guards for every awkward relay construction.

3. **Recognize source-relative meaning rather than one verb list.** The repaired undated phrase `understood from the moment of the source record`, paired with explicit no-date/unknown-calendar-year language, carries the required anchor. A bounded structural rule can accept `from the moment of this/original/source record` while retaining negative tests for current processing time and unrelated device dates.

4. **Keep associative provenance distinct from authorship in semantic review.** `Ada's invented example` is ambiguous in isolation, but the complete frame says Ada proposed discussing the example. The verifier should reject only a concrete selected mismatch; generation can remove the ambiguity with `the invented example Ada proposed discussing`. This retains mandatory semantic verification and requires no second call.

5. **Use a canonical Russian assistant-report form already supported by the attribution floor.** The complete-record translator should emit a direct construction such as `Ассистент предварительно сообщает/предполагает, что ...`, preserving personal non-examination/nonconfirmation. This is narrower than admitting arbitrary passive labels.

6. **Keep action/object relations explicit in translation.** The exclusion q5 error shows that complete-record rendering alone does not prevent argument inversion. The existing verifier audit should treat `repair of the fan motor is covered` versus `the fan motor is covered by repair` as a changed object/mechanism relation.

The evidence does not support adding a generation or semantic retry, weakening the semantic verifier, changing the model, or changing the gate. The largest losses came from one source-clock surface mismatch and one disputed semantic overread upstream of answering, plus a concrete ordering error in the new rendering/language-check branch.
