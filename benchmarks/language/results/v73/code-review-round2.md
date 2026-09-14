# V73 independent Sol code review — round 2

## Disposition

**Clean in the reviewed scope. I found no actionable correctness or release-blocking defect in the current diff against `eab05b4`.** The new report text-repair arm is a fail-closed presentation repair, not a source or metadata authority. The original candidate position, completed exact source spans, nontext fields, admitted siblings, language policy, canonical cleaner and final full-source semantic verdict all remain binding.

I reviewed the current worktree independently of the round-1 conclusion, with particular attention to `packages/core/src/write/retain.ts`, `packages/core/src/write/retain-report-repair.ts`, `packages/core/src/timeline/source-clock.ts`, the new and migrated tests, `.changeset/knowledge-language-discourse.md`, and `benchmarks/language/v73-trial-plan.md`.

## Report text-only repair

Eligibility is sufficiently narrow for this revision:

- `hasReportUncertainty` establishes the exact-frame presentation defect, but the cleaner defers that defect until the candidate has passed speaker/attribution, agency, time, booking, source-clock, canonical-discourse, fiction and protocol-schema checks.
- The special arm is private, generated-only, keyed by the original extraction index, and requires the raw `relations` value to be a literal empty array. Missing, malformed and nonempty relation values remain in the full-candidate arm, so the later relation graph cannot be skipped by claiming text-only eligibility.
- The stored original is the frame-completed extraction record. Reconstruction deep-clones it and changes only `text`; it does not accept model-returned metadata, source spans, relations, routing or qualification fields.
- The strict union is disjoint by numeric index enum. Text targets cannot use the full-candidate arm, full targets cannot use the segmented arm, extra properties fail, duplicate indices fail, and incomplete or trailing mixed transactions are not salvaged. When any segmented target exists, strict `JSON.parse` applies to the whole atomic repair transaction.
- The three raw schema limits total 398 UTF-16 units and the two server-owned spaces bring the materialized maximum to the existing 400-unit candidate limit. The canonical cleaner measures the final normalized text again, so normalization cannot borrow capacity or bypass statement checks.
- A reconstructed vector passes `completeGeneratedFrames` and the full canonical cleaner. Original-position survival and deep equality protect admitted siblings; a dedupe/cap/dependency collision invalidates the transaction instead of silently replacing a record.
- The final verifier receives the complete original source, exact candidate frames and the original-position repair obligation. All three semantic booleans, the source-derived polarity equality and reason consistency remain mandatory, with no semantic retry.

The language hook is wired correctly. `ModelClient.chat` combines ordinary `generatedProse(parsed)` with `reportRepairLanguageProse(parsed)`: full-candidate `text` in a mixed response remains checked, while the three private segmented fields are checked through their exact normalized materialization. A failed language judgment rejects the atomic repair and does not reach a write. The helper itself does not authorize quoted or foreign prose; source meaning remains the final verifier's responsibility.

## Source clock and label scope

The new clock branch admits only a standalone affirmative clause whose subject is the original record's date plus one calendar unit and whose predicate is `cannot/can't be established`. It masks quotations, requires horizontal rather than arbitrary whitespace, uses a clause start, and applies the shared unretracted ending check. It does not merge the independently required relative anchor with unknownness. The tests cover conditional, reported, quoted, reversed, split, interrogative and retracted controls. This is a finite English presentation grammar; equivalent forms outside it can still be held and repaired, which is the declared conservative behavior.

Moving `semanticRecordScope` definitions into the server-owned, candidate-ID-keyed `typed_label_contracts` table removes an untrusted candidate-local definition without making the table evidence. Candidates no longer carry `record_scope`. In the provider-visible verdict schema, frame audit and semantic comparison precede `source_selected_polarity`; the immutable candidate polarity equality remains an independent acceptance condition. The governing-predicate instructions explicitly separate positive reports from their negative personal limits, affirmative declines from subordinate nonpurchase, and actual discussions from tentative embedded hypotheses. These instructions improve the existing fallible judgment but do not weaken any deterministic or semantic gate.

## Practical limits

- The three sentence roles are model-produced and are not independently parsed for reporter/action semantics. That is appropriate here because only their concatenated readable record is persisted and the mandatory complete-source verifier owns meaning. Local positive stubs demonstrate routing and enforcement, not model competence.
- A malformed or language-invalid segmented member makes a mixed transaction unusable even if another full repair would have been valid. This is a bounded availability tradeoff of the one atomic repair call, not an acceptance bypass.
- The fixed `200 + 78 + 120 + 2` budget can be insufficient for a long qualified report. The model may omit that target; the server does not truncate, synthesize prose or fall back to another call.
- The typed-label and governing-predicate changes remain elicitation. Independent exposed evaluation is still required to establish whether the configured model follows them.

## Validation

I ran the four directly affected suites on the reviewed tree:

```text
packages/core/src/write/retain-report-repair.test.ts
packages/core/src/write/retain-verification.test.ts
packages/core/src/write/retention-schema-transport.test.ts
packages/core/src/timeline/source-clock.test.ts

4 files passed; 409 tests passed.
```

This run includes the migrated provider wire-order assertions, strict mixed repair schema and language transport checks, semantic-negative repair controls, immutable-vector collision behavior and the new clock boundaries. `git diff --check` also passed. The earlier full-suite failure was confined to stale verifier header-order fixtures; those fixtures now assert frame audit → comparison → source polarity and candidate-ID-owned label contracts, and the focused transport suite passes after that migration. Full repository and compiled/provider gate completion remains a freeze prerequisite to be recorded by the root workflow; it is not inferred from these local stubs.
