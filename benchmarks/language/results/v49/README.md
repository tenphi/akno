# V49 frozen implementation and input review

The V49 scope follows `v49-trial-plan.md` after the complete failed V48 trial at `bc206c8`. Runtime remains GPT-5.6 Luna, with independent GPT-5.6 Sol input/output grading and separate code/forensic reviewers.

Both code review/fix rounds are complete. The first review found conjunction crossings and an unconstrained assistant suggestion clause; the fixes stop bounded phrases at coordination/subordination and require a bounded modal for the direct English suggestion construction. The second review found a nonblocking V20 gate-test matrix gap, now covered by the existing structural gate tests. Original and final notes are preserved. Root review also scoped translated coverage instructions to the source's actual covered subject, including components/damage where appropriate.

The complete local gate passed: build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed packages, repository safety, and 2,235 tests across 133 files. An initial full-suite failure correctly identified a stale benchmark prompt-version expectation; the expectation was updated and the complete suite passed. No live model output has been used as unit-test ground truth.

Fresh V20 inputs were independently approved 22/22 before execution. Their fingerprint is `8658f0d00661221cf4e042ffb78f5ed2f3c6b575ab254b81b65ded6e853ea0e9`. The development split is exposed V19 held-out content. The new held-out split has never been executed. Review approval establishes coherent inputs, not runtime success.

After commit/freeze, build/restart/socket readiness and a compiled routing/source-clock reproduction precede the selected and built-package exposed probes. Every started result and independent judgment will be preserved. No complete V49 trial has begun, and the unchanged acceptance gate has not been met. PR #70 remains open and unmerged.
