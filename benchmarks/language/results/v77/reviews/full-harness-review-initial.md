# V77 conditional full-trial harness review

Status: **HOLD — conditional preparation is coherent, but the current capture hook cannot run the full matrix safely and several declared provenance/cap invariants are recorded without enforcement.** This is not launch approval.

Scope: static review of `tmp/v77-completion-contract.json`, the draft full-trial plan, launch/start/split runners, trace capture and validation, frozen readiness, and V22 approval metadata. I did not call a provider or benchmark, mutate runtime/harness code, grade V77 diagnostics, or read/display V22 held-out prose. I inspected only the V22 fingerprint, counts, IDs, split/admission/query structure and reviewer attestations.

## Findings

### P0 — the capture hook rejects the configured expansion model before tracing it

`tmp/capture-language-models-v77.mjs:8-14` asserts that **every** `ModelClient.chat` receiver has model ID `gpt-5.6-luna` before it classifies the operation. The benchmark enables query expansion in the full answer paths (`packages/core/src/bench/language.ts:355,371`), and `open.ts:276` constructs that client from `config.models.expansion`. Expansion is a separate configured role and need not be Luna.

Thus a legitimate non-Luna expansion call throws at capture line 9 before `model-call-start` is appended and before any provider request. This is instrumentation interference, not a runtime semantic hold. Root's independently observed built diagnostic has successful retention followed by case-level `evaluation_operation_failed` with empty query arrays, consistent with this exact path; it must remain preserved rather than rerun as a replacement diagnostic.

The full runners currently import this broken capture file (`tmp/run-v77-full-development.sh:4`, `tmp/run-v77-full-held-out.sh:4`). They must not launch.

The bounded correction is a new full-only capture hook that:

- recognizes each intended operation before model enforcement;
- checks retention, answer, both verifiers and ownership against the declared Luna policy;
- checks expansion against the separately frozen expansion-role ID;
- rejects an unknown operation before transport;
- retains balanced start/result/finish or start/throw lifecycle records; and
- has mocked tests proving the expected expansion model is admitted, a wrong semantic or expansion model is rejected before provider transport, and an unclassified call is rejected.

This changes measurement instrumentation, not runtime behavior, but it requires a new manifest hash and independent review before launch.

### P1 — prelaunch model-policy validation does not bind expansion to the completed diagnostic

`tmp/v77-full-launch-integrity.mjs:38-40` snapshots derive, answer, embedding and expansion configuration but asserts only derive and answer are enabled Luna roles at 2,400 tokens. `bench-results/language-selected-v77.json` is hash-bound at line 41, yet its `models` and `modelOutputTokenLimits` are not compared with the live policy before calls. `tmp/validate-v77-full.mjs:22` performs that comparison only after the full provider run has completed.

Because expansion is exercised before answer generation, drift in that role can alter the full measurement and be discovered only afterward. The launch check should compare every exercised model role and the declared effective role ceilings against the hash-bound completed diagnostic. The corrected capture hook should derive its role checks from the same immutable policy rather than apply a global model assertion.

### P1 — the declared 1,024-token language-audit ceiling is traced but not validated

The capture records `callerMaxTokens` on every transport start (`tmp/capture-language-models-v77.mjs:18-20`). The trace validator checks only that `language` is boolean (`tmp/v77-trace-integrity.mjs:30-33`) and never validates the token value. The completion contract and trial plan expressly scope language audit to 1,024 tokens.

Prior exposed traces show language transports consistently request 1,024, while other model callers legitimately request values above 2,400 before the model client's effective role cap. The narrow invariant is therefore: every `transport-start` with `language:true` must have `callerMaxTokens === 1024`. Effective derive/answer ceilings remain bound through report/config policy rather than by rejecting all larger caller requests.

### P1 — input-review metadata is only partially checked

The canonical V22 review is schema-valid and independently authored. Its exact metadata is:

- `kind: model`;
- reviewer ID `gpt-5.6-sol`;
- `independent:true`;
- `didNotAuthorCorpus:true`;
- `didNotTuneRuntime:true`; and
- `reviewedWithoutOutputs:true`.

`tmp/v77-full-launch-integrity.mjs:37` checks only the last and `independent`. It should assert the complete frozen reviewer object (or at least every required attestation and the expected reviewer identity), along with `schemaVersion:language-input-review-v1`. The current fingerprint, 22/22 exact ID match and all-approved checks at lines 26-37 are otherwise correct. Source and dist imports both reproduce fingerprint `b0e1d4871ac78007863609b90dd432588d7ef4d8e1c441f1255bdbf7bd564c8a` without printing case content.

### P2 — postrun provenance validates only two of the manifest's hashed files

