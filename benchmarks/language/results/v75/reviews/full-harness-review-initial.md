# V75 conditional full-trial harness review — initial

## Scope

I independently reviewed the prepared manifest, integrity/start scripts, both split runners, validator, and conditional plan. I did not execute a provider or benchmark call, inspect fresh held-out contents, or create an approval receipt. Only the already recorded `--prepare` path has run.

## Findings

### 1. Medium — the validator's report contract is read from an unbound mutable baseline

`tmp/validate-v75-full.mjs` loads `bench-results/language-selected-v75.json` and uses it as the authority for `models`, `modelOutputTokenLimits`, `thresholds`, and seven version/config fields. That baseline file is not included in `v75-full-launch-manifest.json`, and the validator does not compare those report fields directly to immutable values embedded in the manifest. A changed or replaced selected report after approval could therefore change what the validator calls “unchanged” without changing any manifest-bound runner hash.

Before approval, either add the selected baseline report's SHA-256 to the manifest and check it in the integrity and validation paths, or embed the exact expected report contract fields in the manifest and compare full reports directly to them. Preserve the initial manifest and preparation receipt when regenerating the corrected manifest.

### 2. Low — bind the validator's input metadata file explicitly

The integrity script binds `tmp/language-v21-input-review.json`, the frozen `packages/core/src` tree (which includes the actual V21 corpus), and the declared corpus fingerprint. The validator separately reads `tmp/language-v21-blind-inputs.json` to derive expected split IDs and admissions, but that file's bytes are not in the manifest. This cannot silently change the frozen runtime corpus because the source-tree digest and report fingerprint are checked, but it can change the validator's expected metadata independently of the approved manifest.

Add the blind-input metadata file's SHA-256 to the manifest and verify it without displaying held-out contents. This is provenance hardening, not permission to inspect or tune on the fresh source.

## Controls that are sound

The remaining harness boundaries are coherent:

- exact clean `HEAD`, source/dist digests, corpus/input-review fingerprint, runner hashes, and model policy are checked before start and again before each split entry;
- launch requires a separate proceed decision, completed 96-coordinate exposed provenance, and independent approval bound to manifest, decision, and provenance hashes;
- the durable global start marker and split-specific non-overwrite receipts preserve partial or failed starts;
- reports and traces must not preexist; each runner invokes the complete V21 split for two runs, with no case filter and the fixed 2,400 answer overlay;
- final report validation enforces 11 cases per split/run, ten writable plus one read-only, all eight unique language/view coordinates, 320 writable and 32 read-only observations, source-byte and availability summaries, and report/trace hashes;
- acceptance grading remains subsequent and per split/run rather than averaged.

Running the two split shells concurrently is compatible with the design because their result paths and benchmark KBs are separate. Any contention-related availability failure still belongs to the relevant cell.

## Disposition

**Hold approval pending the two manifest/provenance corrections and the still-pending selected64 source grade, forensic review, coordinate provenance, and explicit proceed decision.** No approval JSON or full-run start should be created from this initial review.
