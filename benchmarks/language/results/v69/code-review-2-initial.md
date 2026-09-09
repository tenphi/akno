# V69 code review round 2 — initial

Base: `387310f`
Scope: current uncommitted V69 implementation, tests, plan, and compiled controls. Read-only; no provider or fresh held-out calls.

## Finding

### Medium — the shared immediate-retraction boundary misses two equivalent correction heads

Location: `packages/core/src/memory/clause-ending.ts`, `hasUnretractedClauseEnd`.

The new shared boundary rejects `But this is false`, `But that is false`, `And this is false`, `Но это неверно` and `И это неверно`, but it admits two natural equivalent immediate corrections because the English branch names only `this` after optional `and`, while the Russian branch permits optional `и` but not `а`:

```text
По словам Ada Marlow, в нереализованном варианте покупка дополнительного продления ремонта для Zephyr QX-100 покрыла бы ремонт ступицы колеса в пятом году. Она не приобрела это продление, поэтому речь не идёт о её действующем покрытии. А это неверно.

Ada Marlow proposes reviewing the silverpine repair terms in the month after the initial recording, not after processing. And that is false.
```

Direct current-source replay returned `true` from `hasNominalCounterfactual` for the first and `true` from `hasSourceRelativeAnchor` for the second. The neighboring `И это неверно`, `But that is false`, and `And this is false` controls returned `false`, isolating the omission.

This is within the helper's declared immediate-correction scope and affects both newly admitted floors. Add `that` beside `this` in the closed English false correction and `а` beside `и` in the closed Russian false correction. Do not broaden the helper to arbitrary adversative discourse. Add these exact negative regressions and affirmative following-sentence controls.

## Review in progress

The answer audit retains mandatory excerpt selection, exact per-record anchors, all three semantic dimensions, mismatch consistency, and strict relation/null enforcement. `excerpt_selection` is first on the verifier wire, and the new mechanism branches require separate source/answer specifics before relation. Private readings remain absent from verifier input and public output. The alias fix, source attribution flow, remaining grammar boundaries, budgets, and compiled two-frame controls are still under review.
