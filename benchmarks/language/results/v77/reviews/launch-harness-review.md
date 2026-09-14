# V77 launch/readiness harness review — final

Independent Sol read-only re-review. The initial finding is preserved in `tmp/language-v77-launch-harness-review-initial.md`. I inspected the corrected input-provenance helper, launch integrity, readiness writer, start script, runners and post-run validator. I did not run a provider or benchmark, inspect held-out source content, or edit runtime code.

## Initial finding resolved

`v77-input-provenance.mjs` now validates, without printing sources:

- the exact V21 and V20 input-packet fingerprints;
- `sha256(JSON.stringify(input.cases))` against each declared corpus fingerprint;
- all 22 unique case IDs against the corresponding independently approved 22/22 input review;
- source and built `dist` corpus exports against the same fingerprint; and
- the corpus-specific gate thresholds.

The standalone preparation log records the expected V21 and V20 fingerprints and hashes with no provider calls.

`v77-launch-integrity.mjs` includes the provenance helper, V77 trial plan, concrete input packets and approved input-review files in the launch-manifest hash map. Its manifest also embeds the validated fingerprint/threshold metadata. Every integrity check recomputes those values from current source, `dist`, input and review bytes before a runner receipt can be created. The independent preflight approval is hash-bound to that manifest, readiness receipt and review.

Post-run validation now compares each report's fingerprint and thresholds to the corresponding launch-bound input metadata. It no longer uses a historical V69 output as its oracle. Launch receipts must exactly reproduce the manifest's input metadata, source/dist digests and file hashes.

## Remaining harness assessment

- The start script requires a clean tree, exact readiness/runtime match, independently signed approval hashes, a passing launch-integrity check, and absence of every start/report/trace artifact before atomically writing the common start receipt.
- Selected and built scripts implement exactly the declared 8×8 V21-development and 4×8 V20-development matrices, one run each, with Luna and the 2,400 answer overlay. Capture hooks independently reject any model ID other than `gpt-5.6-luna` before provider transport.
- Each runner creates one mode-specific immutable launch receipt and refuses replacement. Post-run validation checks all eight language/view coordinates, versions, caps, models, case order/counts, trace lifecycle balance and source bytes through the existing report fields.
- The readiness writer requires exact CI/docs success on the frozen revision, clean source/dist snapshot equality, 23 successful compiled groups, deployment build/restart/socket evidence, and ten exact/schema-valid provider controls with per-transport endpoint and effective-cap accounting.

## Freshness incident

`tmp/v21-heldout-source-exposure.md` accurately records that V21 held-out remains unexecuted but is no longer fully unseen to the root implementation agent. Quarantining that split from a V77 full trial is the correct response. Preserve V21 unchanged and its history intact. A later full gate should use an independently authored and independently reviewed fresh held-out split (proposed V22), bound by fingerprint without showing its source content to the implementation agent. This does not affect the already exposed V21-development/V20-development diagnostics reviewed here.

## Disposition

**The initial provenance blocker is resolved. The launch/readiness harness is clean for later frozen preflight review.** This is not approval to launch: declaration/provider results, final source/dist freeze, CI, deployment, readiness receipt and a hash-bound independent preflight approval do not yet exist.
