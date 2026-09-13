# Clock contract correction review

## Disposition

A narrowly deterministic correctness fix is warranted after the frozen integration evidence is preserved. The generator contract requires the Russian `source_clock_anchor` to make the selected interval the subject of the exact construction `отсчитывается от времени первоначальной записи без даты`. The frozen validator does not recognize that complete construction for all deictic labels it otherwise supports. This is an internal prompt/validator contradiction, and the observed four faithful Russian drafts are false local holds rather than semantic negatives.

The frozen integration run and its grades must remain unchanged. A later code correction can be verified deterministically and documented without claiming a hypothetical live-score improvement or starting another tuning loop.

## Exact mismatch

`answer-record-rendering.ts` prescribes a standalone sentence equivalent to:

```text
<selected interval> отсчитывается от времени первоначальной записи без даты.
```

The relevant closed Russian branch in `hasSourceRelativeAnchor()` accepts an asserted bare/quoted clock label followed by `отсчитывается|считается от времени`, but its bounded modifiers omit `первоначальной`, and its source-noun boundary does not allow the prescribed trailing `без даты`. `hasUndatedOriginalClock()` recognizes the phrase only for its narrower next/last week/month/year interval grammar; it does not cover bare deictic labels such as `завтра`. The observed replay therefore has deictic time and an unknown reference clock but no accepted relative anchor.

## Smallest principled fix

Add one closed source-relative-anchor alternative for the exact generated form, rather than adding `первоначальной` to the broad modifier list or globally allowing `без даты` after every source noun:

```text
<supported Russian clock label> отсчитывается от времени первоначальной записи без даты <closed clause end>
```

Reuse the existing `clockLabel`, quotation handling, affirmative clause-start requirement, and closed sentence boundary in `hasSourceRelativeAnchor()`. Keep `hasUnknownReferenceClock()` independent; the exact `без даты` phrase already supplies that dimension, but publication must continue to require all three existing checks. Do not change the generation wording, answer schema, caps, semantic verifier, retry behavior, or other inherited source-clock branches.

The arm should accept the supported labels already represented by the renderer/clock contract: bare or correctly quoted `сегодня`, `завтра`, `вчера`, and the inflected next/last/this day, week, month, and year forms. The actual period/direction still comes from the selected retained record and remains subject to full source verification. The local helper establishes only that the readable answer explicitly names the source clock.

## Required deterministic controls

Positive table tests should cover the exact standalone prescribed sentence for representative morphology across all four period classes:

- day (`завтра`, plus a next-day form if the renderer can emit it);
- week;
- month;
- year;
- bare and each currently supported quotation style for the clock label.

At least one complete `answer()` integration test should use the exact structured `translated_record` emitted by the renderer and prove that the joined text reaches the mandatory language and semantic verifier rather than stopping at the discourse guard.

Negative helper and answer controls should reject:

- `не`, `якобы`, `пример`, a question, or a conditional prefix governing the assertion;
- a whole quoted/example sentence rather than only a bare quoted clock label;
- `не отсчитывается`;
- a clock tied to processing, a meeting, inspection, or a device recording;
- `первоначальной записи устройства без даты` or another continuation after `записи` that changes the source noun;
- a comma condition, question mark, or immediate adversative/retraction after the construction;
- a missing source noun, missing `без даты`, or a changed direction/period when the structured record requires a different one;
- a fluent locally accepted draft that the semantic verifier marks unsupported, confirming the lexical arm does not bypass source comparison.

Existing positives for `исходной`, `оригинальной`, `недатированной`, source notes/conversations, explained source-entry clocks, and initial-recording English forms should remain unchanged. Existing quotation masking and `hasUnretractedClauseEnd` behavior should be reused instead of duplicated.

## Risk boundary

Adding `первоначальной` to the existing `{0,2}` modifier set and making `без даты` generally optional would admit more prose than the generator promises, including ambiguous first recordings or nearby device-recording language. An exact arm limits the change to a canonical phrase the system itself requires. It remains fallible for synonymous Russian prose, but that is acceptable for this closure: the purpose is to make prescribed output satisfiable, not expand the language recognizer generally.

This correction is suitable as a final deterministic consistency fix with a bounded test set. It should not be presented as evidence that the frozen integration would have scored differently, and it does not justify another live measurement.
