# V63 selected source-first forensic review

## Scope and accounting

Reviewed the finalized V63 selected report, all 178 trace rows, and the six original invented V20-development / v19-held sources. I did not use an output-grading receipt. Runtime flags and private verifier narratives are diagnostic evidence, not truth authority.

The report produced 36/48 answers. Twelve rows are null: all eight report queries, exclusion q1, assistant q7, fiction q3, and undated q7. There are no case-level availability failures. Two nulls are generation language failures and two are deterministic draft holds; the report case has no eligible substantive evidence after retention loss. No answer-verifier malformed-coordinate/unavailability event occurred in this run.

Source-first retention completeness is **5/6**, not the report's unreviewed 6/6 metric: hypothesis, exclusion, assistant, fiction, and undated preserve their full deciding source content; report preserves only the independent no-collection-booking denial and loses the substantive nested report.

## Report

Extraction row 2 emits two candidates. The substantive candidate is exactly 403 characters after cleaning. A frozen compiled reproduction in `tmp/reproduce-v63-report-403.mjs` / `.json` passes that exact trace candidate and the three exact source items to `tmp/core-v63/write/retain.js`; it returns no candidates and one `validation_failed` hold with `candidate text is not one bounded self-contained statement`. Frozen V63 code rejects any candidate with `text.length > 400` at `retain.ts:1149`. The source-faithful portion preserves Ada as outer relayer, Bo as inner reporter, permission to send the device for return-spring tension measurement rather than replacement, and Ada's unread-terms limit. But its clause `Ada Marlow has not ... independently confirmed this report` changes source `has no independent confirmation of the report` from possession/receipt of confirmation to Ada personally performing confirmation. Thus the over-cap hold also prevents a real predicate/experiencer drift; this candidate should not simply be admitted by raising the cap.

The one repair at row 4 returns no substantive replacement and does not mutate the already admissible sibling. The independent candidate `Ada Marlow states that no collection of her device has been booked` reaches verifier row 5, passes all three dimensions, and is routed to `proposed` at row 6. That denial is faithful: Ada is the asserting source, her device is the collection object, and no booking agent is invented.

All eight focused report answers are `no_eligible_evidence`: retrieval sees only the booking denial, which does not answer the return-spring report question. These are coverage losses over writable original evidence, not justified source-level abstentions and not answer-model failures.

## Hypothesis

Rows 8–10 retain and route one complete hypothetical unit. It preserves Ada's hypothetical rule, the Zephyr QX-100 foam-filter inspection every two months, the coupled consequence that a missed inspection would violate that assumed rule, actual requirements being unknown to us, and Ada not reporting an actual missed inspection.

All eight answers are non-null and source-faithful. The English copy and Russian translations retain the hypothetical scope, cadence, consequence, group-relative unknownness, and no-actual-miss qualification. Four rows are reported `partial`; regardless of that internal outcome label, their public answers are complete for the focused question. No factual promotion or actor loss found.

## Exclusion

Rows 44–46 retain and route the complete proposition: Ada asserts the damaged support bracket is not covered, while the exclusion record does not resolve fan-motor repair coverage and does not assert contractual silence. Seven answers are produced and preserve those distinct subjects and scopes. Russian `не утверждает, что договор ничего не говорит` remains under the record's negated assertion and does not claim whole-document absence.

q1 is `generation_failed` for a known wrong-mode choice. Rendering-choice row 51 selects `copy` of the complete English retained record despite requested Russian. Language-check row 52 receives that exact English body as its excerpt and returns `compliant:false`; row 53 records `language_mismatch` before any verifier call. This is an answer-generation mode/language failure over adequate retained evidence, not justified abstention or uncertain checker behavior.

## Assistant

Rows 79–81 retain the complete tentative assistant record. The retained and produced clauses keep the quarterly functional status-display check as a possibility, the assistant as the experiencer who has not examined the contract or confirmed the assumption, and the proposal as a possible contractual condition rather than an established requirement. The V63 contractual qualifier is present in all seven public answers; none changes it into a physical device state. Physical `status display` remains correctly separate.

