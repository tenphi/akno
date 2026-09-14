# Report-concern prototype code review — final

**Reviewer:** independent Sol review  
**Scope:** current `tmp/akno-integration` retention runtime and tests; read-only review  
**Disposition:** **clean for integration evaluation**. The two findings in `report-concern-code-review.md` are resolved. I found no remaining correctness blocker in this bounded change.

## Resolution of the initial findings

1. **Mixed repair regression — resolved.** The mixed clock-repair test now treats the locally unreadable report as an admitted candidate pending semantic audit, excludes original position 2 from `repair_targets`, keeps that record unchanged in `read_only_admitted_context`, and requires its owned `report_limit_alignment` in the existing verifier call. Clock/full repairs remain confined to original positions 0, 4, and 6. Valid, malformed, and duplicate repair transactions all assert the corrected candidate/held counts and repair obligations. This matches the runtime: the report concern is not a repair target, while the complete repaired vector is cleaned again and its report concerns are recomputed before verification.

2. **Missing replacement coverage — resolved.** The added tests now cover:
   - a concern created only after a genuine structural repair;
   - owned, foreign-source, and foreign-current witnesses in a two-concern atomic verifier batch;
   - dependent relation closure when the report candidate is semantically rejected;
   - legacy nested-report wording and the assistant-as-outer-reporter form;
   - a preserved witness alongside a distinct omitted source limit, which remains a qualification rejection;
   - positive, omitted, changed, malformed, missing, duplicate, unavailable, action-negative, qualification-negative, and polarity-negative verifier outcomes;
   - public/model-free cleaning remaining strict for both `generated` settings;
   - exact-provided model-free behavior and automatic-provided call-count/replay behavior through the existing public retain tests.

## Current runtime assessment

The private exception remains narrow. `runRetain` alone enables it; it requires generated input, a literal empty raw relation list, no simultaneous unreadable-clock defect, and passage through all preceding local validation. Public `cleanCandidateBatch` and caller-provided candidates do not receive the exception.

The verifier contract is candidate-owned and fail closed. A source witness must be an exact excerpt of that candidate's own deciding frame; a current witness must be an exact excerpt of that candidate's text. `omitted` and `changed` alignments must agree with a negative qualification verdict and its exact mismatch. A `preserved` alignment is additionally required for publication, but it cannot override the existing proposition, action, qualification, polarity, frame, negative-evidence, repair-original, or relation checks. Invalid or unavailable report-audit output holds the batch under the existing atomic behavior.

Removing the specialized report text-repair branch no longer leaves an uncovered invariant. Report prose is preserved for semantic comparison, one ordinary structural repair remains available for genuine independent defects, admitted siblings remain immutable during that repair, and a report concern discovered after reclean is audited in the final verifier call. The corrected assistant fixture also restores the real source-ownership precondition by making the assistant the literal outer reporter; it does not relax runtime attribution.

## Evidence reviewed

- `tmp/akno-report-concern-regressions-fixed.log`: 9 files, **619/619 passed**.
- `tmp/akno-report-concern-controls-fixed.log`: 3 files, **70/70 passed**.
- Current diffs in `retain.ts`, `retention-report-limits.ts`, `retain-report-limits.test.ts`, `retain-clock-repair.test.ts`, and the public retain tests.
- Removal of `retain-report-repair.ts` and its specialized tests, checked against the replacement concern, repair-vector, language/semantic, and provided-path controls above.

These deterministic tests establish the local and mocked verifier contracts. They do not establish model competence; that remains an integration-measurement question.
