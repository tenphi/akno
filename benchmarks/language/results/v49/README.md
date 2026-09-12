# V49 frozen implementation and input review

The V49 scope follows `v49-trial-plan.md` after the complete failed V48 trial at `bc206c8`. Runtime remains GPT-5.6 Luna, with independent GPT-5.6 Sol input/output grading and separate code/forensic reviewers.

Both code review/fix rounds are complete. The first review found conjunction crossings and an unconstrained assistant suggestion clause; the fixes stop bounded phrases at coordination/subordination and require a bounded modal for the direct English suggestion construction. The second review found a nonblocking V20 gate-test matrix gap, now covered by the existing structural gate tests. Original and final notes are preserved. Root review also scoped translated coverage instructions to the source's actual covered subject, including components/damage where appropriate.

The complete local gate passed: build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed packages, repository safety, and 2,235 tests across 133 files. An initial full-suite failure correctly identified a stale benchmark prompt-version expectation; the expectation was updated and the complete suite passed. No live model output has been used as unit-test ground truth.

Fresh V20 inputs were independently approved 22/22 before execution. Their fingerprint is `8658f0d00661221cf4e042ffb78f5ed2f3c6b575ab254b81b65ded6e853ea0e9`. The development split is exposed V19 held-out content. The new held-out split has never been executed. Review approval establishes coherent inputs, not runtime success.

After commit/freeze, build/restart/socket readiness and a compiled routing/source-clock reproduction precede the selected and built-package exposed probes. Every started result and independent judgment will be preserved. No complete V49 trial has begun, and the unchanged acceptance gate has not been met. PR #70 remains open and unmerged.


## Complete exposed results

Frozen runtime `54c218f` was built and restarted successfully, with socket readiness. The compiled reproduction classified all 22 exposed queries into their intended views, preserved four factual negative controls and source-clock boundaries, and kept factual eligibility unchanged. CI `34286539997` and documentation `34286539998` passed.

| Probe | Complete useful retention | Useful retrievals | Useful answers |
| --- | --- | --- | --- |
| Selected exposed development | 5/6 | 48/48 | 41/48 |
| Built-package regressions | 2/4 | 24/32 | 23/32 |

Across both probes, 64/80 answers are independently useful, 67 are nonnull and 13 writable nulls remain coverage losses. All stored records are source-entailed. The selected report loses the independent collection denial at ownership; the built rejected-offer set loses the independent no-booked-handover proposition during validation/repair. The built report loses its entire principal report at retention verification: the source-faithful candidate is rejected because the verifier compresses away the Russian calibration target and treats the explicit bilingual relay/clarification as unsupported component identity. Its remaining self-attested collection denial is correctly ineligible for the requested report view, causing eight nulls. This is a substantial regression, not a reason to broaden factual eligibility.

Three accepted selected answers fail the unchanged semantic requirement: two Russian coverage phrases invert the repair/warranty roles, and one fictional-discussion answer identifies Ada only through neutral attribution instead of preserving her actual proposing act. The coupled hypothetical consequences and personal assistant examination/confirmation limits are preserved in the selected answers. No source bytes changed and no case availability failures occurred.

Separate forensic reviews and revisions are preserved. The selected reviewer corrected a missed proposer and count errors, and distinguished provisional-proposal wording from an uncertain claim that a proposal occurred. The built forensic reviewer flags narrative past tense as loss of current state; an independent source-only tense audit keeps those answers accepted because they narrate the same undated source context without adding an endpoint or resolution. These disagreements are explicit, and the output grader's receipt is unchanged by the tense audit. Neither a target score nor a runtime verifier's decision determines the judgment.

The complete V49 trial is deferred. Fresh, independently approved V20 held-out inputs remain unexecuted. The next revision must address the report's omitted source-span interpretation and the remaining answer-role failures before another readiness decision. Every started result remains preserved; no unchanged-runtime semantic retry or gate/model change is authorized. PR #70 remains open and unmerged.
