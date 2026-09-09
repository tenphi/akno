# V59 code review round 2

## Scope

I reviewed the final working diff from `1ab8c77` and [`benchmarks/language/v59-trial-plan.md`](../../v59-trial-plan.md). The review covered the repair request's original-index binding and compact admitted context, relation and transaction invariants, mandatory semantic verification, the new Russian unknown-clock construction, retention and answer prompt changes, receipt versions, and the migrated tests. I made no implementation edits and ran no provider calls.

## Initial finding

### P2 — the new Russian unknown-clock branch accepts arbitrary comma continuations

Initial location: [`packages/core/src/timeline/source-clock.ts`](../../../../packages/core/src/timeline/source-clock.ts), `hasUnknownReferenceClock`, new `... установить нельзя` expression.

The initial lookahead accepted any comma immediately after `установить нельзя`. That made the floor return `true` for constructions whose continuation reverses or conditionally limits the phrase rather than establishing an unknown source clock:

```text
Календарную дату установить нельзя, если пользователь не разрешит изменение.
Календарную дату установить нельзя, потому что пользователь запретил её задавать.
Календарную дату установить нельзя, но завтра администратор её задаст.
```

I reproduced all three as `true` by importing the current helper locally. With a separate deictic expression and source-relative anchor, these sentences could satisfy the deterministic clock floor while describing permission or a future setting action. The full semantic verifier remained mandatory, so this was not a direct acceptance bypass, but it removed the intended rejection guard and contradicted the trial plan's claim that longer continuations are excluded.

The bounded correction should admit sentence/semicolon/end boundaries and, if required by the actual retained form, only the complete known contrast: comma + `а` + a bounded deictic expression + `относится не к сегодняшнему дню и не к моменту обработки`, followed by a sentence/semicolon/end boundary. Quoted bare deictic phrases may be unwrapped in that exact slot; quoted full examples must stay masked. Conditional, causal, generic `но`, single-denial and further comma-tail variants must remain negative.

Status: resolved in the final reviewed tree. The generic comma delimiter was removed. The only comma continuation now accepted is the closed `а <bounded deictic> относится не к сегодняшнему дню и не к моменту обработки` contrast, itself followed by sentence/semicolon/end. The quote pass unwraps only a bare supported English deictic phrase and masks full quoted examples. Tests cover the three reproductions above, incomplete denial, conditional tail, the exact V58 record form, and answer-level positive/negative integration. My direct local recheck returned `false` for all three original reproductions, `true` for the complete contrast, and `false` for its incomplete and conditional-tail variants. I found no remaining clock-boundary defect in this scope.

## Repair transaction assessment

The repair request implements the reviewed design coherently:

- Failed positions are deduplicated and sorted in original extraction order.
- Each `repair_targets` entry carries the original zero-based index, exact `parsed.candidates[index]` draft, and only issues mapped to that same position.
- The misleading all-candidate `rejected_candidates` field is gone.
- `read_only_admitted_context` contains only original index, cleaned subject, kind and readable text. It supplies enough position-to-proposition context for relation references without exposing admitted support, frame, attribution or qualification objects as repair material.
- The system prompt explicitly distinguishes original extraction indices from target/response offsets and states that originals are not evidence and admitted context is read-only.

The enforcement path remains unchanged after the input projection. The generated and runtime transaction schemas permit only failed indices and cap the response count. Duplicate output indices invalidate the transaction. Repairs replace only their original vector positions. The deep immutable-position comparison protects admitted records, and the lost-position check catches dedupe or dependency loss. A surviving repaired record is cleaned from exact source spans and receives the exact same-index original draft as a `repair_obligation` in the mandatory full-source verifier. Relation targets continue to resolve against original batch indices.

The noncontiguous test uses targets 0 and 2 around admitted position 1, returns them in reverse order, and checks both final vector placement and same-index verifier obligations. Existing cases retain duplicate, admitted, fractional, out-of-range, empty, all-held, duplicate-proposition and valid/self/missing relation-target coverage; the new negative-index case closes the remaining output-index boundary. I found no repair selection, relation, immutability, or mandatory-verification bypass.

One low-risk test limitation remains: the relation-index test establishes valid/self/missing target behavior after repair but does not inspect the compact admitted table at the repair call. The ordinary repair test already asserts that table's exact shape and original position, so another assertion would harden future refactors rather than cover an observed runtime gap.

## Prompt and version assessment

The retention instruction keeps an explicit group-relative epistemic experiencer in generated prose without treating group membership as known. It does not alter typed epistemic basis or any verifier dimension. The answer instruction applies a source-established bilingual clarification only after the retained record selects that report, and explicitly denies query wording, language switching, lexical similarity and outside knowledge as alias authority. The existing selected-excerpt boundary and source-frame constraint therefore remain intact.

`RETAIN_PROMPT_VERSION` advances to `retain-extraction-language-v43` and `ANSWER_PROMPT_VERSION` advances to `answer-generation-v55`; verifier versions correctly remain unchanged because their contracts did not change. The benchmark expectation and changeset reflect those updates. No public schema, storage format, model, retry, pass, or output ceiling changed.

## Final disposition

Clean after the clock-boundary correction. I found no remaining blocker or correctness finding in the bounded V59 diff. The model-visible repair request is clearer but remains fallible; the unchanged structural transaction and semantic verifier are still responsible for rejecting sibling substitution or unsupported repairs.

## Validation evidence

Parent-reported checks before the clock correction were green: 2,635 tests across 143 files in `tmp/v59-suite-second.log`, plus build/typecheck, lint, knip, docs doctor/build, formatting, smoke, package and repository checks. An earlier full-suite run failed 24 stale repair-payload assertions; those fixtures were migrated and the failed log was preserved. After the correction, `tmp/v59-clock-fix.log` records 522 focused tests across two files passing. The final post-fix gate in `tmp/v59-suite-final.log` records 2,644 tests across 143 files passing; final build, lint, formatting, repository safety, smoke (8/8), and installed-package checks passed. Knip and documentation doctor/build remained green from the earlier unchanged-dependency/documentation gate. I did not independently repeat those complete checks.

## Frozen runtime

Root committed the reviewed final runtime as 1f63ecfb7ee8c94870437ba638897e0858e6adb5 after the complete local gate. Build/restart/socket redeployment completed. Provider controls and declared live evaluation are recorded separately; this code review makes no answer-quality claim.
