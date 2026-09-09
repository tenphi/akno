# V67 independent code review — round 2

## Result

No unresolved production blocker remains in the current V67 diff against `101a047`.

The review initially found three deterministic scope admissions in the new bounded lexical floors: the English source-entry clock could borrow a negated or questioned proposition, the English nominal-counterfactual branch could borrow both left and right assertion scope, and the new checked-account report list could borrow a negative list from a denial, question, or false proposition. All three findings are preserved below. The current tree closes them with affirmative clause heads, closed grammar, quotation masking, and bounded right ends. Direct rechecks and the final test suite pass.

The remaining semantic work stays with the existing complete-source verifier. None of these floors establishes source truth, actor identity, antecedent/consequence equivalence, tested-property equivalence, or a report's epistemic scope. V67 adds no model call, retry, acceptance path, output field, enum, null branch, cap, or threshold.

## Findings and resolutions

### P1 — resolved: source-entry clock borrowed non-affirmative left scope

The first version of `hasExplainedSourceEntryClock` recognized a nearby `next/last ... means/is/refers to ... source entry` relation without constraining how that relation was asserted. It returned `true` for invented controls such as:

```text
Ada Marlow denied that next month means the month after her undated source entry.
The note does not say next month means the month after her undated source entry.
It is false that next month means the month after her undated source entry.
Ada Marlow asked: next month means the month after her undated source entry;
```

That was a local false admission: it could let a generated clock reach semantic verification even though the candidate did not affirm the clock relation.

Resolved in `packages/core/src/timeline/source-clock.ts` around lines 140–165. Direct `means/is/refers to` statements now start at input or after `.`, `;`, or `!`. The observed comma-`meaning` construction is a separate closed alternative after a bounded named/pronoun `proposes/proposed reviewing/checking ...` clause. The two alternatives are compiled separately, so their period backreferences cannot be satisfied vacuously by a different alternative. Complete quotations are masked; only a bare quoted deictic label remains usable. The source entry, matching interval, direction, optional processing contrast, and final delimiter are all local to the match.

The exact negative examples above now return `false`. Standalone affirmative statements and both V66 initial/repair source-entry drafts return `true`; unknown-calendar-date support remains a separate mandatory predicate.

### P1 — resolved: English nominal counterfactual borrowed assertion scope

The first English branch searched colon-split fragments and did not require an affirmative introduction. It returned `true` for:

```text
This was not an unrealized option in which purchasing the extension would have covered repair.
Ada Marlow denied an unrealized option in which purchasing the extension would have covered repair.
It was allegedly an unrealized option in which purchasing the extension would have covered repair.
The note asks whether this was an unrealized option in which purchasing the extension would have covered repair.
Example: an unrealized option in which purchasing the extension would have covered repair.
The note rejects this: an unrealized option in which purchasing the extension would have covered repair.
```

After the left edge was corrected, review found a second edge: the regexp stopped after the first consequence word and accepted `..., but this was false.`.

Resolved in `packages/core/src/memory/counterfactual-wording.ts` lines 3–28. The English branch now inspects the whole unquoted text, begins at an affirmative sentence/semicolon clause, and accepts only the closed bare/article, `This is/was`, or named/pronoun `described/describes/outlined/outlines` introductions. Its proper-name component is case-sensitive, preventing ordinary lowercase adverbs from becoming name words. It consumes a bounded relative phrase and a bounded consequence through end, `.`, `;`, or `!`; coordinating/reporting predicates and punctuation cannot be used to bridge a retraction. It no longer treats a colon as a fresh affirmative scope.

The tests now reject the examples above plus `falsely described`, comma retraction, trailing `allegedly`, question-ending, quotation, overlong, new-actor, and broken-relative cases. The exact English V66 counterfactual and the expanded Russian relative remain positive. This helper still proves only that bounded nominal counterfactual wording is present; the full verifier must establish the antecedent, consequence, actual nonpurchase, coverage object, and actual-world restriction.

### P1 — resolved: checked-account uncertainty borrowed a denial or question

The new checked-account wording is outside the legacy `REPORT_UNCERTAINTY` lexemes. Its initial closed-list grammar nevertheless lacked an affirmative clause head and admitted:

```text
Ada Marlow denied she has not read the agreement or independently checked this account.
It is false that Ada Marlow has not read the agreement or independently checked this account.
Ada Marlow asked whether she has not read the agreement or independently checked this account.
```

Resolved in `packages/core/src/memory/report-uncertainty.ts` lines 5–48. The new branch begins at input or after `.`, `;`, or `!`, with only the closed optional `The report says/states [that]` prefix. It requires one bounded actor, a negative auxiliary, an examination object, and one of the explicit check-list forms. A repeated auxiliary must repeat `not`; a new actor, wrong object, newline, arbitrary continuation, or retraction cannot inherit the negative. Complete quotations are replaced by a non-splicing sentinel.

The denied/false/question controls now return `false`; the two V66 report forms and direct/report-prefixed affirmative controls return `true`. The older broad uncertainty vocabulary remains unchanged. Natural coordination outside the enumerated forms can still fail closed and defer to the verifier/repair path; V67 does not claim a general English scope parser.