q7 is a deterministic attribution hold. Rendering-choice row 110 selects a Russian translation whose body begins `Предварительное прочтение ассистента ...` and preserves the substantive content, but the generated form lacks the bounded reporting construction required by the generic-assistant attribution floor. Validation reports `attribution:1`; no semantic-verifier call follows. This appears to be a conservative false hold of a readable possessive/source construction, not an accepted error or availability failure.

## Fiction

Rows 114–117 retain both the asserted proposal by Ada to discuss the fictional example and the fictional promise by Vulpine Mutual to Bo, including free axle-cap replacements during the first ten weeks and the no-real-agreement boundary.

Seven answers are produced. All preserve the promise's promisor, recipient, benefit, duration, and fictional status. Where the proposal is selected, Ada remains the proposer; q4 and q6 select only the promise record and use neutral fictional-example/source framing without inventing a proposal actor. I found no accepted source, role, or qualification error.

q3 is `generation_failed` from an observed untranslated component. Language-check row 127 receives otherwise Russian prose containing literal ordinary `axle-cap`, supplied as a review token rather than a protected reference, and correctly returns `compliant:false`; row 128 records `language_mismatch` before verification. This is a coverage loss over adequate evidence and a correctly withheld language error.

## Undated proposal

Extraction row 142 requires the single repair at row 144; the repaired candidate then passes verifier row 145 and routes at row 146. It preserves Ada as proposer, review of warranty exclusions, `next year` relative to the undated original record rather than today/processing, unrecoverable calendar year, and Ada's separate no-adoption/no-meeting statements.

Seven answers are produced and faithful. Same-record narrative tense does not introduce a new calendar date. All retain Ada as proposal, adoption, and meeting actor and keep the source-relative clock explicit.

q7 is a deterministic `discourse:1` hold. Its generated **public block** is Russian throughout and substantively faithful, using `в году, следующем за недатированной исходной записью`; the private `record_readings.selected_meaning` separately ends with the stray character `仅`. That private diagnostic defect is discarded and is not a public language error. The public surface form does not satisfy the bounded source-relative/tentative discourse floor, and no verifier call follows. This is a false guard hold over writable evidence, not an availability event.

Direct reproduction with the frozen V63 exported helpers on the exact generated block returns `hasDeicticTime=true`, `hasUnknownReferenceClock=true`, and `hasSourceRelativeAnchor=false`. The failing subguard is therefore the source-relative anchor recognizer, not deictic detection or unknown-clock readability.

## Accepted errors and exact failure classes

I found **no accepted source-entailment, qualification, role, language, clock, or selection error** among the 36 non-null public answers.

- Retention gap: one substantive report candidate rejected by the 400-character structural cap; its text also contains a real confirmation-predicate drift. Repair does not recover it.
- Upstream no-evidence nulls: 8 report rows.
- Generation/language nulls: exclusion q1 and fiction q3.
- Deterministic false holds: assistant q7 attribution; undated q7 discourse/source-clock form.
- Semantic verifier rejections: 0.
- Verifier unavailable/malformed schema: 0. In particular, V62's omitted-plus-non-null coordinate failure did not recur. A structurally valid negative alignment would be an ordinary rejected block; malformed alignment coordinates would be unavailable.

## Bounded next scope

1. Make the existing 400-character retention limit explicit in extraction and repair instructions and return the actual cap-specific validation reason. Preserve the cap. A corrected report candidate must also distinguish `has no independent confirmation` from `has not independently confirmed`; shortening alone must not approve the predicate change.
2. Treat a possessive generic-role reading such as `предварительное прочтение ассистента` as bounded attribution only when it is clause-local, unnegated, source-role matched, and followed by the selected proposition; retain quote, competing-source, and unrelated-noun negatives plus mandatory semantic verification.
3. Extend the bounded Russian source-clock grammar to the observed declarative participial form `год, следующий за недатированной исходной записью`, with contrasts for quoted examples, conditions, unrelated events/processing anchors, and known dates. Do not weaken the unknown-clock or semantic gates.

The V63 prompt correction succeeds on the **assistant-case** contractual-sense boundary: every accepted assistant answer preserves a contractual condition and keeps the separate physical status display intact. The main nested report that originally motivated the contractual-condition correction never survives retention and therefore is never translated or answer-verified in V63. This run consequently provides no evidence that the report-path error itself is fixed, and the assistant observation does not establish general verifier competence beyond those rows.
