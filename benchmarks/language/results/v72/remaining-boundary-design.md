# V72 remaining-boundary design review

## Scope and disposition

This review is limited to the two faithful local answer holds already exposed in frozen V71:

- selected `v20-held-counterfactual`, zero-based query 1, EN question to RU answer, inferred discussion view; and
- selected `v20-held-undated`, zero-based query 1, EN question to RU answer, inferred planning view.

I did not inspect V72 outputs or fresh held-out data, call a provider, or edit runtime code. The relevant V72 clock and counterfactual helpers are unchanged from `tmp/core-v71` (local frozen snapshot).

Both V71 drafts are materially source-faithful and are withheld by deterministic discourse-presence floors before semantic verification. Two narrow grammar corrections are defensible for a separately declared revision after V72 evidence is complete:

1. recognize a standalone affirmative Russian source-clock restatement whose explicit deictic interval means the matching interval after/before an identified original recording; and
2. recognize an affirmative Russian nominal counterfactual introduced with a colon only when the same bounded construction contains an infinitive antecedent and a subjunctive consequence.

Neither correction should infer semantics from a generated field name, resolve `Этот интервал`, expand a citation, manufacture prose, or bypass full-source verification. The clock correction is the stronger and smaller of the two because the exact answer already contains a complete non-anaphoric source relation. The counterfactual correction is also structurally supportable, but its grammar should remain conservative and can be deferred independently if V72 evidence does not justify both.

## Counterfactual query 1

### Original and retained meaning

The invented source says Ada Marlow declined and did not purchase an optional repair extension for Zephyr QX-100. It separately says that, had she purchased the extension, wheel-hub repair in the fifth year would have been covered; no purchase occurred, so this is an unrealized alternative rather than current coverage.

The retained set contains both propositions. The answer's cited E1 record is complete for the focused counterfactual:

> **Counterfactual:** In Ada Marlow's counterfactual, purchasing the repair extension for Zephyr QX-100 would have covered wheel-hub repair in the fifth year. Ada Marlow did not purchase it; this was an unrealized option, not her current coverage.

### Exact V71 draft and hold

The generation call is trace row 53 in [`language-selected-v71-trace.jsonl`](../../../../bench-results/language-selected-v71-trace.jsonl). It cites E1 and returns:

> Ada Marlow описала нереализованный вариант: приобрести дополнительное покрытие ремонта для Zephyr QX-100, при котором ремонт ступицы колеса был бы покрыт в пятом году. Она его не приобрела, поэтому это не было её действующим покрытием.

The wording is somewhat heavy, but it preserves Ada Marlow, the unrealized acquisition antecedent, Zephyr QX-100, wheel-hub repair, the fifth-year restriction, the subjunctive coverage consequence, nonpurchase, and absence of current coverage. It does not assert that the extension was purchased or that coverage exists. The language check at row 52 returns `compliant: true`.

The final report records `draft_rejected`, `passed_guards: 0`, no verifier result, and `rejection_counts: { discourse: 1 }`. Deterministic replay against frozen V71 gives:

```text
hasNominalCounterfactual(draft) = false
explicit counterfactual surface check = false
```

The explicit check accepts `counterfactual`, `would have`, `had ... then`, `контрфактическ`, or `если бы`; none appears. The nominal helper accepts several complete Russian forms and a comma-relative `нереализованный вариант, при котором ... бы` form. It does not accept the draft's affirmative colon introduction:

```text
описала нереализованный вариант:
  приобрести <object>,
  при котором <consequence> был бы <result>
```

The colon split prevents the existing noun and subjunctive consequence from being considered as one bounded construction. This is the sole evidenced local cause. No semantic verifier evaluated the draft.

### Bounded counterfactual correction

Add one new shape before the helper's colon-based clause splitting. It should require all of the following in one affirmative unit:

