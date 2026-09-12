# V59 source-clock design review

## Exact V58 reproduction

I inspected V58 selected case `v19-held-undated`, zero-based q5 (RU query, RU answer, inferred view). The exact generated block in trace row 165 is:

> **Предложение · Предварительный срок:** Ada Marlow предложила в следующем году относительно исходной записи пересмотреть исключения гарантии Zephyr QX-100, хотя календарный год установить нельзя, а “next year” относится не к сегодняшнему дню и не к моменту обработки; она заявила, что не приняла план и не организовала встречу, поэтому это осталось её предложением.

The cited retained line says the proposal is for next year relative to the original record, the calendar year cannot be recovered, the deictic is not relative to today/processing, Ada has not adopted a plan or arranged a meeting, and it remains her proposal. The draft preserves those facts and reaches language review, which returns compliant. It is then rejected under the aggregate `discourse` reason before semantic verification.

Running the exact block through the three exported frozen clock helpers isolates the failing condition:

```text
hasDeicticTime             true
hasSourceRelativeAnchor    true
hasUnknownReferenceClock   false
```

The failure is therefore `hasUnknownReferenceClock`, used by `noncanonicalMemoryStatusSupported` for a qualified unknown-precision record-relative time. It is not caused by the mixed quoted token `“next year”`, the order of `в следующем году относительно исходной записи`, tentative status, or the source anchor: the helper recognizes the deictic and anchor. The unknown-clock grammar recognizes forms such as `календарный год восстановить нельзя`, `определить нельзя`, and `невозможно восстановить`, but not the generated `календарный год установить нельзя` (“the calendar year cannot be established/determined”).

## Bounded correction

Extend only the existing Russian date/calendar-head branch of `hasUnknownReferenceClock` to recognize `установить нельзя` (and, if the implementation already handles inflected finite forms in that branch, the corresponding tightly bound form). The calendar/date head must remain before the bounded gap:

```text
(?:дат...|календарн... (?:день|месяц|год)) ... установить нельзя
```

This is a lexical addition within an already source-clock-specific construction. It should not add a generic `не установлен` or unrestricted `установить нельзя` alternative, because those would match uninstalled components, requirements, or device actions. The answer must still independently satisfy `hasDeicticTime` and `hasSourceRelativeAnchor`, and the existing full semantic verifier must remain mandatory.

## Minimum regression matrix

Positive:

- the exact V58 q5 block;
- `В следующем году относительно исходной записи, но календарный год установить нельзя.`;
- the same sentence with Russian `«следующий год»` instead of English `“next year”`, proving quote language is immaterial;
- `Календарную дату установить нельзя; следующий месяц относится к исходной записи.` if the existing date-head inflection permits it.

Negative:

- `Компонент установить нельзя; следующий год относится к исходной записи.`;
- `Двигатель установить нельзя, а запись не датирована.`;
- `Календарный год указан, но устройство установить нельзя.`;
- `Календарный год установить нельзя`, when tested as a complete answer qualification without any deictic/source-relative anchor, must still fail the cumulative answer guard even though the unknown-clock helper alone returns true;
- `Следующий год относится к моменту обработки; календарный год установить нельзя` must fail the source-anchor requirement;
- a quoted full grammatical example such as `В инструкции приведено: «календарный год установить нельзя»` must not by itself establish a live answer clock if the surrounding answer lacks the required deictic/source anchor.

## Limits and disposition

The exact evidence supports one bounded Russian unknown-clock wording addition. It does not support changing word order generally, treating English quoted deictics as foreign-language errors, weakening the cumulative source-clock floor, or bypassing semantic verification. No retry, new pass, schema change, or model change is needed.
