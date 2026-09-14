# V40 code review, round 2

Reviewed the current runtime diff from `b39693a`, the corrected booking-boundary tests, V19 gate registration, and `benchmarks/language/v40-trial-plan.md`. I did not review the fresh corpus contents or authorize execution.

## Disposition

No actionable blocker remains in the reviewed boundary.

The round-one booking finding is fixed. The negative-subject tail now stops at coordination/subordination markers and a bounded set of finite predicates. The new cases demonstrate that `although`, `while`, `whereas`, `because`, and an intervening `confirms` predicate cannot let an earlier negative appointment exempt a later affirmative handover. The original valid forms, including `No appointment with Ada Marlow has been booked`, `No handover of the silverpine device has been booked`, and clause-local reported denial, remain exempt from an invented temporal envelope. A separate schedule in another punctuated or coordinated clause remains detected.

This helper is deliberately a conservative finite lexical screen rather than a general English parser. Unrecognized syntax can still produce a false hold, while every structurally admitted generated candidate remains subject to the mandatory three-dimension semantic verifier. The correction does not relax polarity, agency, temporal, or entailment verification.

The V19 registration preserves the V2 independent-review schema, zero accepted source-entailment errors, the 90% per-run answer threshold, existing retention/retrieval and availability thresholds, and the frozen scenario/dimension integrity checks. The CLI and runtime dispatch include V19 without changing historical corpus policies. The trial plan accurately labels selected and built runs as exposed diagnostics, requires independent grading, retains the unchanged gate/model/no-retry conditions, and reserves the independently approved fresh V19 held-out split for a justified full run.

The root agent reported the full local matrix running after this correction. I inspected the changed code, regressions, registration, and plan; I did not independently rerun the full suite.
