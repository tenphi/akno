# V73 independent Sol code review — round 1

## Disposition

**Clean: no actionable correctness or release-blocking finding in the reviewed diff.** The implementation matches the bounded V73 plan and preserves the existing local, language, vector, semantic, call-count, retry, cap, and public-schema boundaries.

I reviewed the current diff from `eab05b4`, including the untracked `retain-report-repair.ts` and its tests. I did not edit runtime/tests, inspect fresh held-out data, or call a provider.

## Report-only text repair

The branch is selected from private guard state, not `reason` text. `unreadableReportUncertainty` is computed at the actual report guard, but admission is deferred until after the other per-candidate checks. `textOnlyReportRepairs` is populated only for generated candidates whose raw `relations` value is literally an empty array. Earlier text, discourse, frame, subject, attribution, agency, time, unsafe-discourse, schema, and other local failures return before certification. Nonempty, absent, malformed, or pre-cleaned-looking relations remain on the existing full-candidate branch.

The response branch is strict and index-bound. It permits only `candidate_index` plus the three prose fields and rejects candidate metadata/proof fields. Singleton numeric IDs use enum output rather than the previously failing numeric `const`; mixed text/full targets produce disjoint `anyOf` arms. The server clones the frame-completed original candidate and replaces only `text`.

The three normalized maxima sum to 398 UTF-16 units, and the two server spaces preserve the existing 400-unit ceiling. Newline and NUL remain visible and fail the sentence patterns. Atomic `JSON.parse` applies whenever the transaction contains a text-only target, preventing loose recovery of truncated or trailing mixed transactions.

The reconstructed candidate returns through `completeGeneratedFrames` and full-vector `cleanCandidateBatchWithPositions`; admitted siblings are compared by original position and deep equality, lost positions fail the transaction, and the exact completed original becomes the semantic repair obligation. A failed reconstructed candidate remains held. There is no fallback repair or extra call.

Language coverage is intact. `additionalLanguageProse` contributes the exact normalized/materialized segment text. In a mixed transaction, ModelClient also runs ordinary `generatedProse` extraction, so a full-candidate sibling's `candidate.text` remains checked; the callback supplements rather than replaces generic prose discovery.

The segmented presentation remains fallible: its fixed 200/78/120 partition may make some faithful reports unrepairable, and the prose regex allows internal punctuation even though the prompt asks for one sentence per field. Neither is an unsafe admission because the full cleaner and semantic verifier remain mandatory; the finite partition should remain documented and measured in the declared probe.

## Unknown original-record clock

`hasUnestablishedOriginalClock` implements the intended narrow form: affirmative clause start, optional `the`, exact `original record` possessive, coordinated `date and calendar day/week/month/year`, closed `cannot/can't be established`, quotation masking, horizontal whitespace, and `hasUnretractedClauseEnd`. It does not enable the deferred `whose` relative-clause form or alter Russian clock grammar. The negative controls cover positive/modal predicates, unrelated/device/processing possessors and objects, reversed/split objects, newline borrowing, questions, reported/conditional/meta-negated/quoted forms, and comma/semicolon/sentence retractions.

The helper intentionally recognizes only `established`, not the broader `determined/resolved/recovered` family discussed as an optional design extension. That is consistent with the exact V72 repair evidence and is a finite documented limit, not a defect.

## Typed labels and governing polarity

The verifier prompt moves server-owned record-scope definitions into an ID-keyed `typed_label_contracts` table and explicitly says they define metadata rather than establish source facts. Tentative candidates carry the conditional embedded-hypothesis rule plus the ordinary fallback. The prompt requires the verifier to establish explicit coupling from source and candidate before applying the special scope and preserves actor, action, alternatives, evidence limits, and nonselection obligations.

Within the strict response object, comparison now precedes `source_selected_polarity`, followed by mismatches and the unchanged three booleans. Source-polarity equality remains mandatory in runtime acceptance. The new affirmative-decline guidance addresses the observed governing-predicate error without changing enums or excusing subordinate omissions. Field order and prompt wording are elicitation aids only, as the plan states; deterministic tests do not prove live model competence.

## Tests run

I ran:

```text
pnpm exec vitest run \
  packages/core/src/write/retain-report-repair.test.ts \
  packages/core/src/write/retain-verification.test.ts \
  packages/core/src/timeline/source-clock.test.ts
```

Result: **3 files passed, 388 tests passed**.

The tests meaningfully cover strict unauthorized deltas, raw relation eligibility, earlier competing issues, immutable siblings, every semantic-negative dimension and polarity, malformed/trailing transactions, language failure, normalization, mixed wire branches, exact V72 clock grammar, and tentative/governing-predicate verifier payloads. Actual Chat and Responses transport and live behavior still require the frozen protocol controls and exposed probes declared in the plan; these unit results make no model-competence claim.
