# V68 bounded Russian source-clock design review

## Exact reproduction

V67 trace row 233 generated:

```text
**Предложение · Предварительный срок:** Ada Marlow предложила в следующем месяце рассмотреть условия ремонта Zephyr QX-100 — то есть в месяце после недатированной первоначальной записи, а не после обработки; она не приняла план и не организовала встречу, и календарный месяц определить невозможно.
```

Running the current exported helpers directly on that exact text gives:

```json
{"sourceRelative":false,"unknownClock":false}
```

The first result is expected from the current grammar: `hasUndatedOriginalClock` recognizes `первоначальной записи без даты` and `недатированной первоначальной записи`, but only after an `относительно` or `отсчитывается/считается от` interval. The broad fallback recognizes `месяц после ... записи`, but its modifier family omits `первоначальной`. Neither recognizes the row's proposal-attached explanatory apposition `— то есть в месяце после ...`.

The second failure is independent. `hasUnknownReferenceClock` does not recognize the direct, closed `календарный месяц определить невозможно` form: its broad branch admits `определить нельзя` and `невозможно восстановить`, while the direct date-head branch only admits `установить нельзя`. Adding only the source-relative branch would therefore leave this faithful draft held by the separate unknown-clock requirement.

## Recommended structure

Add a private, dedicated Russian explained-source-entry helper adjacent to `hasExplainedSourceEntryClock`, rather than adding `первоначальн*` to the broad fallback. Its only positive shape should be an affirmative proposal clause followed immediately by a dash or comma explanation:

1. A bounded, source-readable actor (`I`/Russian personal pronoun or the existing conservative proper-name shape).
2. An affirmative finite proposal verb (`предлагает/предложил/предложила`) and bounded review verb (`рассмотреть/пересмотреть/проверить`) with 1–12 non-discourse object tokens.
3. A deictic interval in the proposal: `в следующем|прошлом месяце/году` or `на следующей|прошлой неделе`.
4. Horizontal whitespace, then `— то есть` or `, то есть`.
5. A matching inflected period and direction: next month/year/week must map to `в месяце/году/неделе после`; past must map to `... до`. Use one captured period/direction table or explicit alternatives so `следующем месяце` cannot be explained as `в неделе`, nor next as `до`.
6. The exact source noun phrase `недатированной первоначальной записи` (and, only if already required by exposed faithful generation, the same closed adjective pair with `исходной` or `оригинальной`). Do not admit a bare `первоначальной записи`, device record, processing record, or arbitrary note.
7. Optionally the exact contrast `, а не после обработки` for next/after (and a direction-consistent equivalent if a past form is supported), followed immediately by end, period, semicolon, or exclamation. A question mark should not close an affirmative floor.

Mask quotations before matching, preserving only a bare quoted deictic label if needed. Use a non-splicing sentinel. Anchor the proposal at a real clause start (`^` or `[.;!]`) and prohibit conditional/question/negation/reporting prefixes through the affirmative head itself. Do not search for the apposition independently: `то есть в месяце после ...` must remain attached to the proposal that contains the matching deictic interval.

This helper should contribute only to `hasSourceRelativeAnchor`. It establishes a clock relation, not that the reference date is unknown.

## Separate unknown-clock companion

The exact row also needs a narrowly direct unknown-date form. Extend the existing direct calendar-head branch, or add a sibling branch, for:

```text
календарный месяц определить невозможно
```

Require the direct `календарный (день|месяц|год)` head, the exact finite predicate pair `определить невозможно` (and `установить невозможно` only if desired), and a true sentence/clause/end boundary. Keep quotation masking. Do not add free-standing `невозможно` or `определить` to the broad regex, and do not let an intervening device/component noun or a following `если`, `но`, `якобы`, correction, or positive resolution qualify. `hasUnknownReferenceClock` must still be independently true; the new source-relative helper must not imply it merely from the word `недатированной` inside an anchoring phrase unless the current contract explicitly chooses that behavior. Keeping the two checks separate is clearer and preserves existing tests where an original-source anchor alone has an unknown-clock result determined independently.

## Minimum tests

Positive controls:

- Exact row-233 text: both helpers true.
- Same clause with comma instead of dash.
- A matching week or year form, if those forms are included in the implementation.
- Source-relative sentence without the final unknown-calendar clause: relative true, unknown false.
- Direct closed `календарный месяц определить невозможно`: unknown true by itself, relative false.

Negative source-relative controls:

- `Если Ada Marlow предложила ... — то есть ...` and `Ada Marlow не предлагала ...`.
- `Ada Marlow спросила, означает ли ...` and `якобы предложила`.
- Entire assertion inside each supported quotation style; a bare quoted `«следующий месяц»` in an otherwise affirmative sentence may be a separate explicit positive.
- Period mismatch (`в следующем месяце — то есть в неделе после ...`) and direction reversal (`следующем ... до`, `прошлом ... после`).
- `... после обработки`, `... после записи устройства`, bare `первоначальной записи`, or a source noun borrowed across a newline/semicolon.
- A second subject or finite reporting/denial verb between proposal and explanation.
- Retraction after the anchor: `..., но на самом деле после обработки` or `..., однако это неверно`.
- Question-mark ending and colon/example prefixes.

Negative unknown-clock controls:

- `календарный месяц определить возможно`, `невозможно определить состояние устройства`, and quoted/example-only unknown-date text.
- `календарный месяц определить невозможно, но затем его установили` and conditional `... невозможно, если ...`.
- A nearby calendar noun that is not the grammatical object of `определить невозможно`.

Pair at least one locally admitted draft with a mandatory semantic-negative answer/verifier test so this lexical floor cannot publish a wrong actor, object, direction, or source attachment. Preserve existing tests showing source-relative and unknown-clock predicates are independently required.

## Scope conclusion

The preferred change is two small closed grammars: proposal-bound Russian `то есть` source-entry anchoring and direct calendar-head unknowability. It should not modify the global fallback, infer aliases, weaken the semantic verifier, add a retry, or make an undated adjective alone prove both clock predicates.
