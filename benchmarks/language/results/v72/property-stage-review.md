# V72 selected assistant property-stage review

## Scope and disposition

This is a source-first review of the completed `v20-held-assistant` stage in
[`language-selected-v72-trace.jsonl`](../../../../bench-results/language-selected-v72-trace.jsonl). I read the
invented original source, the extraction and retention decision, the eight completed answer paths, and the
frozen V72 property schema and contract in `tmp/core-v72` (local frozen snapshot). I did not inspect V72 grading, later
V72 cases, fresh held-out inputs, or private configuration, and I made no provider call or runtime edit.

The retained record preserves the source's tested property. All eight generated answer blocks also preserve
connector continuity. Seven paths pass the verifier and one exact-copy path is withheld for an unrelated
reporting-act interpretation. I find no material published tested-property error in this completed case.

The V72 property-state mechanism nevertheless does not reliably identify that property. Only two of eight
verdicts use the accurate active `preserved` state. The other six return the schema-valid all-null
`absent_from_both` state even though both their original-source anchor and actual answer anchor explicitly name
continuity. Five of those false private classifications are on accepted/publication paths. They do not make
the faithful prose erroneous, but they show that V72's new operation/property dependency does not by itself
prevent the verifier from overlooking a selected test's property.

## Source and retained record

The original assistant statement is:

> I tentatively think Zephyr QX-100 servicing might include a connector continuity test each month. I have
> neither read the service agreement nor verified that interpretation. I am describing a possible contractual
> term, not an established obligation.

The material tested property is **continuity**. `connector` identifies the tested object and `test each month`
identifies the operation and interval. The source also requires assistant attribution, tentative possibility,
the two personal limits, and possible-contractual-term rather than established-obligation scope.

Trace rows 113–116 preserve this correctly:

- row 114 extracts one qualified record whose readable text still says `connector continuity test each month`;
- row 115's retention verdict describes the same property and interval and returns all three required semantic
  booleans true with `source_selected_polarity: affirmed`;
- row 116 places it on the existing Zephyr QX-100 page; and
- there is no structural repair or retained sibling whose content could supply or obscure the property.

The resulting complete record is:

> **Reported by assistant · Tentative:** The assistant tentatively thinks Zephyr QX-100 servicing might include
> a connector continuity test each month. The assistant has neither read the service agreement nor verified
> that interpretation; this is a possible contractual term, not an established obligation.

Thus this answer stage receives an explicit property in both the original frame and readable retained record.

## Eight answer coordinates

The trace sequence is the benchmark's four language pairs repeated for inferred and explicit reports views.
Every rendering choice is schema-valid, every language check is compliant, and every draft cites only E1.

| Query | Question → answer | Trace rows | Actual tested-property wording | Property state | Result |
| ---: | --- | --- | --- | --- | --- |
| 0 | EN → EN, inferred | 117–120 | exact copied `connector continuity test` | `absent_from_both` | semantic hold |
| 1 | EN → RU, inferred | 121–124 | `проверка непрерывности соединителя` | active `continuity` → `непрерывность`, `preserved` | accepted |
| 2 | EN → EN, explicit | 125–128 | exact copied `connector continuity test` | `absent_from_both` | accepted |
| 3 | EN → RU, explicit | 129–132 | `проверка непрерывности электрической цепи разъёма` | `absent_from_both` | accepted |
| 4 | RU → EN, inferred | 133–136 | exact copied `connector continuity test` | active `connector continuity` → same, `preserved` | accepted |
| 5 | RU → RU, inferred | 137–140 | `тест непрерывности разъёма` | `absent_from_both` | accepted |
| 6 | RU → EN, explicit | 141–144 | exact copied `connector continuity test` | `absent_from_both` | accepted |
| 7 | RU → RU, explicit | 145–148 | `тест непрерывности разъёма` | `absent_from_both` | accepted |

Here “accepted” means the completed trace has a guard-passing block, a schema-valid verifier result, all three
semantic booleans true, and no negative alignment or mismatch. The run-wide report had not yet been written
while this bounded stage review was performed, so final report serialization remains outside this artifact.

### Property-faithfulness judgments

- The four EN copies at queries 0, 2, 4, and 6 reproduce the current retained property byte for byte.
- Query 1's `проверка непрерывности соединителя` and queries 5 and 7's `тест непрерывности разъёма` are natural
  Russian renderings of a connector continuity test. They retain the property, connector object, and test.
- Query 3 retains continuity and the connector. `электрической цепи` makes the ordinarily electrical sense of
  connector continuity explicit. It is a slightly more explanatory translation, but it does not replace
  continuity with generic integrity or another tested property. On this source I do not classify it as a
  material property error.

All blocks also retain monthly frequency, tentative possibility, assistant attribution, both personal limits,
and the possible-term/not-established-obligation distinction. None turns the tentative report into an actual
service requirement or device condition.

### Inaccurate private absence decisions

Rows 120, 128, 132, 140, 144, and 148 all return:

```json
{
  "source_anchor": null,
  "answer_anchor": null,
  "source_property": null,
  "answer_property": null,
  "relation": "absent_from_both"
}
```

That assertion is false on the supplied bytes. In each row, original anchor `E1_9742d9039aa6_1` says
`connector continuity test`; the corresponding answer anchor says either that exact phrase or an explicit
Russian `непрерывност...` counterpart. The object/operation descriptions in the same verdict often name a
`continuity test` as well, making the internal classification conflict especially visible. For example:

- row 128 calls the operation a `monthly continuity test` while declaring no property on either side;
- row 132 says `monthly connector continuity test` / `ежемесячная проверка непрерывности цепи разъёма` and then
  declares the property absent;
- row 140 says `monthly connector continuity test` / `ежемесячный тест непрерывности разъёма` and likewise
  declares it absent; and
- rows 144 and 148 repeat the same contradiction for exact-copy and RU translation paths.

Rows 124 and 136 demonstrate the intended active shape on the same evidence. Row 124 anchors both sides and
compares `continuity` with `непрерывность`; row 136 compares `connector continuity` with the exact EN copy.

The false absence decisions do not alter the public text. They are fallible verifier output, not source
authority. Because these particular answers retain the property, the five accepted false-absence verdicts
are audit defects and latent enforcement risk rather than five published semantic errors.

### Query 0's unrelated hold

Row 120 sets `proposition_supported` and `action_arguments_preserved` false because the exact copied retained
record expresses `this is a possible contractual term` instead of repeating the original frame's first-person
act `I am describing ...`. This is not a property hold: its property is visibly preserved despite the same
false `absent_from_both` classification.

The block is an exact copy of the complete current retained record. The verifier's mismatch demands an outer
describing act that the retained record itself does not select as an action. The frozen alignment contract says
complete-record rendering requires the entire retained record rather than every independent proposition in
the private frame. On that contract and this focused question, I regard row 120 as a semantic false hold of an
otherwise source-faithful answer, not a correct property rejection. It produces no published error, but loses
one writable answer.

## What V72 changed and what this evidence establishes

The frozen schema correctly makes the old all-null `not_selected` property branch available only when the
containing operation is also `not_selected`. None of these eight verdicts uses that escape. For a selected
ordinary operation, however, the schema permits all-null `absent_from_both`. The prompt explicitly limits that
state to cases where neither side specifies a tested property and forbids it when either does.

The six false decisions are therefore not a parser or wire-shape bug. They are schema-valid violations of the
semantic instruction by the verifier model. The source/answer anchors and property text were available, and
the two accurate verdicts show the active branch was transport-valid. V72 closes the V71 structural
`not_selected` inconsistency but does not make source-property presence independently enforceable.

This case alone does not support a safe deterministic grammar for finding technical properties across
languages. Looking for `test`, `continuity`, `непрерывность`, or similar vocabulary would be a domain dictionary
and would mishandle ordinary actions, unnamed properties, and future languages. Treating private
`record_readings` or a newly generated source-property flag as authority would merely move the same fallible
decision earlier. Exact-substring validation helps active source descriptions but cannot prove that an
all-null absence claim is true.

## Bounded recommendation

Do not change runtime during the frozen V72 evaluation on this stage evidence. Record that property enforcement
remains model-semantic and that this case supplies no accepted property loss to validate a correction against.
The immediate source-faithful outcome is seven property-preserving accepted paths plus one unrelated false hold.

If final V72 evidence contains an accepted property loss, the next declared design should address source-side
property presence inside the existing verifier call rather than add another synonym warning. A defensible
candidate is a source-first property subdecision ordered before answer comparison, with a `specified` branch
requiring an immutable source anchor and a short source-wording property phrase, followed by the existing
answer relation. The `unspecified` branch would still be a fallible semantic assertion; it cannot be made proof
without an authoritative property annotation or a second independent judgment. Any such design must therefore
be evaluated as improved evidence elicitation, not deterministic enforcement, and must preserve negative
verdicts, anchor ownership, the 160-character aggregate allowance, current model/pass counts, and strict
fail-closed decoding.

Meaningful controls for that future design would include:

- the same explicit source test with exact-copy, faithful translation, generalized-property, omitted-property,
  changed-property, and answer-added-property variants;
- ordinary selected actions that genuinely name no tested property, to keep a usable `unspecified` path;
- properties expressed as compounds, relational phrases, and clauses longer than the current short label;
- attempts to mark an explicit source property absent while operation specifics repeat it;
- active property descriptions whose text is foreign to the cited source anchor;
- semantic-negative integration proving that an omitted/generalized/changed property remains unpublished with
  no retry; and
- the exact provided/automatic and unframed paths, which should remain outside any new model work.

Local schema controls can establish strict shapes, anchor ownership, and fail-closed behavior. They cannot show
that the model recognizes every property. Final V72 source-first evidence should determine whether this latent
risk joins a concrete accepted loss and warrants that separately reviewed change.
