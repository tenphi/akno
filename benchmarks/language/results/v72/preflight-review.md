# V72 independent preflight review

## Disposition: APPROVE declared exposed probes

Frozen revision `93c7444ff2d860d88649af97db3ccf75bc6c82fd` is ready for the once-only declared 64 selected + 32 built exposed matrix. At final review, no V72 probe start receipt, report, or trace existed.

## Verified evidence

- `HEAD`, `tmp/v72-frozen-runtime.txt`, the frozen snapshot receipts, and `tmp/v72-postdeploy-check.json` identify the same SHA; the tracked worktree is clean.
- The readiness receipt records 3,410 passing tests in 146 files and passing build, lint, knip, formatting, repository safety, documentation doctor/build, smoke, installed-package smoke, and redeploy build/restart/socket checks.
- Exact-SHA CI `34392332407` and documentation CI `34392332385` both conclude `success`. The current CI includes Linux installed-package smoke. The earlier V70 evidence-only apt download failure remains infrastructure history and is not represented as a V72 test result.
- All 17 named postdeploy compiled groups are present in the readiness receipt. They preserve strict JSON, source/anchor ownership, mandatory semantic and selection checks, source-byte stability, and zero extra semantic/model passes where applicable.
- Four actual-provider calls completed exactly once as protocol-only controls: ordinary complete-record generation, actual two-record answer verification, structured-clock translation, and retention verification. Receipts report successful, schema-valid exact echoes and explicitly make no model-competence claim.
- The answer verifier echo uses private verifier v46 and demonstrates both a selected `preserved` property and a selected ordinary operation with `absent_from_both`. The emitted strict dependency does not permit a selected operation to pair with `tested_property: not_selected`. The retention echo includes both source-polarity enum values. These are transport/enforcement observations, not semantic judgments.
- Budget evidence distinguishes caller and effective ceilings: answer generation/verification controls request and receive 2,222; retention requests the inherited 3,744 batch allowance but frozen `tokenCeiling` applies the 2,400 role cap. The service's 1,024 overlay is explicitly unvalidated. No universal output-sufficiency claim is made.
- `run-v72-selected.sh` selects exactly the eight declared V21-development exposed cases for 64 coordinates; `run-v72-built.sh` selects exactly four V20-development built cases for 32. Each refuses existing report/trace files and requires the shared start receipt.
- `start-v72-probes.mjs` requires the final readiness SHA to match clean `HEAD`, requires this preflight artifact, rejects any prior start/report/trace, and writes one start receipt. The validation script pins answer verifier v46 and the other declared prompt versions.
- The plan retains the same models, caps, call counts, no semantic retry/replacement, one retention repair, thresholds, case matrix, and approved fresh V21 fingerprint. `freshHeldOutExecuted` is false.

## Limits

The schema echoes establish transport compatibility and strict branch availability only. They do not show that the model will identify a real tested property rather than falsely choose `absent_from_both`, or that the new report grammar will improve semantic output. The declared exposed probes and independent source-first review remain necessary. This approval does not authorize a replacement run or execution of fresh V21 held-out cases.
