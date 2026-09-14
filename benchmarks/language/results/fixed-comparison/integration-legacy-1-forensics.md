# Integration legacy run-1 source-first forensics

## Scope

This review covers only legacy run 1 for frozen Integration candidate D. It compares the integration packet,
final source grade, and legacy/run-1 trace with the completed Candidate A/V77 legacy run-1 packet, grade, and trace.
I did not inspect pending recent or run-2 outcomes, change a grade, run a model, or propose a runtime change.

The frozen source grades agree with the public packets:

- Integration: **76/80 useful answer coordinates**, **10/10 complete writable retained sets**, and **0 accepted errors**.
- V77: **63/80 useful**, **8/10 complete**, and **0 accepted errors**.

The net change is exactly two eight-coordinate recoveries and three additional undated losses:
`63 + 8 + 8 - 3 = 76`. The required read-only admission remains held and is outside the writable denominator.

## Alternatives: recovered at extraction and retention verification

The source asks to consider two incompatible Zephyr QX-100 service hypotheses, annual or biennial, says neither is
established, and says to keep both for discussion.

### V77 failure

At V77 trace row 350, extraction generated `Ada Marlow is discussing two incompatible hypotheses`. That changes an
invitation/retention instruction into an ongoing activity by Ada. The retention verifier at row 354 correctly returns
all three semantic booleans false. Its exact mismatch says the source proposes inclusive consideration while the
candidate assigns Ada an active discussion. Retention is empty, so all eight answer coordinates are null.

### Integration path

The integration extraction request at row 345 contains both new contracts: the semantic retrieval-unit contract and
the neutral-provenance/activity boundary. The result at row 350 is one record with:

- `commitment:hypothetical`, `disposition:active`, and affirmed embedded polarity;
- both incompatible service hypotheses;
- the statement that neither is established; and
- readable prose saying Ada **keeps** both hypotheses for discussion, rather than that she is currently discussing
  them.

The candidate uses the complete source item as support and discourse frame. No structural repair occurs. The verifier
request at row 351 contains the retrieval-unit contract and the candidate's hypothetical-scope definition. At row 354
it finds no mismatch and returns all three semantic booleans true, affirmed source-selected polarity, and a null
positive reason.

The record is written at row 363. It is then selected and rendered across all eight coordinates. The answer
generation/verifier/public sequences span rows 367–510; the packet shows that every language/view coordinate preserves
both alternatives, their incompatibility, unestablished status, and discussion scope. The source grade marks all eight
useful with no accepted error.

This is actual exercise of the new generation/verifier contract: the changed contract is in the live request, the
generated actor/activity wording follows its boundary, and the existing verifier accepts the result. It is still one
stochastic paired observation. The trace proves the stage transition and public behavior; it does not prove which
prompt sentence caused the different model output or that the behavior will recur.

## Report: recovered through the direct semantic concern path

The source says Bo Winters told Ada Marlow that the Zephyr QX-100 warranty includes temperature-sensor replacement.
Ada records his message but has not personally verified it. The required distinctions are the inner speaker, outer
recorder, reported warranty proposition, and Ada's personal nonverification.

### V77 failure

V77 extraction at row 800 produced a source-faithful candidate with those roles and limits. The local report
recognizer did not accept `has not personally verified this`. V77 invoked the specialized report-text repair at rows
803/806 and still held the result locally as `discourse_uncertain` at row 807. `model_usage.verification` is null; all
eight answers are `no_eligible_evidence`.

### Integration path

The integration extraction request at row 872 includes the new contracts. Its result at row 877 is materially the
same faithful two-sentence report:

> Bo Winters reportedly told Ada Marlow that the Zephyr QX-100 warranty includes temperature-sensor replacement.
> Ada Marlow recorded his message but has not personally verified this.

The new concern path is unambiguously exercised:

- no report-text repair call occurs between extraction and verification;
- the verifier request at row 878 has `repair_obligations:[]` and a candidate-owned
  `report_limit_concern:{kind:readable_report_uncertainty,frame_ids:[F1]}`;
- the source witness is confined to F1; and
- the current candidate text is unchanged from extraction.

At row 881, the verifier returns `report_limit_alignment:preserved` using exact source witness
`сама это ещё не проверила` and exact current witness `has not personally verified this`. It also returns all three
mandatory semantic booleans true, affirmed source-selected polarity, no mismatches, and a null positive reason. The
record is written at row 890.

All eight report coordinates then retrieve the complete record and pass generation plus answer verification at rows
894–1037. The packet preserves Bo as speaker, Ada as recorder, the temperature-sensor proposition, and Ada's personal
nonverification in both answer languages. The grade marks the set complete and all eight coordinates useful, with no
accepted source, qualification, language, or promotion error.

