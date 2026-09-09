# V69 selected undated-proposal stage review

## Scope

This source-first review is limited to `v20-held-undated` in [`language-selected-v69.json`](selected-diagnostic.json) and JSONL rows 169–199 in [`language-selected-v69-trace.jsonl`](../../../../bench-results/language-selected-v69-trace.jsonl). It does not use an output-grading receipt or any fresh held-out input.

The original source at row 169 says:

- Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month;
- she has not accepted a plan or organized a meeting, and this is only her proposal;
- the initial record's date is unknown;
- “next month” means the month after that record, not after processing; and
- the calendar month cannot be established.

The retained candidate preserves Ada's proposal, action and object; the source-record rather than processing-time clock; nonacceptance, no meeting and proposal-only scope. Its typed time is scheduled/tentative with unknown precision and an undated clock. The retention verifier at row 170 returns all three semantic dimensions true with no mismatch, and row 171 places it on the existing Zephyr page. No repair was used.

## Eight answer attempts

All eight rendering-choice responses were schema-valid and all eight rendered texts passed their ModelClient language check. The four English outputs use `rendering_mode=copy`, so their public text is the canonical retained record. The four Russian outputs use the required `rendering_mode=translate` branch because copying was disabled for the configured language difference.

The table uses zero-based query indices and one-based trace rows. The clock columns are results from the frozen `hasSourceRelativeAnchor` and `hasUnknownReferenceClock` helpers on the exact materialized block.

| Query | Draft/result | Source-first assessment | Source anchor | Unknown clock | Disposition |
| --- | --- | --- | --- | --- | --- |
| 0, EN question → EN | row 174 | Exact retained copy. It preserves Ada, proposal/review/object, tentative next-month timing, undated original-record rather than processing-time anchor, nonacceptance, no meeting and proposal-only scope. | true | true | Local pass; verifier row 175 has selection and all three semantic dimensions true, no mismatch. Published. |
| 1, EN → RU | row 178: `...в следующем месяце... — относительно недатированной первоначальной записи, а не времени обработки...` | Source-faithful. It retains exact `Ada Marlow` and `Zephyr QX-100`, tentative label, proposal, review, source-relative clock, nonacceptance, no meeting and proposal-only scope. The em dash between the proposed action and `относительно`, plus the following contrast, places the clock outside the bounded accepted construction. | false | false | Report records `draft_rejected`, `discourse: 1`; no verifier call. |
| 2, EN explicit → EN | row 181 | Same exact retained copy as q0. | true | true | Local pass; verifier row 182 all true, no mismatch. Published. |
| 3, EN explicit → RU | row 185: `...относительно первоначальной записи, дата которой неизвестна, а не относительно времени обработки...` | Source-faithful and particularly clear about the source date being unknown. The relative-clause form establishes unknownness to a reader, but `относительно первоначальной записи` does not match the bounded source-anchor forms: the helper does not infer the source clock through the following `дата которой неизвестна` clause. Names, tentative proposal status and personal negative actions are intact. | false | true | `draft_rejected`, `discourse: 1`; no verifier call. |
| 4, RU question → EN | row 188 | Same exact retained copy. | true | true | Local pass; verifier row 189 all true, no mismatch. Published. |
| 5, RU → RU | row 192: `«следующий месяц» отсчитывается от недатированной первоначальной записи, а не от времени обработки` | Source-faithful. This is an explicit source-clock assertion and preserves the proposal and all personal limits. The frozen grammar recognizes nearby forms, but this exact form lacks `от времени` in the special construction and its comma contrast is not an admitted terminal for the general undated-original form. It also does not separately verbalize that the absolute calendar month is unknown, although `недатированной` preserves the underlying lack of a record date. | false | false | `draft_rejected`, `discourse: 1`; no verifier call. |
| 6, RU explicit → EN | row 195 | Same exact retained copy. | true | true | Local pass; verifier row 196 all true, no mismatch. Published. |
| 7, RU explicit → RU | row 199: `...в следующем месяце относительно недатированной первоначальной записи, а не времени обработки...` | Source-faithful. It keeps exact names, proposal/review, tentative label, record-relative rather than processing-relative timing, nonacceptance, no meeting and proposal-only scope. The comma continuation after `недатированной первоначальной записи` is outside the bounded terminal accepted by the current undated-original construction. | false | false | `draft_rejected`, `discourse: 1`; no verifier call. |

