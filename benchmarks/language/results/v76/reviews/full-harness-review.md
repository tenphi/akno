# V76 conditional full-trial harness review — final

The initial review and finding remain preserved in `tmp/language-v76-full-harness-review-initial.md`. I reviewed only the corrected conditional plan and launch-integrity path. I did not prepare a full manifest, inspect held-out contents, execute a provider or benchmark call, or create a launch approval.

## Finding resolution

The diagnostic-readiness blocker is resolved.

The plan now states the evidence accurately: the original ten-control suite remains 9/10 exact with one preserved failure, while a separately declared same-schema/count/field-length/cap natural repair amendment passed. It requires reporting eleven logical controls, ten fulfilled requirements, seventeen endpoint requests, and one original failure. It no longer represents the amendment as an unchanged retry or rewrites the original result as passing.

`tmp/v76-full-launch-integrity.mjs` now loads and validates the final readiness receipt before either manifest preparation or a launch check. It requires:

- exact frozen runtime and launch-manifest identity;
- all local gates, 3,790 tests across 151 files;
- 21 passing compiled groups;
- exact-runtime successful CI and documentation CI;
- successful build/restart/socket deployment;
- deep equality between the readiness-embedded and separately preserved original and amendment receipts;
- original `passed:false`, exactly nine successful exact results, and only `four-branch-retention-repair` as the failed original control;
- amendment provider success, schema validity, deep exactness, and `passed:true`;
- exact accounting of 11 logical controls, 10 fulfilled requirements, one preserved original failure, and 17 endpoint requests;
- every amendment artifact hash recorded by readiness.

The future full manifest's file map now directly hashes `tmp/v76-postdeploy-check.json`, `tmp/v76-protocol-results.json`, and `tmp/v76-natural-repair-result.json`, in addition to the selected baseline, blind-input metadata, frozen runners, validator, trace checker, plan, and benchmark instrumentation. Manifest reconstruction and deep equality therefore prevent any of those receipts or their interpretation from changing after approval.

The existing approval chain remains intact: a later independent approval must bind the final manifest, explicit proceed decision, and completed 96-observation exposed provenance hashes. The durable global start marker and per-split receipts then bind that approval and refuse replacement outputs.

## Disposition

**The corrected conditional full-trial harness is clean.** The original readiness/protocol finding is closed, and the previously reviewed four-cell matrix, source/dist and input-review provenance, fixed models/caps, once-only start behavior, lifecycle validation, and per-cell evaluation boundary remain sound.

No full manifest, proceed decision, approval, or start marker exists yet. Final manifest preparation and inspection must wait for the completed selected probe evidence, source-only grading, separate forensics, provenance, and an explicit proceed decision. This review is not launch approval.