- a sentence/semicolon/exclamation clause start;
- a bounded explicit actor followed by `описал/описала/описали`;
- exact `нереализованный вариант:`;
- a bounded Russian infinitive antecedent and its object;
- `, при котором` followed by a bounded consequence containing the subjunctive particle `бы`; and
- an unretracted sentence end checked through the existing shared clause-ending helper.

The infinitive may be recognized morphologically rather than through a repair/product verb dictionary. The helper is only checking whether the generated prose visibly expresses counterfactual scope; actor, action, object, consequence, nonpurchase, current-coverage status, and source equivalence remain mandatory semantic questions. Do not accept `нереализованный вариант:` alone, an independent later `бы`, or a relative clause across punctuation, quotation, another finite actor, or a conjunction boundary.

This is a nearby grammatical completion of the existing nominal-counterfactual contract, not a synonym list. It also leaves the safer generation form—an explicit `если бы` antecedent—fully supported. Adding the existing complete-record `если бы` presentation instruction to ordinary multi-record generation could reduce occurrences, but prompt compliance would not correct the deterministic false hold or prove semantics.

Required invented controls:

- positive: the exact colon/infinitive/`при котором ... был бы` structure, with pronoun and invented full-name actor variants;
- negative: `реализованный` instead of `нереализованный`;
- negative: indicative `был покрыт` or future `будет покрыт` without `бы`;
- negative: a bare colon option with no bound consequence;
- negative: `Пример:`, `якобы`, a question, a denial, or a condition governing the whole construction;
- negative: the entire construction inside each supported quote family;
- negative: a period, semicolon, quotation, conjunction, or second finite actor between the antecedent and consequence;
- negative: an immediate `но это неверно`, allegation, or question suffix;
- integration: correct source/draft reaches the existing verifier, while changed purchaser, extension, repair object, fifth-year limit, nonpurchase, or current-coverage status receives a semantic-negative verdict and remains held with no retry.

These tests establish the local boundary and mandatory gate only. Positive stubs do not establish that a live verifier understands every nominal counterfactual.

## Undated-source-clock query 1

### Original, retained unit, and structured generation

The source says Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month. She has not accepted a plan or organized a meeting; it is only her proposal. The initial recording date is unknown. “Next month” means the month after that recording rather than after processing, and the calendar month cannot be established.

The single retained record preserves that complete meaning and activates complete-record source-clock translation because its readable bytes independently pass all three frozen conditions:

```text
hasDeicticTime(retained) = true
hasSourceRelativeAnchor(retained) = true
hasUnknownReferenceClock(retained) = true
```

Trace row 179 records a valid structured rendering choice. Rows 180–181 show a successful RU language check and generation result. The three generated segments materialize to:

> Ada Marlow предложила в следующем месяце рассмотреть условия ремонта Zephyr QX-100. Она не приняла план и не организовала встречу; это только её предложение. Этот интервал отсчитывается от времени первоначальной записи без даты. «Следующий месяц» означает месяц после первоначальной записи, а не после обработки. Какой это календарный месяц, установить невозможно.

The first segment preserves actor, proposal, review object, interval, nonacceptance, no meeting, and proposal-only scope. The second uses the anaphoric subject `Этот интервал` rather than the required explicit interval. The third then independently and explicitly states the correct relation and unknown calendar limit.

The report records the same local `discourse` hold: one generated block, zero guard-passing blocks, and no verifier call. Frozen replay gives:

```text
hasDeicticTime(materialized draft) = true
hasSourceRelativeAnchor(materialized draft) = false
hasUnknownReferenceClock(materialized draft) = true
```

`Этот интервал` correctly fails the source-anchor helper because it is unbound anaphora. That behavior should remain. The failure does not require accepting it: the following visible clause already states, without anaphora, that the quoted interval “next month” means the month after the original recording, not after processing.

The structured field name `source_clock_anchor` is not semantic authority. Conversely, `remaining_clock_qualifications` is not disqualified source material after materialization: it becomes ordinary public answer text, is covered by the complete-record selection, and must be assessed from its bytes. The existing local gate already checks the joined block rather than trusting individual field names. A new source-relation grammar can therefore recognize the explicit later clause while continuing to reject the anaphoric field.