The four Russian drafts have no name failure: each preserves `Ada Marlow` and `Zephyr QX-100` byte-for-byte. They also retain a visible `Предварительный...` qualification, `предлагает`, the no-plan/no-meeting clauses and proposal-only scope. The single reported `discourse` rejection in each is the activated unknown-source-clock requirement in [`answer.ts`](../../../../packages/core/src/ops/answer.ts): both `hasSourceRelativeAnchor(answerText)` and `hasUnknownReferenceClock(answerText)` must be true. The exact helper results above locate the failure more precisely than the aggregate reason code.

The source explicitly says that the calendar month cannot be established. Rows 178, 192 and 199 convey this through an undated record rather than repeating the conclusion as a separate clause; row 185 directly says the source date is unknown. I consider all four faithful answers to the focused proposal question. Row 192 is the least explicit about the calendar consequence, but it does not invent a date, processing-time anchor, accepted plan or meeting. The local holds are conservative availability losses, not evidence of unsafe public assertions. No Russian semantic-verifier verdict exists.

## Smallest coherent correction

The evidence supports a procedural presentation instruction in the existing complete-record translation contract before another regex expansion. When translating an undated source-relative proposal, generation should express the independently checked pieces as short affirmative clauses rather than embedding them in dash apposition or a long comma chain:

1. state the actual proposer, proposed action/object and tentative relative time;
2. state that the deictic interval is counted from the time of the undated source record;
3. separately state that processing time is not the clock;
4. state that the calendar month/date remains unknown; and
5. preserve the personal nonacceptance, no-meeting and proposal-only clauses.

For example, a source-supported rendering can use the structure `Следующий месяц отсчитывается от времени первоначальной записи без даты. Отсчёт ведётся не от времени обработки. Календарный месяц неизвестен.` The frozen helpers return source-anchor=true and unknown-clock=true for those clauses. This wording is only a presentation example: generation must use the selected record's actual interval, source noun, direction, actor and limitations. It must not add an unknown date when the selected record does not establish one or convert a tentative relative time into a concrete schedule.

This belongs in `ANSWER_RECORD_RENDERING_CONTRACT`, because all four losses occur in its translate branch and the global answer contract already says to preserve both the source anchor and unknown calendar date. A renderer-local ordered procedure is more specific than repeating that semantic reminder. It also avoids making private source-frame text a new selected proposition: the readable retained record and its typed unknown/undated time already establish the proposed scope. The original frame remains a constraint on interpretation.

I do not recommend immediately admitting all four surface forms in [`source-clock.ts`](../../../../packages/core/src/timeline/source-clock.ts). Dashes and comma-relative clauses can cross a negation, condition, correction or unrelated source noun; every new form needs separate left scope, right scope, quotation and retraction proof. The current floor should continue to fail closed when generation does not produce the explicit form, and the existing semantic verifier must remain mandatory after it passes.

Meaningful invented-data tests should show:

- a complete-record Russian translation with separate proposal, source-anchor, processing-clock denial and unknown-calendar clauses reaches the existing verifier;
- changed actor, review object, interval/direction, concrete calendar date, accepted-plan status or meeting status is still rejected by the existing local/semantic checks;
- omitting either the source anchor or unknown calendar state remains a local `discourse` hold;
- exact source names remain unchanged in translated output; and
- no schema, cap, model call, retry, source-selection or verifier-gate change accompanies the presentation instruction.