The manifest contains hashes for runner, capture, validator, plan, readiness, protocol, completion contract, budget, selected report and blind packet (`tmp/v77-full-launch-integrity.mjs:41-42`). The start and each split launch correctly call the integrity guard before writing receipts or invoking the benchmark. This binds the execution start.

Postrun `tmp/validate-v77-full.mjs:9`, however, rehashes only the selected diagnostic and blind packet. It also does not rehash the separately stored input-review digest. For a self-contained completion receipt, the validator should recheck every `manifest.files` entry and `manifest.inputReviewSha256` before accepting reports/traces. This also prevents a changed validator or grading contract from silently producing the final provenance artifact after launch.

The split receipt timestamps are parseable but not ordered relative to the global start (`validate-v77-full.mjs:15-17`). Require each split `startedAt >= tmp/v77-full-started.json.startedAt`. This is a small provenance hardening, not a semantic gate.

## Verified behavior

### V22 authority without content exposure

- The blind packet contains 22 cases and hashes under `JSON.stringify(cases)` to the declared fingerprint.
- Its source and built exports reproduce the same fingerprint.
- The independent input review has exactly the packet's 22 unique IDs and approves all 22.
- Each split is validated after execution as 10 writable plus one read-only case. Each case/run must contain all eight unique query-language, answer-language and view coordinates.
- The runner passes `--corpus v22`, the complete split and `--runs 2`; it has no case filter. Development and held-out use separate output/trace paths and isolated benchmark knowledge bases.

No V21 held-out substitution path exists in these full runners.

### Frozen runtime and readiness

The conditional integrity script correctly requires frozen commit `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8`, a clean tracked tree, exact source/dist tree digests, build/restart/socket readiness, 3,910 tests in 152 files, 23 compiled groups, exact-revision CI and documentation CI, and ten exact protocol controls over 16 endpoint requests (`v77-full-launch-integrity.mjs:9-25`). These values match `tmp/v77-postdeploy-check.json`. Protocol results establish transport/schema compatibility only.

The launch manifest embeds the completion contract and separately hashes its file and the completion budget. Later `--check` requires a proceed decision, completed 96-observation diagnostic provenance and an independent preflight approval bound to the manifest, decision, provenance, completion contract and review (`v77-full-launch-integrity.mjs:47-50`). Neither decision nor preflight currently exists, so the present harness cannot start through its intended path.

### Once-only and matrix guards

`tmp/start-v77-full.mjs` checks integrity before creating a single global marker and refuses existing markers, receipts, reports or traces. Each split runner checks integrity again and refuses its own receipt and outputs before writing a launch receipt. `tmp/validate-v77-full.mjs:14-39` then requires both split reports, two runs, 22 case/run rows per split, all case IDs/admissions and all eight coordinates, giving exactly 320 writable plus 32 read-only observations. It does not infer semantic acceptance from generated answers.

The trace validator rejects unknown kinds/fields, duplicate starts/results/terminals, missing starts or terminals and mismatched language-result types. Call IDs share the capture's global sequence, so the cross-model/transport uniqueness check is valid within each process. The full-only capture fix must preserve this lifecycle behavior.

### Original gate and separate completion target

The report validator requires full reports to carry exactly the hash-bound selected diagnostic's runtime thresholds (`validate-v77-full.mjs:21-23`). Those remain the original 90% answer threshold, 80% retention/retrieval and unchanged zero-error/availability limits. The separately declared completion contract is hash-bound and sets 80% useful answers without overwriting report thresholds.

Runtime report flags cannot establish useful/source-faithful answers. After a complete run, one independent source-only output review must drive both calculations:

- original gate: at least 72/80 useful answers per split/run;
- PR completion target: at least 64/80 useful answers per split/run;
- both: at least 8/10 complete useful retained sets and 32/40 useful retrieval coordinates per split/run;
- both: zero accepted unsupported retained/non-null output, qualification, requested-language, promotion and source-byte errors; and
- both: no more than 5% case availability failure, which with 11 cases effectively permits zero failures per split/run.

Writable nulls are never useful; the read-only case is excluded from writable coverage and must separately be a justified hold. Pooled results cannot rescue a failed split/run. A post-grade completion receipt should consume the same independently reviewed rows and original gate artifact, changing only the answer-coverage comparison to the predeclared 0.8 target. It should not regrade outputs or use runtime verifier booleans.

## Final disposition

The matrix selection, frozen readiness, original-threshold preservation, completion-contract binding and once-only structure are sound. **The current harness is not launchable** because its global Luna capture assertion already interfered with the exposed diagnostic and would reject legitimate full-run expansion. Full preflight also requires the model-role, language-ceiling, complete reviewer-attestation and postrun hash/timestamp corrections above, regenerated manifest hashes, mocked no-provider tests, and a separate independent re-review.

No semantic provider run or V22 full start should occur from this snapshot.
