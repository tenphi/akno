# V69 code review round 1

Base: `387310f`
Scope: current uncommitted V69 runtime/tests/plan, including the internal answer-verifier shape change. Read-only; no provider or fresh held-out calls.

## Findings

### Medium — single-token “names” are not source-bound and admit ordinary sentence subjects

Location: `packages/core/src/memory/report-uncertainty.ts`, `name` and the new relay continuation.

The change lowers the proper-name shape from 2–4 words to 1–4 words for every use of `name`. That fixes `Ada` and `Bo’s`, but it does not establish that the token is a person reference supplied by the candidate's validated source. Any unexcluded titlecase word at clause start or before possessive `account` is accepted. Direct current-source reproduction:

```text
hasReportUncertainty("Record has not read the agreement or independently checked Bo’s account and only passes on that meaning.")    // true
hasReportUncertainty("Device has not read the agreement or independently checked Bo’s account and only passes on that meaning.")    // true
hasReportUncertainty("Agreement has not read the agreement or independently checked Bo’s account and only passes on that meaning.") // true
```

These are nonsensical epistemic actors, but that is exactly why a generic capitalized-token rule should not satisfy a personal-agent presence floor. Mandatory semantic verification reduces publication risk; it does not restore the helper's stated personal/source-bound precondition.

Pass the validated candidate attribution names (outer `source_speaker` and named chain speakers) into the helper and derive a short reference only from those exact supplied names. Require the short form to be a Unicode-bound standalone occurrence and unambiguous among supplied people. This supports `Ada` and possessive `Bo’s` without turning arbitrary titlecase nouns into names. If the helper signature must remain text-only, keep the existing multiword name branch and add the one-token form only to a much narrower explicitly enumerated source-backed alias parameter; a larger stop-word list is not a stable fix.

Tests should include the three reproductions, an unrelated supplied short name, two supplied people sharing a first token, and exact short outer/possessive-inner positives with straight and curly apostrophes. Retain the current pronoun, reflexive, quote, object-switch, and retraction controls.

### Medium — new counterfactual and clock branches accept a following sentence that retracts them

Locations: `packages/core/src/memory/counterfactual-wording.ts`, `hasCompleteRussianCounterfactualUnit`; `packages/core/src/timeline/source-clock.ts`, `hasInitialRecordingClock`.

Both new branches accept a period as their terminal without inspecting an immediately following bounded correction. The tests cover comma and semicolon retractions but miss the sentence form. Current direct reproductions both return true:

```text
По словам Ada Marlow, в нереализованном варианте покупка дополнительного продления ремонта для Zephyr QX-100 покрыла бы ремонт ступицы колеса в пятом году. Она не приобрела это продление, поэтому речь не идёт о её действующем покрытии. Но это неверно.

Ada Marlow proposes reviewing the silverpine repair terms in the month after the initial recording, not after processing. But this is false.
```

This is within the stated retraction boundary for the new floors. Use a shared bounded terminal lookahead for these branches that rejects an immediately following sentence/semicolon correction head (`but/however/actually/this is false`; Russian `но/однако/на самом деле/это неверно`), including capitalization and horizontal/newline spacing. It need not parse arbitrary later discourse. Add both exact reproductions and affirmative next-sentence controls that do not retract the proposition.

The semantic verifier remains mandatory for actor, object, repair, year, clock direction, and actual-world status. Fixing the local terminal does not add semantic authority.

## Other reviewed boundaries

The complete Russian counterfactual unit is otherwise appropriately closed: quotation masking, affirmative unit start, unrealized acquisition, conditional coverage morphology, explicit nonpurchase, and no-active-coverage closure are all required. The four V68 Russian drafts are covered. Changed objects or actors can still pass this presence floor, as documented, but remain subject to the full semantic verifier.

The English initial-recording branch requires an affirmative proposer/review head, a bounded object span, matched period/direction, the exact initial-recording phrase, and a processing contrast. It independently supplies only the relative predicate; unknownness still comes from `hasUnknownReferenceClock`. The new repair diagnostic correctly distinguishes relative-false/unknown-true, relative-true/unknown-false, and both-false without changing the typed hold. Repair guidance should continue to prohibit adding causal links such as V68 candidate 170's `because` unless the source actually supplies them.

The answer-verifier schema keeps all existing semantic booleans, excerpt selection, relations, anchors, and negative enforcement. `excerpt_selection` now precedes `source_alignments` on the wire. Only object/mechanism prose changes from one 160-character `detail` to independently required `source_specifics` and `answer_specifics` capped at 80 each. All four strict `anyOf` branches enforce the intended coordinate/null combinations; changed/generalized/omitted remain non-publishable through `answerAlignmentsSupported`. There is no legacy-detail fallback.

The new private reading and alignment instructions improve selected-record authority: they read the retained excerpt first, use the full frame only to constrain that selected proposition, and explicitly disallow using a shared private frame to add a sibling proposal. Private readings remain absent from the verifier and public output. The separate wording fields add JSON-key overhead even though prose allowance remains 160 characters; the unchanged 2,400-token live ceiling therefore still needs the declared provider transport controls and exposed availability accounting. This is a finite cost risk, not a schema relaxation.

Prompt version changes and the 64+32 exposed plan are consistent. Public schemas, models, output caps, model-pass count, one-repair limit, semantic-retry prohibition, and release thresholds remain unchanged.

Round-one disposition: the two bounded local-floor findings should be fixed before freeze. Neither requires a general parser, new pass, retry, model, threshold, or semantic relaxation.
