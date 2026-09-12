# V75 exposed-probe preflight review

## Disposition

**Approved to start the declared exposed probes exactly once:** the 64-observation V21 development matrix and the 32-observation built V20 development matrix named in `benchmarks/language/v75-trial-plan.md` and the frozen runner scripts.

I found no remaining preflight blocker. This approval is limited to those two development probes at frozen runtime `c699916e8f0f8f6537dcb66558ded4f998cf8cfd`. It does not authorize a fresh V21 held-out run, a replacement run, or an unchanged-runtime retry.

## Frozen runtime and launch integrity

At review time:

- `HEAD` is `c699916e8f0f8f6537dcb66558ded4f998cf8cfd`, and the tracked tree is clean.
- The full current `packages/core/src` tree, frozen `tmp/core-v75/src` tree, and manifest source digest independently agree at `3a47e6aa69f3e38f5f3f360600d76244f86d58e71c1502427e5179d52f686947`.
- The full current `packages/core/dist` tree, frozen `tmp/core-v75/dist` tree, and manifest dist digest independently agree at `6c320815b45829f68cda1abf000bd27690511fa2b8afb09fa0385572e2e03492`.
- Every launch-critical file listed in `tmp/v75-launch-manifest.json` matches its declared hash. The manifest itself hashes to `83527d8be54f4ace1cc683e79dff8d030c6810275810f19a0a41a202e1df28ea`.
- The manifest binds the benchmark entry point, both runner scripts, the built runner, both source/dist trace hooks, the per-run launch-integrity check, the start writer, and the final evidence validator.
- No V75 corpus start marker, per-run launch receipt, report, or trace existed when this review was finalized.

`tmp/v75-launch-integrity.mjs` reruns the important checks at each runner invocation. It requires the frozen/current commit, a clean tracked tree, exact full-tree source and dist digests, and exact equality of the manifest including the launch-file hashes. It then writes a unique mode-specific launch receipt and refuses to replace one. The final validator requires the receipt's exact key set, correct mode, parseable start time, full file map, and source/dist digests. This closes the earlier weaker receipt-identity path.

The launch receipt is created before each shell script repeats its output-absence checks. A stale output discovered by the shell would therefore consume that mode's launch receipt and stop the run. That behavior can require manual diagnosis, but it fails before a provider-backed corpus execution and does not permit overwriting or a duplicate run.

## Declared matrices and source isolation

The runners match the plan:

- `tmp/run-v75-selected.sh` selects only the eight named `v20-held-*` cases from V21 `development`, one run, eight EN/RU query-language, answer-language, and explicit/inferred-view combinations per case: 64 observations.
- `tmp/run-v75-built.sh` selects only the four named `v19-held-*` cases from V20 `development`, one run, the same eight combinations per case: 32 observations.
- Both runners explicitly set the answer output ceiling to 2,400.
- Neither runner requests a held-out split. The start and readiness receipts retain `freshHeldOutExecuted: false`.

The full source-tree digest also binds the corpus implementation used by the frozen runtime, while the hashed runner arguments constrain the requested split and case IDs. The trace hooks import source for the selected probe and frozen built output for the built probe. They capture only the exposed invented evaluation payloads supplied to those calls; no local knowledge-base or private configuration is read by the reviewed harness.

## Local, CI, deployment, and compiled evidence

`tmp/v75-postdeploy-check.json` records:

- 3,668 tests in 151 files and zero exit codes for the listed typecheck, suite, lint, format, knip, repository-safety, smoke, installed-package, and documentation checks;
- 21 compiled control groups, all completed without provider calls;
- CI run `34412309641` and Documentation run `34412309643`, both completed successfully at the frozen commit;
- successful build, restart, and socket readiness;
- frozen/current equality for the changed compiled modules, including `models/language.js`;
- zero corpus probes before this approval.

These receipts establish build and launch provenance and deterministic guard behavior. They do not establish language-model competence or the semantic usefulness of the pending outputs.

## Provider protocol evidence

The original V75 protocol receipt remains a failure and is represented truthfully:

- `tmp/v75-protocol-results.json` hashes to `ef831a7d4b4563acd33ded7d9cc9336c74795fc6ad95b54f387e3aa6aaf05dc1`.
- Nine of its ten logical controls are exact, schema-valid successes.
- Its sole failure is `two-record-answer-verifier`: transport succeeded and the value passed the production schema, but two maximum-size repetitive comparison strings were not copied exactly.
- The three schemas that V74 could not transport all succeeded under V75: positive retention verification, maximum-frame negative retention verification, and four-branch repair.

The original failure was not retried or relabeled. A separately reviewed natural-sentence amendment used the same captured production two-record verifier schema and the same field paths, branches, booleans, null shapes, IDs, field lengths, caller ceiling 2,222, role ceiling 2,400, and Responses endpoint:

- The declaration hashes to `40f971a7df17ac739e545339f093071972ccd6e1ff8533f32ca224166ed89703`.
- `tmp/v75-natural-verifier-result.json` records exactly one endpoint request and a completed `ok: true`, `schemaValid: true`, `exact: true` result.
- Reported output use is 1,019 tokens against the 2,222 effective ceiling.
- The amended driver binds the original receipt's exact bytes, original fixture-ID order, exact sole-failure disposition, frozen runtime, declaration hash, and freshly captured endpoint schema before making its one call.

The final accounting is therefore 11 logical controls and 17 endpoint requests: nine original exact successes, one separately declared amended exact success, and one preserved original exact-copy failure. Ten protocol requirements are fulfilled, with one historical failure still disclosed. This evidence supports the finite declared transport shapes; it does not show universal verbatim copying or reliable semantic judgment.

## Trace and final-validation behavior

Both trace hooks record model-call and transport start, completion, and throw events. Provider errors are reduced to a closed error-class value, while raw free-form provider errors and credentials are excluded. Schema diagnostics include the relevant structural keywords, including `pattern`, and rendering-choice records retain the schema-valid branch and language prose that the runtime actually checked.

The final benchmark reports remain authoritative for typed case availability and operation outcomes. A missing or partial trace alone must not be used to infer that no provider call occurred. The trace is supplementary evidence for call stages, schema transport, language checks, generated values, and usage.

`tmp/validate-v75-evidence.mjs` verifies the final reports against the exact case lists and eight-coordinate matrix, one run, development split, frozen model and prompt versions, 2,400 answer and retention ceilings, V69 thresholds and corpus fingerprints, and per-case byte stability. It hashes each final report and trace and writes a once-only provenance receipt. It deliberately does not grade usefulness or semantic correctness; those remain separate source-first review tasks.

## Practical limits

- The trace error classifier's `other_provider_failure` category is intentionally broad. It is bounded and safe to retain, but some transport failures may still require an offline reproduction or a separately reviewed diagnostic to localize.
- Exact provider controls demonstrate acceptance of the declared finite schemas and values. They cannot prove that the model will choose truthful semantic fields on corpus inputs.
- Start/readiness artifacts live under `tmp`; the launch manifest prevents changes to the runner, hooks, start writer, validator, source, or dist from passing unnoticed, while the final preflight remains a procedural reviewed receipt. Any change after this review requires regenerating the manifest/readiness evidence and another independent preflight review.

Subject to those limits, the frozen runtime and harness are ready for one execution of the declared 64+32 exposed development matrix.
