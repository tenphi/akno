# V77 independent Sol code review — round 1 final

Read-only re-review against `1d63519`, preserving the initial report at `tmp/language-v77-round1-review-initial.md`. I inspected the current helper, integration and corrected tests, and ran `git diff --check`. I made no runtime edit, provider call, or held-out-data access.

## Resolution of initial findings

### Resolved — conditional and uncertain prefixes

The fictional-case introduction now excludes the bounded `If/Unless/Suppose/Perhaps/Maybe/Example/Not` and Russian counterparts at the only anchored name start. The introduction expression remains anchored to the complete sentence, so it cannot restart at `Ada Marlow` after one of those prefix tokens. The exact `If` and `Perhaps` helper negatives now pass. The same restriction does not broaden ordinary proper-name recognition.

### Resolved — following retraction

The helper examines every later segmented sentence in the selected target item for the bounded retraction vocabulary, rather than assuming one particular adjacent sentence shape. The mixed English-support/Russian-correction regression now returns no witness. Complete quotations remain masked before this scan, and the affirmative-follow-on counterfactual tests elsewhere preserve the intended existential semantic-floor behavior.

This is deliberately item-local. A correction in a later source item does not become hidden authority for this candidate-owned witness; attachment outside the candidate's exact frame remains the mandatory source verifier's responsibility. That is consistent with the stated no-sibling/no-paragraph authority boundary.

### Resolved — focused test failures

The tests now assert only public cleaner outcomes. The answer positive-mode expectation also includes the new valid path. `tmp/v77-focused-corrected.log` records 1,000/1,000 passing tests across five files, and `git diff --check` is clean.

## Final scope assessment

- The identity witness remains generated-only, rejection-only, source-order aware, and candidate-owned through exact support/frame spans. Ambiguous introductions return no witness. Missing identity enters the existing one-repair path; repaired content still undergoes full vector cleaning and mandatory original-source semantics. No page or ownership authority is synthesized.
- The purchase-relative counterfactual grammar remains a closed, complete two-sentence unit with a named actor, agreeing adjacent pronoun, actual nonpurchase and inactive-coverage closure. Quote, scope, punctuation, retraction and semantic-negative controls remain intact.
- Actor/qualification diagnostic prose keeps the local 160-UTF-16-unit acceptance contract while exposing `maxLength:80` to provider decoding. All relation/null/anchor and publication gates are unchanged.
- Models, caps, call count, retry behavior and public schemas are unchanged within the reviewed diff.

## Disposition

**Round 1 clean after fixes.** The two initial production findings and the test-only failures are resolved. I found no remaining concrete blocker in the bounded V77 scope. This is a code/test assessment; transport and model behavior still require their separately declared controls.
