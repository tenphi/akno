# V77 launch/readiness harness review — initial

Independent Sol static review of `start-v77-probes.mjs`, `v77-launch-integrity.mjs`, `write-v77-readiness.mjs`, both run scripts, and post-run validation. No provider or benchmark call was made.

## Finding

### High — preflight manifest does not bind the corpus/input-review provenance it approves

`tmp/v77-launch-integrity.mjs:4-7`; `tmp/start-v77-probes.mjs:5-10`; `tmp/validate-v77-evidence.mjs:13-14`

The launch manifest hashes the frozen source/dist trees and harness scripts, but it does not hash the V77 trial plan, the V21/V20 corpus input bytes, or the approved V21 input-review artifact/fingerprint. The preflight approval is bound to that incomplete manifest. The start script hard-codes case IDs and the runners name corpus/split, but neither proves before provider calls that the corpus bytes still have the independently approved fingerprints.

`validate-v77-evidence.mjs` compares completed report fingerprints to V69 reports only after both probes have run. That is useful forensic validation but too late to protect a once-only launch: corpus drift would consume the declared provider run and only then fail validation. It also makes a historical output file the fingerprint oracle rather than binding the approved input review directly.

Required correction: include the exact trial-plan file and the exact corpus/input-review artifacts (or a canonical independently approved fingerprint receipt plus the concrete input file it authenticates) in `v77-launch-manifest.json`; have launch integrity hash and validate them before creating either launch receipt. The preflight approval then binds those hashes through the manifest. Keep held-out content unread; hashing the approved artifact is sufficient. Post-run validation should compare report fingerprints to these bound values rather than relying only on V69 output files.

## Other harness observations

- The selected and built run commands exactly implement the declared 8×8 and 4×8 development matrices, use one run, and pass the 2,400 answer overlay.
- The old unbound seed is absent. Start requires readiness, a clean tree, independent approval bound to readiness/manifest/review hashes, and absence of all result/trace/start paths.
- Launch integrity binds frozen source/dist and the runner/capture/validation scripts, creates one exclusive per-run launch receipt, and runners separately reject existing outputs/traces.
- Readiness correctly requires successful exact-SHA CI/docs, local suite, 23 compiled groups, deployment/socket, ten exact controls, and every transport's request count, usage and effective cap. It does not treat controls as competence evidence.
- Trace validation checks balanced lifecycle starts/terminals and typed failures without treating runtime verdicts as source truth.

## Disposition

**Hold semantic launch** until corpus/input-review/plan provenance is included in the pre-call launch manifest and independently re-reviewed. This does not affect approval to prepare the protocol declaration locally.
