# V60 source-clock design review

## Exact V59 reproduction

I extracted the four finalized Russian-answer drafts directly from [V59 trace rows 187, 194, 201, and 208](../../../../bench-results/language-selected-v59-trace.jsonl#L187) and invoked the frozen exported helpers in `packages/core/src/timeline/source-clock.ts` with Node's type stripping. Every draft produced the same result:

```text
hasDeicticTime             true
hasSourceRelativeAnchor    false
hasUnknownReferenceClock   true
```

The common relevant wording is:

```text
«следующий год» отсчитывается от времени записи, ... календарный год восстановить нельзя
```

The failing subguard is therefore **only `hasSourceRelativeAnchor`**. The root cause is specifically the missing Russian genitive `времени` option between `от` and the source noun. The current branch permits an optional form of `момент...` or `дат...`, then `запис...`; it does not permit `времени запис...`.

Controlled substitutions confirm this:

| Phrase | Deictic | Anchor | Unknown clock |
|---|---:|---:|---:|
| `«следующий год» отсчитывается от времени записи, календарный год восстановить нельзя` | true | false | true |
| `… от момента записи …` | true | true | true |
| `… от даты записи …` | true | true | true |
| `… от записи …` | true | true | true |
| `… от времени обработки …` | true | false | true |
| `… от времени встречи …` | true | false | true |

This diagnosis is independent of the aggregate `discourse` rejection count. The four answer drafts otherwise preserve Ada Marlow as proposer, the proposed review, personal non-adoption/non-arrangement, tentative record status, and unrecoverable calendar year.

## Bounded implementation recommendation

Add a separate Russian anchor alternative for the exact grammatical shape:

```text
(counted/reckoned forms) + от + времени + [bounded source adjectives] + source noun
```

The source noun should remain mandatory and limited to the existing source vocabulary (`источник`, `запись`, `заметка`, `разговор`, with supported inflection). `времени` should not become a free synonym for the source itself. Require a boundary after the source noun: end, punctuation, or an already supported contrast/relative continuation. This prevents accepting a longer possessive/component phrase such as `от времени записи устройства` merely because it contains the token `записи`.

The new alternative should operate on quote-filtered text. It should preserve a quotation containing only the deictic expression (`«следующий год»`) while removing a quotation containing the whole alleged anchor sentence. The existing quote-preservation helper currently defines its exact deictic content pattern only in English, so the bounded implementation should add the corresponding exact Russian deictic forms for quote preservation rather than making arbitrary quoted Russian text authoritative.

Do not change `hasUnknownReferenceClock`: all four drafts already satisfy it through the separate `календарный год восстановить нельзя` wording. Do not merge the two predicates. The answer guard should continue to require deictic time, a source-relative anchor, and an unknown reference clock independently, followed by mandatory semantic verification.

## Minimum contrastive tests

Positive:

- `«Следующий год» отсчитывается от времени записи, и точный календарный год восстановить нельзя.`
- `Следующий месяц считается от времени исходной записи; дата записи неизвестна.`
- the four exact V59 drafts, asserting all three helper dimensions separately;
- isolated straight/curly/guillemet/backtick quoted deictic expression followed by an unquoted `от времени записи` anchor.

Negative anchor controls:

- `Следующий год отсчитывается от времени обработки; запись не датирована.`
- `Следующий год отсчитывается от времени встречи; запись не датирована.`
- `Следующий год отсчитывается от времени осмотра устройства; запись не датирована.`
- `Следующий год отсчитывается от времени записи устройства; календарный год неизвестен.`
- `Пример: «следующий год отсчитывается от времени записи»; календарный год неизвестен.`
- backtick, straight-quote, curly-quote, and guillemet versions of that complete quoted example;
- a clause with `времени записи` followed by an unbounded noun continuation rather than punctuation/end;
- a valid anchor paired with no unknown-clock wording, and unknown-clock wording paired with no anchor, to preserve the conjunctive caller contract.

The finite lexical floor will still not parse every Russian temporal construction or prove that an ambiguous `запись` denotes the intended source. Direct source-noun syntax, closed boundaries, private source-frame comparison, and mandatory semantic verification keep those remaining meaning decisions outside this lexical addition.
