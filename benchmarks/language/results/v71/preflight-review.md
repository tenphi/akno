# V71 independent preflight review

## Disposition: APPROVE declared exposed probes

The frozen V71 revision `304b2195ae6c34fabab2b6c4106730a7edbf3186` is ready for the once-only declared 64 selected + 32 built exposed-probe matrix. No semantic probe report, trace, or start receipt existed at final review time.

## Verified evidence

- `git rev-parse HEAD` and `tmp/v71-frozen-runtime.txt` identify the same frozen SHA, and the tracked worktree is clean.
- `tmp/v71-postdeploy-check.json` records 3,349 tests in 146 files and passing build, lint, knip, formatting, repository safety, documentation doctor/build, smoke, installed-package smoke, and build/restart/socket deployment.
- Exact-SHA CI run `34386992932` and documentation CI run `34386992933` both conclude `success`.
- The frozen `tmp/core-v71` snapshot exists. All 17 compiled-control groups in the readiness receipt preserve mandatory semantics/selection, strict JSON, source-byte stability, and zero extra model passes where applicable.
- The four actual-provider controls completed once and are explicitly protocol-only: ordinary complete-record generation and two-record verification, structured-clock translation generation, and retention verification containing both `affirmed` and `negated` source-polarity enum values. Their receipts report `ok`, schema-valid exact echoes and make no model-competence claim.
- `tmp/run-v71-selected.sh` selects the eight declared V21-development exposed cases once, producing 64 language/view observations. `tmp/run-v71-built.sh` selects the four declared V20-development built cases once, producing 32 observations. Both require the common start receipt and refuse existing reports or traces. The start script additionally requires this preflight artifact, exact readiness SHA, a clean worktree, and absence of all four outputs before writing the sole start receipt.
- The plan retains Luna runtime, Sol independent review, the same acceptance gates, one retention structural repair, no semantic replacement run, and the approved fresh V21 fingerprint. Fresh V21 held-out remains unexecuted.

## Budget concern and resolution

My initial review held approval because the retention control receipt exposed a caller request of 3,744 tokens while the first budget summary stated only a 2,400-token role ceiling. The original summary is preserved at `tmp/v71-protocol-budget-initial.json`.

The corrected `tmp/v71-protocol-budget.json` now distinguishes the values accurately. The retention fixture requests the inherited 3,744 per-batch allowance, while its derive role is explicitly configured to 2,400. Frozen `ModelClient.tokenCeiling(perCall, perRole)` applies `Math.min`, for both Chat Completions and Responses, so the effective initial transport limit is 2,400. The other recorded answer calls request and receive an effective 2,222 limit. No cap, model, runtime, call, or echo changed; only the evidence accounting was corrected.

These observed echoes do not establish a universal character-to-token conversion or semantic competence. The service's 1,024-token overlay is expressly unvalidated by these isolated controls. Semantic quality, latency, and truncation remain outcomes for the declared probes.

## Scope limit

This approval covers launch of the exact exposed 64+32 matrix under the reviewed scripts. It does not approve a fresh held-out run, a retry, or a replacement execution, and it makes no prediction that the new source-polarity classification or structured-clock response will be semantically correct in live generation.
