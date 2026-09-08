# V43 built-probe forensic review

Scope: original-source review of `language-built-reliability-v43`, its trace, and `language-built-output-packet-v43`. Internal guards and model verdicts were treated as execution evidence rather than semantic ground truth. This is not the independent grading receipt.

## Overview

- Both writable cases retained one complete, useful record: 2/2 retention, with no retention hold or availability failure.
- Fifteen of sixteen answer combinations produced an answer. One faithful Russian draft was rejected by the deterministic attribution floor before semantic verification.
- I found no source-meaning, role, qualification, promotion, or language error in the fifteen accepted answers.
- These cases do not contain the component-measurement specialization that motivated V43. Their successful outputs therefore do not establish that the V43 specificity prompt caused or fixed that behavior.

## `v17-held-question`, run 1

The saved record faithfully preserves Ada Marlow's unanswered question about whether the Zephyr QX-100 agreement includes return delivery after repairs. It keeps the question open and states that neither coverage nor exclusion is established. It does not infer a delivery arrangement, contract answer, or exclusion.

All eight answer combinations are non-null. Each describes the recorded open question rather than attributing a new recording action to Ada, preserves return of the device after repairs, and keeps both coverage and exclusion unresolved. The Russian formulations range from natural `обратная доставка` to the awkward but intelligible `доставка возврата`; none changes the proposition. Minor agreement variation in `ни включение, ни исключение ... не установлено` does not change language identity or meaning. I found no accepted error.

## `v17-held-assistant`, run 1

The saved record faithfully preserves a tentative, preliminary, unverified assistant suggestion that servicing Zephyr QX-100 may include checking the indicator twice yearly. It retains the assistant's statement that the contract was not studied and the assumption was not verified, and it does not promote the suggestion to a verified contractual condition. `condition` remains in the contractual sense rather than becoming physical device state.

Seven answer combinations are non-null and source-faithful. They localize the generic assistant role, preserve twice-yearly frequency and indicator-check scope, and retain the tentative/unverified and no-contract-study qualifications. Phrases such as `отчёт предполагал` are stylistically awkward but do not change the reported content or reporting source.

The sole null is RU query to RU answer with explicit reports view. Generation produced:

> По предварительному и непроверенному сообщению ассистента, обслуживание Zephyr QX-100 может включать проверку индикатора дважды в год. Ассистент отметил, что не изучал договор и не проверял это предположение; это не подтверждённое договорное условие.

The draft passed the Russian language check, then failed the deterministic answer guard with `rejection_counts.attribution = 1`; no answer-verifier call followed. The construction `по ... сообщению ассистента` directly binds the report to the assistant and preserves every substantive qualification. I classify this as a false attribution hold, not a justified abstention. The trace gives the guard category but no finer internal subreason, so the exact unmatched grammatical branch is inferred from the draft and stage rather than directly reported.

## Residual implication

The only observed coverage defect is a bounded nominal Russian attribution construction containing intervening qualification adjectives: `по предварительному и непроверенному сообщению ассистента`. Any follow-up should preserve the requirement that the source label grammatically own the report; this result does not justify accepting unrelated same-clause speaker mentions or weakening semantic verification. It also does not justify changing models, adding retries, or treating successful language checks as proof of source entailment.
