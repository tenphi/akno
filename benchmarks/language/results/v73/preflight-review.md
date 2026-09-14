# V73 independent preflight review

## Decision

**Approved to run the two declared exposed development probes once. I found no preflight blocker.**

This approval is limited to the 64-coordinate V21 development selection and 32-coordinate built-package V20 development selection in `benchmarks/language/v73-trial-plan.md`. It does not authorize a fresh held-out run, a replacement run, a semantic retry, or any runtime/model/cap/gate change.

Frozen runtime: `1eb002b84c05927b1ac1c5f69e974908de36c224`.

## Frozen provenance and gates

- `git rev-parse HEAD` and `tmp/v73-frozen-runtime.txt` both identify the frozen runtime above, and the worktree is clean.
- The current `packages/core/dist` copies of `write/retain.js`, `ops/answer.js`, and `timeline/source-clock.js` are byte-identical to their `tmp/core-v73/dist` snapshots.
- `tmp/v73-postdeploy-check.json` records 3,488 passing tests in 147 files, all repository gates, build/restart/socket deployment, CI run `34398656057`, and Documentation run `34398656056` as successful.
- The readiness receipt contains 18 compiled control groups and 27 parsed control records. I found no false control outcome other than deliberate `modelCompetenceClaimed:false` declarations. The dedicated report-repair group records strict mixed indices, the unchanged 400-unit bound, materialized language checking, immutable source proof/siblings, semantic and polarity negatives, governing-comparison order, and the standalone clock branch.
- Runtime prompt versions are `answer-generation-v66`, `answer-verifier-v46`, `retain-extraction-language-v52`, and `retain-verifier-language-v36`, matching the declared unchanged versions.

The compiled receipts and provider echoes establish wiring, schema transport, boundaries and negative enforcement for their exact invented controls. They do not establish model semantic competence; the readiness receipt states that limitation explicitly.

## Protocol amendment and accounting

I reviewed `tmp/v73-protocol-validation-amendment.md` and its three independent receipts:

- `tmp/language-v73-protocol-failure-review.md`
- `tmp/language-v73-protocol-design-review.md`
- `tmp/language-v73-distinct-control-review.md`

The amendment preserves the original repetitive mixed-repair echo as a failure. Its endpoint response was successful and schema-valid, but it was not exact: the model omitted one repeated sentence from `personal_limits`. It is not counted as a passing plan control.

The separately declared distinct fixture keeps the same mixed production schema, candidate indices, maximum normalized field sizes of 200/78/120, combined 400-unit materialization, 3,200 caller request and 2,400 effective role ceiling. Its one execution in `tmp/v73-report-repair-distinct-protocol-control.json` is successful, schema-valid and deeply exact, with 286 output tokens. The fixture contains three different invented sentences and the original failed receipt remains separately preserved.

The intended rendering pair in `tmp/v73-declared-protocol-controls.json` also passed once with exact schema-valid values. The generation control used a 2,222 effective ceiling and 116 output tokens; the two-record verifier used the same effective ceiling and 1,075 output tokens. The previously completed structured-clock and retention-verifier echoes remain passing and were not repeated.

The final accounting is internally consistent across `tmp/v73-postdeploy-check.json` and `tmp/v73-protocol-budget.json`:

- five exact passing invocations fulfill the amended plan;
- two accidental alignment invocations passed but remain extra and do not fulfill it;
- one original repetitive repair invocation remains failed;
- total actual-provider control invocations: eight.

The accidental pair's raw values, usage and caller caps were not saved. The receipts leave those values unavailable rather than reconstructing them. No semantic pass, repair retry or model-competence claim is derived from any control.

## Launch and matrix guards

`tmp/start-v73-probes.mjs` requires:

- the current HEAD to equal the completed readiness runtime;
- a clean worktree;
- this preflight artifact to exist;
- the start record, both final reports and both trace files to be absent.

All five prospective result/start paths are currently absent. The start script carries forward only the already declared matrix record and overwrites the runtime, start time and plan reference for V73.

The two runners add their own no-existing-report and no-existing-trace checks and require the start record. Their arguments match the declared matrix exactly:

- selected: corpus V21, development split, one run, eight named `v20-held-*` development cases, eight language/view coordinates each, 64 observations;
- built: corpus V20, development split, one run, four named `v19-held-*` development cases, eight language/view coordinates each, 32 observations.

Both specify `--answer-output-tokens 2400`. The frozen readiness/protocol receipts record the derive role at 2,400 as well. The post-run evidence validator requires both report ceilings to equal 2,400, both model roles to be `gpt-5.6-luna`, the exact four prompt versions above, unchanged thresholds/fingerprints, one development run, exact case lists and a complete eight-coordinate matrix per case. A mismatch fails provenance validation rather than being silently treated as valid evidence.

The filesystem guards are ordinary existence checks rather than a cross-process lock. They are sufficient for the declared single-operator, once-only launch; concurrently starting the same runner would be outside the reviewed procedure.

## Source-byte isolation

The benchmark does not open the user's knowledge base. For every case, `runLanguageBench` creates separate temporary knowledge and state roots with `mkdtempSync`, writes only the selected invented corpus entry and invented ordinary page, opens Akno with the temporary root and `isolated:true`, and removes both roots afterward. Folder and indexing behavior are supplied through benchmark overrides. Provider configuration supplies model connectivity, while the storage root and evaluated prose come from the isolated benchmark.

The selected capture wrapper imports the frozen source tree; the built wrapper imports the byte-matched frozen `dist` tree. Both append only the current benchmark's model messages/results to the explicitly supplied V73 trace path. They do not enumerate or read another knowledge root. Per-case byte stability hashes the temporary Markdown tree before/after retention and rebuild; the final validator reports any unstable case as `sourceByteChanges` rather than hiding it.

No V73 start record, result report, trace, or completion-provenance receipt existed at review time. Fresh V21 held-out execution remains absent and unauthorized.

## Residual limits

- The corrected distinct repair echo resolves the repetitive-fixture confound for one exact call. It does not erase the original failure or prove exact copying for arbitrary prose.
- Local and compiled controls cannot prove that Luna will follow the new governing-predicate and label-scope instructions on corpus outputs. That is the purpose of the independently reviewed exposed diagnostics.
- The post-run validator checks provenance, matrix completeness, versions, ceilings and source-byte outcomes. Independent source-first grading remains necessary for usefulness and semantic correctness.

Subject to the existing one-shot operating procedure, the exposed V73 development probes may start.
