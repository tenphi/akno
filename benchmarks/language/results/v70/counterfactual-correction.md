# V70 counterfactual forensic correction

This receipt supplements, and does not overwrite, `tmp/language-v70-selected-forensic-review.md` and its preserved initial version. I re-read the original source, the final report, and the raw generation/citation calls at trace rows 91, 96, and 101. Runtime verdicts were used only to locate the stage; the source controls the meaning judgment.

## Counterfactual query 3: justified hold for a selected-record omission

Zero-based query 3 (trace generation row 91) cites **both** records:

- E1 is the counterfactual record: purchase of the optional extension would have covered fifth-year wheel-hub repair; there was no purchase; the option was unrealized and was not actual coverage.
- E2 is the rejected-decision record: Ada Marlow **declined** the extension and did not purchase it.

The draft says:

> По словам Ada Marlow, нереализованной альтернативой была покупка дополнительного продления ремонта для Zephyr QX-100: в этом контрфактическом сценарии ремонт ступицы колеса в пятом году был бы покрыт. Ada Marlow не приобрела это продление, поэтому оно не стало её фактическим покрытием.

That faithfully preserves E1. For E2 it preserves only nonpurchase and omits the separately asserted rejection/declining act. Nonpurchase does not entail rejection: a person may fail to buy without having declined an offered extension. Because this block deliberately selects and cites the complete rejected-decision record, the omission is a material selected-record disposition loss, rather than harmless presentation compression.

The local `discourse` hold is therefore justified. The counterfactual surfaces themselves pass: the draft says both `в этом контрфактическом сценарии` and `нереализованной альтернативой`. The relevant failure is the second citation's rejected-decision presentation requirement, as documented in `tmp/language-v70-clock-stage-design-review.md`: E2 requires a rejected/cancelled/not-accepted expression, while the draft supplies only `не приобрела`.

This corrects my earlier classification of query 3 as a faithful counterfactual draft falsely held by the counterfactual wording floor.

## Counterfactual queries 5 and 7: faithful false holds

Zero-based queries 5 and 7 differ materially from query 3 because each output block cites only E2 in its own call, and in those calls E2 is the counterfactual record. The rejected-decision sibling is present in the private evidence/readings but is not selected by the block.

- Query 5 (trace row 96) says the unrealized option was that buying the extension would cover fifth-year wheel-hub repair, then says Ada did not buy it and it was not actual coverage. It preserves the selected counterfactual proposition completely.
- Query 7 (trace row 101) places `приобретённое` inside `нереализованный вариант ... покрыло бы`, then explicitly says `Она его не приобрела` and that it was not active coverage. In the complete sentence, acquisition belongs to the unrealized world and is not asserted as an actual event.

Neither block selects the rejected-decision record, so neither owes an explicit `declined` clause under the current focused-answer selection policy. Their local holds remain false holds of the bounded Russian counterfactual presentation floor, subject to the unchanged mandatory source-semantic verification.

The corrected counterfactual accounting is therefore two faithful false holds (queries 5 and 7) and one justified bad-draft hold (query 3), rather than three faithful false holds. Published/non-null counts do not change.

## Undated query 3: clock failure is real; heading scope is disputed

Zero-based undated query 3 is generated at trace row 218. Its body preserves the proposal, Ada's lack of plan adoption and meeting arrangement, the next-month anchor to the original recording rather than processing, and the unknowable calendar month. The local clock rejection remains a false presentation-floor result for that body: earlier frozen replay found the source-relative-anchor predicate false while the unknown-reference-clock predicate was true.

Its heading is `**Предложение · Предварительное:**`, unlike queries 1, 5, and 7, which say `Предварительный срок`. The neuter adjective can naturally attach to `предложение`, so it may describe a preliminary proposal rather than explicitly attach tentativeness to the time. The source metadata assigns tentative status to the time, while the source prose separately establishes that this is only a proposal and not an accepted plan.

I therefore revise the blanket statement that all four Russian undated drafts are unambiguously faithful:

- queries 1, 5, and 7 explicitly preserve tentative **timing** and are faithful false holds;
- query 3 has a faithful body and a genuine false source-clock hold, but its heading creates a disputed qualification attachment. It is not a clear source contradiction because `Предварительное` can function as a compact status label in context, yet it is less precise than `Предварительный срок` and does not independently prove preservation of the typed temporal status.

This ambiguity is separate from the guard diagnosis. Fixing the clock grammar would not resolve the heading's attachment, and a heading disagreement does not justify the clock hold that rejected the otherwise complete body.

## Bounded consequence

The observed counterfactual query-3 failure does not support adding a general conditional schema. The smallest correction is citation discipline inside the existing call: either cite only the counterfactual record when it fully supports the focused answer, or, if the rejected-decision record is also selected, preserve its explicit rejection disposition. Existing source-semantic verification remains mandatory. The clock work should remain independently scoped to source-relative timing and should use an explicit temporal label when one is emitted.
