# V76 exposed-probe preflight review

## Decision

**Approved** to launch exactly once:

- selected: V21 `development`, the eight exposed `v20-held-*` cases declared in the start receipt, one run, eight language/view coordinates each, 64 observations;
- built: V20 `development`, the four exposed `v19-held-*` cases declared in the start receipt, one run, eight language/view coordinates each, 32 observations.

This approval does not include V21 held-out, a full repeated trial, replacement runs, retries, additional cases, different caps, or changed runtime/harness bytes. It is transport and execution readiness approval, not a claim of semantic reliability.

## Frozen runtime and deployment

- HEAD and readiness runtime are `44e6e714f1758948f306ec90cdae9b0d453e3604`; tracked Git status is clean.
- The reviewed no-write integrity command independently succeeded immediately before this approval. It matched complete `packages/core/src` and `packages/core/dist` tree digests to `tmp/core-v76` and matched the eleven execution/readiness/trace harness hashes in `tmp/v76-launch-manifest.json`.
- `tmp/v76-postdeploy-check.json` was written once by the reviewed readiness writer and exactly embeds the current launch manifest.
- Deployment receipt records build, restart and live socket success. The eight relevant compiled dist files match their frozen snapshot hashes.
- Local receipt records 3,790 tests across 151 files and all routine gates green. All 21 compiled control groups passed with no provider calls.
- CI run `34417586519` and Documentation run `34417586501` completed successfully at the frozen SHA.

## Protocol evidence

The original ten-control protocol receipt remains transparently failed at 9/10 exact. Its sole failure, `four-branch-retention-repair`, completed one valid transport and decoded against the strict schema but shortened one artificial repeated-letter field. The original declaration and result remain byte/hash bound.

A separately declared, independently reviewed natural-sentence control used the same API, schema, field/object shape, per-field lengths, 3,200 caller cap and 2,400 effective cap. It completed once through one endpoint, decoded strictly and matched exactly, using 482 output tokens. Readiness binds its declaration, runner, result and design/outcome reviews to the original receipt.

Accounting is truthful: 11 logical calls, 17 endpoint requests, 10 fulfilled requirements and one preserved original failure. This establishes bounded schema/transport readiness only.

## Matrix, caps and gates

- Selected matrix: `v20-held-report`, `v20-held-hypothesis`, `v20-held-counterfactual`, `v20-held-exclusion`, `v20-held-assistant`, `v20-held-fiction`, `v20-held-undated`, `v20-held-alternatives` from V21 development.
- Built matrix: `v19-held-report`, `v19-held-question`, `v19-held-rejected`, `v19-held-alternatives` from V20 development.
- Both runners request answer output 2,400; readiness and final validation require resolved answer and retention limits of 2,400 and Luna for both runtime roles.
- Final validation requires unchanged thresholds and corpus fingerprints, exact prompt versions, exact ordered case rows, unique `[case, run]` pairs, all eight query coordinates, 64/32 observations, frozen launch receipts, balanced trace lifecycles and report/trace hashes.
- Independent source-first forensic review and independent grading remain required after execution. Positive model/verifier fields are not truth labels, and a failed cell cannot be averaged into a pass.

## Once-only and source isolation

Immediately before approval I confirmed absent:

- `tmp/v76-probes-started.json` and both selected/built launch receipts;
- both V76 selected/built final reports and trace files;
- `tmp/v76-completed-probe-provenance.json`.

The start script reruns the no-write manifest check before creating the marker and rejects any preexisting marker/report/trace. Each runner reruns integrity, writes one unique mode receipt and rejects existing output or trace paths. The benchmark uses temporary isolated invented knowledge-base/state directories; capture hooks do not record provider headers or credentials and use bounded error classes.

A separate held-out runner is present as preparation only. No V76 full/held-out start marker, launch receipt, report or trace exists. It is not in this approval and must remain unexecuted unless a later decision explicitly authorizes it.

## Preserved review history

- Initial harness findings: `tmp/language-v76-launch-harness-review-initial.md`
- Fixed static harness recheck: `tmp/language-v76-launch-harness-review.md`
- Runtime round-two review: `tmp/language-v76-round2-review.md`