This stage recovery is deterministic in the orchestration: the finite recognizer is no longer final authority for
this otherwise-clean generated report, and the trace shows the owned audit admitting it through the mandatory
verifier. The verifier's semantic judgment remains model-authored; one successful audit does not establish general
report-verifier reliability.

## Undated proposal: retention remains complete, four Russian answers regress locally

The source states that Ada proposes reviewing the warranty tomorrow, the proposal is unaccepted, and no review is
scheduled. Since the source entry is undated, the retained record correctly makes tomorrow relative to the original
source entry and leaves its calendar date unknown.

Both V77 and Integration retain the complete proposition. In Integration, extraction and clock repair are at rows
687–698; retention verification at rows 699–702 accepts the repaired record; and the record is written at row 711.
The stored record preserves source-relative tomorrow and the nonacceptance/no-scheduled-review limits.

The difference occurs only during complete-record answer rendering. All four English-target coordinates copy the
complete record and pass semantic verification. All four Russian-target generation calls return the required
structured `translated_record`, but the joined text is rejected locally with `rejection_counts:{discourse:1}` before
answer verification:

| Coordinate | Generation result | Public result |
| --- | --- | --- |
| EN query, inferred planning, RU answer | rows 752–757 | row 758, `draft_rejected` |
| EN query, explicit planning, RU answer | rows 796–801 | row 802, `draft_rejected` |
| RU query, inferred planning, RU answer | rows 828–833 | row 834, `draft_rejected` |
| RU query, explicit planning, RU answer | rows 860–865 | row 866, `draft_rejected` |

Each draft preserves the proposal, tomorrow, unaccepted status, no scheduled review, an unknown original-record date,
and a standalone source-clock segment. The last also spells out that the clock is relative to the original record
rather than processing time. No Russian draft reaches answer semantic verification.

### Exact local boundary

The structured rendering instruction supplied to every Russian call explicitly requests the phrase
`отсчитывается от времени первоначальной записи без даты`. The four drafts comply, using either `Завтра` or
`Интервал «завтра»` as the subject.

A deterministic replay of the four joined candidates through the frozen source-clock helpers yields:

```text
hasDeicticTime: true
hasSourceRelativeAnchor: false
hasUnknownReferenceClock: true
```

The relevant Russian source-anchor branch accepts adjectives such as `исходной`, `оригинальной`, and
`недатированной` before `записи`, but not the instructed `первоначальной`. Other inherited branches that mention an
initial recording apply to different English or longer-period grammars. Consequently the unknown deictic record's
required source-anchor conjunction fails and the public reason is the aggregate local `discourse` rejection.

This is an instruction/recognizer mismatch in the frozen integration, not a negative source-semantic verdict. The
source grade correctly treats the four nulls as lost useful answers while leaving retention complete and counting no
accepted error.

### Comparison with V77

V77 produced three useful Russian answers and one local null. Its accepted Russian drafts used additional forms the
inherited recognizer understands, such as `относительно исходной записи` or `относительно записи-источника`, alongside
the structured clock clauses (V77 rows 668–673, 748–753, and 784–789). Its one Russian failure is at rows 716–717.

Integration consistently followed the new exact structured phrase, exposing the mismatch on all four coordinates.
This case therefore contributes four nulls instead of one, a regression of exactly three useful coordinates. No
report or retrieval-unit behavior caused this answer-stage regression.

## Accounting and causal limits

| Case | V77 useful coordinates | Integration useful coordinates | Observed stage change |
| --- | ---: | ---: | --- |
| `v3-dev-alternatives` | 0/8 | 8/8 | Unsafe extraction becomes a faithful hypothetical retrieval unit; retention verifier accepts it. |
| `v9-held-report` | 0/8 | 8/8 | Faithful report bypasses report rewrite, supplies owned report-limit witnesses, and passes mandatory verification. |
| `v3-dev-undated` | 7/8 | 4/8 | Same complete retention; all Russian renderings hit an inherited local source-anchor mismatch. |
| All other writable legacy cases | 56/56 | 56/56 | No usefulness loss or gain in the frozen grades. |

The report concern is **actually exercised and stage-effective**. The retrieval-unit and neutral-activity instructions
are also present in the alternatives extraction request, and the generated record exhibits the intended actor/activity
and scope behavior before passing verification. For the latter, the paired trace supports an observed behavioral
association but cannot identify model-internal causality.

There is no hidden availability explanation: the three cases have successful retention operations, no retention/case
availability failure, and no accepted output error. The alternatives and report gains are genuine source-graded
recoveries. The undated losses are faithful local holds caused before semantics. This audit makes no claim about
pending blocks or whether these effects repeat.
