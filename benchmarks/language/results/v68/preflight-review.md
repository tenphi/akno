# V68 preflight review

Reviewed frozen runtime `c60460d7f8f14020135454059996d632fff6fd46`, the V68 plan and preserved reviews, local/deployment logs, exact exposed replay, four protocol receipts, the source-build and built-package harnesses, instrumentation, grading-packet preparation, readiness writer, and probe-start guard. This was read-only. I made no provider call and inspected no held-out input or output.

## Disposition

No harness mismatch, threshold relaxation, or silent replacement-run path is evident. The declared exposed matrix is consistently 96 observations: one V21 development run over eight named `v20-held-*` cases (64), and one V20 development run over four named `v19-held-*` cases (32). Both use the declared 2,400-token answer override. The plan retains the existing full-trial gates and explicitly leaves the service's separate 1,024-token overlay unvalidated.

The probe-start guard copies that exact matrix from the preserved V67 start receipt, changes only the frozen runtime, timestamp, and V68 plan reference, and refuses to proceed if a V68 start receipt, either final report, or either trace already exists. It also requires a clean checkout, exact readiness/runtime equality, and this preflight note. This prevents an unnoticed replacement run. The script writes the start receipt before external probe processes are launched; a launch failure would therefore remain visible and block an unchanged-runtime retry rather than silently replacing evidence. It is a guard/receipt writer, not itself the process launcher, so the eventual receipt and process logs must still demonstrate that both declared commands were started once.

## Completed evidence

- `HEAD`, `tmp/v68-frozen-runtime.txt`, all three live-control receipts, and both GitHub runs examined point to the same full commit `c60460d7f8f14020135454059996d632fff6fd46`. The working tree was clean during this review, and tracked core source matches the frozen commit.
- Final local logs report 3,055 tests in 144 files plus successful build/typecheck, lint, knip, formatting, repository safety, documentation doctor/build, smoke, and installed-package smoke.
- Redeployment records all three required states: built, `dev.akno` restarted, and socket up. The `tmp/core-v68` compiled snapshot exists, and all 14 named postdeployment control groups emit result records.
- The four actual-provider protocol controls completed once: two rendering controls, one translation-only control, and one two-candidate retention-verifier control. Their receipts bind the frozen commit and report `ok`, schema validity, and exact echo equality. They exercise strict transport/schema shapes and negative semantic/alignment branches; they make no model-competence or corpus-quality claim and add no semantic retry.
- The preserved exposed replay reads the exact V67 trace row 233 and shows the V68 compiled clock helpers independently require both source-relative anchoring and unknown-calendar evidence. Removing the calendar predicate leaves the relative result true and unknown result false. The receipt explicitly disclaims semantic competence.
- Source-build instrumentation wraps the source `ModelClient`; built-package instrumentation wraps the compiled client. Both preserve the original call and only append rendering-choice, operation-result, and language-check trace records. Packet preparation is create-only and maps completed report rows back to the approved invented input sets. The review/adjudication script preserves the existing core gate implementation rather than defining alternate thresholds.

The prefreeze manifest hashes match the sampled current artifacts, including the two harnesses, instrumentation scripts, replay script, and final round-one review. Its scope is correctly labeled prefreeze; it does not purport to attest later deployment/control/readiness artifacts.

## Pending at review time

- Documentation CI run `34365762147` is complete and successful at the frozen SHA.
- CI run `34365762181` is still `in_progress` at that same SHA. Consequently `tmp/v68-postdeploy-check.json` and `tmp/v68-probes-started.json` do not yet exist, and no V68 report or trace should be started.
- `tmp/write-v68-readiness.mjs` fails closed until both CI jobs succeed, the checkout is clean, the frozen runtime matches, deployment/local evidence is present, and all four protocol receipts validate. It creates the readiness receipt only if none exists.

Preflight is clean for the declared 64+32 exposed matrix once CI `34365762181` succeeds and the readiness writer completes. Until then readiness is pending, not complete. Fresh V21 held-out execution remains prohibited by the plan and is not evidenced here.
