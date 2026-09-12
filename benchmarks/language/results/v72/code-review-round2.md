# V72 independent code review round 2

## Final disposition

No production blocker remains in the reviewed diff against `1e6f79d`.

The property-state implementation closes the exact V71 structural escape: a selected operation can no longer pair with an all-null `tested_property.relation = not_selected`. The new `absent_from_both` branch gives selected ordinary operations a strict no-property representation without adding prose or weakening any negative property decision. The report helper admits literal `personally` only as the final predicate in the existing bounded shared-negative list, and every admitted generated candidate still reaches the unchanged mandatory full-source semantic verifier.

This review does not establish model competence. In particular, a verifier can still falsely choose `absent_from_both` for a property-bearing source or falsely call two active property descriptions equivalent. The provider-visible dependency makes the V71 inconsistent response unrepresentable; it does not deterministically parse technical meaning.

## Property-state review

The new entry union in `packages/core/src/ops/answer-source-audit.ts` has three coherent provider-visible branches:

1. `object_and_operation` is `not_selected` and `tested_property` is the all-null `not_selected` shape.
2. `object_and_operation` is selected or omitted and `tested_property` uses a present, omitted, or answer-added active comparison.
3. `object_and_operation` is selected or omitted and `tested_property` is the all-null `absent_from_both` shape.

This directly prevents the V71 row-134 combination of a preserved operation with a property marked unselected. Both source-anchored and wholly incidental operation `not_selected` variants remain available. Selected operations with no measured property remain representable, so ordinary plans, bookings, reports, and other actions are not forced to invent a test property.

The acceptance path preserves the intended polarity of every decision. `answerAlignmentsSupported` accepts:

- `preserved` for selected categories;
- `not_selected` only through the schema branch coupled to an unselected operation; and
- `absent_from_both` only when the iterated part is that entry's tested-property object.

`generalized`, `changed`, and `omitted` remain rejecting. Foreign source/answer anchors remain rejecting. The enclosing exact evidence-ID set, excerpt selection, semantic-verdict consistency, and all three semantic booleans remain mandatory in `ops/answer.ts`.

The response prose allowance is unchanged:

- an active property comparison uses 50 source + 50 answer operation characters and 30 source + 30 answer property characters;
- a selected no-property operation uses 80 + 80 operation characters and no property prose; and
- an unselected operation uses at most its existing one-sided 80-character description.

No public operation schema, answer text limit, model, caller ceiling, pass count, repair path, or retry behavior changes. Only the private verifier schema and prompt version advance to answer verifier v46.

The tests meaningfully cover schema and enforcement rather than claiming semantic reliability. They check every selected/unselected operation pairing with `not_selected` and `absent_from_both`, the active property null/anchor shapes, generalized/changed/omitted rejection, semantic-negative rejection of an otherwise valid absence shape, the exact property-unselected malformed combination, mixed evidence IDs, strict provider `anyOf` structure, field order, enum transport, caps, and inherited malformed/foreign/truncated verdict behavior.

## Report-uncertainty review

`packages/core/src/memory/report-uncertainty.ts` factors the existing personal-check predicate and adds only:

```text
personally + checked|confirmed|verified + bounded report-meaning/contractual-term object
```

That form is reachable only as the third member of the existing comma-separated list after one recognized subject and shared `has|have|had not`, for example:

> She has not read the agreement, independently checked Bo Winters's account, or personally verified this meaning.

It does not introduce an arbitrary-adverb slot. The existing actor table, attribution-bound short-name handling, full-name bounds, report-object vocabulary, clause-head requirement, horizontal-whitespace rule, quotation masking, conditional/question/denial exclusions, and bounded continuation/end logic remain in force. The new form cannot insert another auxiliary or actor between `or` and `personally`, change the object to a device, or use unrelated adverbs and verbs. Named actors do not require inferred gender because `personally` is invariant; reflexive forms keep their existing gender-bound alternatives.

The source and candidate remain independent inputs to the cleaner. Local recognition only establishes that readable candidate prose contains a bounded uncertainty form when a source report has an uncertainty limit. It does not establish that the actor, report object, or later discourse matches the original. `runRetain` still submits the complete source bytes, support/frame, and generated candidate to the existing semantic verifier after cleaning, with at most the existing single structural repair and no semantic retry.

Tests cover the motivating grammar with pronoun, full-name, short-name, first-person, plural, and assistant subjects; allowed check verbs/objects; wrong negation, auxiliary, actor, object, verb, adverb and incomplete predicate; quote families; conditional/question/denial prefixes; horizontal newline separation; immediate retractions; source/candidate asymmetry; the one repair position; and semantic rejection for wrong actor, wrong report object, a personal claim derived from only generic source uncertainty, source retraction, and candidate-added retraction.

## Initial semicolon concern and corrected disposition

During review I reproduced this helper result:

```text
true  She has not read the agreement, independently checked Bo Winters's account,
      or personally verified this meaning; she later verified this meaning.
```

The same result holds with `; then she verified ...`, a named actor, or `; nevertheless ...`. My initial recommendation was to stop treating a semicolon followed by arbitrary prose as the right edge of the bounded clause.

That recommendation was too broad for V72. A replay of baseline `1e6f79d` shows the pre-existing reflexive arm already accepts the equivalent shape before a later semicolon clause, and it also accepts a later retraction after a period. The helper is an admission floor for a recognizable local clause, not a whole-discourse truth parser. Removing semicolon closure would newly hold faithful candidate records whose next independent clause follows a semicolon, while leaving period-separated retractions to mandatory semantics. This is therefore an inherited finite-grammar limitation rather than a regression introduced by `personally`.

The final tree keeps runtime grammar unchanged and adds the appropriate bounded control: both a retracted original source and a candidate-added retraction, with and without structural repair, reach the semantic verifier and must receive a negative verdict and remain held at verification. These stub controls prove the mandatory gate and no-retry behavior. They do not prove that a live model will always recognize every retraction. No helper expansion is warranted from the exposed V71 failure.

## Validation reviewed

I ran the affected test files after the retraction controls were added:

```text
packages/core/src/write/retain-report-uncertainty.test.ts
packages/core/src/ops/answer-source-audit.test.ts
packages/core/src/ops/answer.test.ts

3 files passed; 797 tests passed.
```

Root's final current-tree receipts report:

- 3,410 tests across 146 files passed;
- typecheck, lint, formatting, and repository safety reran successfully after the final test additions;
- knip and documentation doctor passed;
- all seventeen compiled control groups passed on the unchanged runtime implementation.

The earlier reported full suite was 3,406 tests before four retraction matrix cases were added. No implementation changed between those receipts.

## Residual limits

- `absent_from_both` is a fallible semantic assertion. The schema cannot prove that a source lacks a property.
- The 30-character active property fields remain concise model descriptions rather than deterministically verified exact anchor substrings. V72 does not claim otherwise.
- The report grammar intentionally recognizes a finite local clause. Less common paraphrases can still be held for one structural repair, and later discourse remains the semantic verifier's responsibility.
- Positive stub verdicts demonstrate schema/dataflow behavior only. The declared frozen probes and independent source-first grading are still required to assess model reliability.