### P3 — resolved: release note initially omitted the V67 behavior

The early working tree did not describe V67's published behavior in a changeset. The existing PR changeset is now amended rather than duplicated. `.changeset/knowledge-language-discourse.md` records bounded report-check lists, source-entry time explanations, affirmative counterfactuals, tested-property comparison, and the subordinate status of private translation notes.

## Final contract review

### Source authority and mandatory gates

The lexical helpers remain presence floors used before the existing complete-source semantic verdict. A `true` result only avoids an early local hold. It never accepts a candidate or answer on its own. Source/frame bytes, attribution, language, qualification, selection, actor/action arguments, and final semantic checks remain mandatory. Quoted content is masked before the new grammars; the new branches neither expand a frame nor synthesize a source actor.

`hasReportUncertainty` is now shared by retention and answer cleaning, avoiding divergent grammar between the two paths. The new checked-object branch restricts `checked` to report/account/claim objects and does not equate checking a report with receiving confirmation or personally confirming a condition. Proper-name reflexives are intentionally permissive about gender at this floor; any actual actor/predicate mismatch remains verifier work.

The counterfactual helper remains shared across the discussion and retained-record paths. The Russian token allowance grows only inside the existing bounded relative clause, with a character lookahead and clause/quotation stops. An explicit integration negative confirms that a broader claim such as having no active coverage at all is still withheld by mandatory semantics even when the surface counterfactual floor passes.

### Generation and verification prompts

The retention prompts now separate the asserted outer activity (`discussing`) from the commitment of embedded unsupported hypotheses. They explicitly keep `discussing` distinct from private `considering`; candidate metadata cannot repair a changed activity.

For one-record translation, the existing private reading is used as a terse output-language plan for operation, object, tested property, coverage roles, modifiers, and ordinary compound vocabulary. The final answer verifier does not receive those readings. Immutable original-frame and answer anchors remain its evidence. A visible translated report heading is instructed to use the existing per-record `report_source_display_phrase`; this is a generation hint, not a mechanical prepend, attribution relaxation, or new authority. It cannot replace an inner speaker or add an unretained reporting act.

The source audit now requires the detail to state source and answer properties separately before deciding their relation. It explicitly distinguishes a tested object from its measured property and rejects generic integrity as a substitute for a specified electrical property. `answerAlignmentsSupported` still accepts only `preserved` or `not_selected`; `generalized`, `changed`, malformed anchors, and omitted selected material remain withholding outcomes. The new EN/RU integration exercises this rejection with exact original and answer anchors while confirming private readings are absent from verification.

### Schema and provider compatibility

All three strict alignment union branches now serialize existing `detail` before existing `relation`. Their fields, required sets, enum values, null combinations, strictness, lengths, and acceptance semantics do not change. Local JSON parsing is order-insensitive; constrained generation receives the compare-before-verdict order. The schema remains an ordinary `anyOf` union without a discriminator, `oneOf`, or `const`. Tests inspect endpoint property order and preserve the valid selected, omitted/null, and not-selected/null shapes.

Retention and answer versions advance consistently to generation/verifier `v50/v33` and `v62/v42`; benchmark expectations match. The trial plan keeps Luna runtime, Sol review, the explicit 2,400-token isolated trial ceiling, the untouched 1,024-token service overlay, existing calls/retries/gates, declared diagnostics, and the stop condition before the unexecuted approved V21 held-out corpus.

## Verification reviewed

After the final scope fixes:

- Independent focused run: 377 tests across the counterfactual, source-clock, retention-report-uncertainty, and answer-source-audit files passed.
- Focused right-boundary run: 543 tests across two files passed.
- Final full suite: 2,966 tests in 144 files passed.
- Final build/typecheck, lint, format check, and repository safety passed.
- Compiled bounded prefreeze controls report affirmative report, clock, and counterfactual boundaries, the counterfactual right edge, both V66 report drafts, both source-entry drafts, EN/RU counterfactual forms, unchanged alignment shapes, original obligation/source authority, mandatory full-source verification, and zero added semantic passes.
- Knip, docs doctor/build, smoke (8/8), and installed-package smoke passed after the three principal scope fixes; their dependency/docs/packaging state was unchanged by the final counterfactual right-edge edit.

These checks establish deterministic boundaries, schema transport shape, and gate wiring. They do not establish that a free-text model will reliably follow the new translation, activity, heading, or property-comparison guidance. The declared exposed diagnostics remain necessary before any decision to execute fresh V21 held-out inputs.

## Practical limits

- The three helpers recognize deliberately finite English/Russian constructions. Other faithful wording can fail closed and require the existing repair or semantic path.
- Soft line wraps and unenumerated coordination are not treated as proof of a new clause or shared scope.
- The legacy broad uncertainty vocabulary is outside this change and remains as before.
- The report-heading and terminology improvements are prompt instructions, not deterministic semantic guarantees.

Within those limits, the current V67 diff is coherent, preserves source authority and fail-closed behavior, and is ready to freeze for the declared diagnostics.