### Bounded clock correction

Extend the Russian explained-source-entry clock helper with a standalone meaning-statement alternative. Reuse its quotation handling so only a bare quoted deictic label is unwrapped; an entire quoted sentence remains masked. Enumerate matching interval/direction pairs structurally, for example:

```text
«Следующий месяц» означает месяц после первоначальной записи,
а не после обработки.
```

The rule should require:

- an affirmative sentence/semicolon/exclamation clause start, excluding colon-introduced examples;
- an explicit supported Russian deictic interval as grammatical subject, optionally enclosed in a supported quote pair;
- `означает`;
- the same period noun and the direction required by the deictic (`следующий` → `после`, `прошлый` → `до`);
- a directly attached source noun qualified as original/initial/undated, including `первоначальная запись`;
- only the closed matching processing-time contrast when present; and
- an unretracted end.

This rule establishes only the source-relative relation. The independent `hasUnknownReferenceClock` requirement must remain true for activated unknown-clock records, as it is in the V71 draft. Do not require the meaning clause itself to restate unknownness, and do not infer an unknown clock from `означает` alone.

This is safer than adding `Этот интервал`, `он`, or other anaphora to the clock subject. It is also safer than inserting `первоначальн...` into a broad fallback without clause and quotation controls. The new form names the interval, direction, and source record directly and can use the existing quote masking and unretracted-end machinery.

Required invented controls:

- positive: quoted and unquoted `следующий месяц → месяц после первоначальной записи`, with the closed processing contrast;
- positive: structurally matching next/last day, week, month, and year forms only where their gender and direction agree;
- negative: `Этот интервал`, `он`, or another unsupported pronoun as subject;
- negative: next month described as a year, or as before the recording; last month described as after it;
- negative: a device recording or another object's record following the source noun;
- negative: `Если`, `не`, `якобы`, a question/report prefix, or `Пример:` before the relation;
- negative: the whole assertion quoted, while retaining a positive for only the bare quoted clock label;
- negative: an intervening clause, arbitrary comma continuation, immediate reversal, allegation, or question suffix;
- helper independence: the relation clause alone makes only `hasSourceRelativeAnchor` true; an unknown-date clause alone makes only `hasUnknownReferenceClock` true; the faithful complete draft makes both true;
- integration: wrong period/direction, actor/action/object, processing relation, accepted-plan/meeting status, or invented date still reaches and fails the appropriate existing local or semantic gate; no second call or retry occurs.

## Authority and lifecycle constraints

Neither proposed helper reads private `record_readings`, source-frame prose, temporal metadata, the question, configuration, or a schema field name as evidence. Activation remains exactly where it is: the selected readable retained record must itself have deictic time, a source-relative anchor, and an unknown reference clock. The answer must then express the required surface scope, pass exact names and language checks, and pass the unchanged complete-frame semantic verifier.

Both additions are rejection-floor grammar only. They do not make a claim source-true, add a citation, expand selected evidence, or convert a malformed/negative verifier result into an acceptance. Existing response schemas, public APIs, block and token caps, models, calls, repair/retry behavior, and semantic thresholds can remain unchanged.

## Recommendation

If completed V72 evidence still shows these losses, implement the standalone explicit clock relation first. It uses meaning already present in the public answer and avoids the unsafe anaphora that caused the structured field to fail. The colon nominal-counterfactual form is also a defensible bounded addition because the draft binds an unrealized antecedent to a same-unit subjunctive consequence; keep it as a separate grammar and test surface so it can be accepted or deferred independently.

Do not add broad `Этот интервал` resolution, a server-authored source-clock sentence, a component/coverage dictionary, a generic `нереализованный` exemption, or another semantic pass. A later live frozen evaluation must measure whether either grammar improves useful availability without accepted semantic errors; local tests can prove only boundaries and fail-closed dataflow.
