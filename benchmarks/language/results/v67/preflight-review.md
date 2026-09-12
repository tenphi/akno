# V67 preflight and protocol-control review

## Disposition

Clean for the declared exposed 64 + 32 observation matrix once the frozen-commit CI readiness assertion succeeds. The reviewed receipts are internally consistent and bind to frozen runtime `ac1059e4a3df85fbfef12749f65439a69434d56c`. They establish transport/schema compatibility and compiled enforcement only; they make no semantic-quality claim.

## Frozen provenance and deployment

- `git rev-parse HEAD`, `tmp/v67-frozen-runtime.txt`, and every protocol receipt contain the same full commit hash.
- `tmp/v67-redeploy.log` records build success, restart of `dev.akno`, and an available socket. The postdeploy logs contain successful compiled checks for the changed and inherited boundaries, mandatory semantic/selection checks, source-byte preservation, and zero added model passes.
- The readiness writer independently requires a clean worktree, exact frozen hash, 2,966 tests across 144 files, successful CI and Documentation runs for that exact hash, all compiled-log families, exact protocol echoes, and successful build/restart/socket evidence before it can write the readiness receipt. At review time Documentation CI is reported green and CI is still finishing, so the current artifacts support preflight but do not themselves authorize starting probes until that script's CI assertion passes.

## Provider protocol controls

There are four logical controls, matching the plan:

1. Complete-record generation returned an exact, schema-valid `copy` branch.
2. Answer verification returned an exact, schema-valid negative verdict.
3. Translation-only generation returned an exact, schema-valid `translate` branch.
4. Retention verification returned an exact, schema-valid two-candidate verdict containing both the single-frame and multi-frame shapes.

All have completed status, null error/reason where reported, and the answer receipts use the declared 2,400-token diagnostic ceiling. The retention receipt identifies `gpt-5.6-luna`, records actual usage, and explicitly states that it performs no memory write or semantic usefulness judgment. Its output is deeply equal to the supplied constant JSON; the readiness writer recomputes that equality rather than trusting a stored `exact` label.

The answer-verification echo exercises all three alignment relation/null forms in one source alignment:

- actor: `not_selected`, nullable source anchor, null answer anchor;
- object/mechanism: `preserved`, non-null source and answer anchors;
- qualification: `omitted`, non-null source anchor and null answer anchor.

The expected payload serializes each alignment as `source_anchor`, `answer_anchor`, `detail`, then `relation`, consistent with the frozen schema-order test and compiled `compiledComparisonBeforeRelation` receipt. The negative qualification boolean has a matching qualification mismatch, so this is a valid negative semantic shape rather than an acceptance-path relaxation. The selected-excerpt judgment remains required and true; the semantic negative remains false. The retention schema remains a strict root object with strict candidate branches, literal singleton ID enums, required multi-frame audit only for the multi-frame candidate, and `anyOf` rather than `oneOf`.

These constant echoes demonstrate that the provider accepts and returns the exact wire contracts. They do not demonstrate generation quality, semantic-verifier accuracy, or reliability under the unchanged 1,024-token service overlay.

## Declared matrix and freshness

The plan's counts reconcile: eight selected cases × eight language/view combinations = 64, and four built-package cases × eight combinations = 32. The selected and built case IDs are explicitly listed, each exposed probe is limited to one identical execution, and replacement runs are prohibited. Full V21 execution remains conditional on independent source-only grading and forensics. The plan records the approved fresh V21 fingerprint and states that held-out V21 remains unexecuted; nothing in the reviewed receipts indicates held-out execution.

No inconsistent count, hidden retry, schema loosening, provenance mismatch, or inadequate transport branch was found.
