# V70 undated-source-clock stage forensic and design review

This review is limited to `v20-held-undated` in the finalized selected V70 report, source-only packet,
and trace. It is a read-only stage analysis and possible next-revision design, not a V71 authorization or
semantic reliability result. I made no code changes or provider calls and did not inspect fresh held-out
inputs or grading receipts.

Evidence:

- original and retained/public packet:
  [`tmp/language-selected-output-packet-v70.json`](../v70/language-selected-output-packet-v70.json), case
  `v20-held-undated`;
- typed case results:
  [`bench-results/language-selected-v70.json`](../v70/selected-diagnostic.json), case
  `v20-held-undated`, query indices 0–7;
- generation stages:
  [`bench-results/language-selected-v70-trace.jsonl`](../../../../bench-results/language-selected-v70-trace.jsonl),
  rows 205–232, especially Russian coordinates 209–211, 216–218, 223–225, and 230–232.

## Source and retained unit

The original source says Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month. She has
not accepted a plan or organized a meeting; it remains only her proposal. The source separately establishes
that the initial record’s date is unknown, “next month” means the month after that record rather than after
processing, and the calendar month cannot be determined.

The single retained unit preserves the complete proposition:

> **Proposal · Tentative:** Ada Marlow proposes reviewing the Zephyr QX-100 repair terms next month, but
> has not accepted a plan or organized a meeting; this is only her proposal. “Next month” means the month
> after the original recording, not after processing, and its calendar month cannot be determined because
> the recording date is unknown.

Its metadata is `kind: plan`, `commitment: asserted`, `disposition: proposed`, `polarity: affirmed`, with
tentative scheduled time, unknown precision, `clock_relation: undated`, and `actionable: false`. That
correctly distinguishes occurrence of Ada’s proposal from acceptance, a meeting, or a resolved calendar
schedule. Retrieval returns this same complete record for all eight coordinates.

All four English-answer coordinates are published after local and semantic verification. All four Russian
coordinates generate one block but publish no answer: query indices 1, 3, 5, and 7 each report
`draft_rejected`, `passed_guards: 0`, `verified_blocks: null`, and `rejection_counts: { discourse: 1 }`.
There is no availability degradation and no answer-verifier call for those four drafts.

## Complete-record rendering was active

Rows 209, 216, 223, and 230 each contain `complete_record_rendering` for E1 with the full retained text and
`copy_allowed: false`. Their evidence includes the exact current record, qualification metadata,
`named_source_reference` for Ada Marlow, localized display labels, and the complete original source frame.
Rows 211, 218, 225, and 232 return `rendering_mode: translate`, E1 only, and a complete translated block.

The frozen call path appends `ANSWER_RECORD_RENDERING_CONTRACT` whenever this structured input is present.
Therefore the V70 literal guidance—use a separate clause whose interval is the subject of
`отсчитывается от времени первоначальной записи без даты`—was supplied to every one of these model calls.
The trace records the user payload rather than the system-prompt bytes, but its complete-rendering field and
the frozen `answerMessages` path establish that the contract was active.

The model did not use that clause in any Russian block. All four instead say a variant of:

> «Следующий месяц» означает месяц после первоначальной записи, а не после обработки … поскольку дата
> записи неизвестна.

The private `record_readings` in all four calls correctly identify the month as after the original recording,
not processing, with an unknown recording/calendar date. Thus the exposed evidence shows correct private
planning followed by a different natural public construction. It does not establish why the model chose
that construction.

## Per-coordinate drafts

### Query 1, EN question → RU answer — rows 209–211

The draft says Ada proposes reviewing the repair terms in the next month; she has not accepted a plan or
organized a meeting, and it is only her proposal. It then anchors next month after the initial recording,
not processing, and says its calendar month cannot be determined because the recording date is unknown.
The label is the explicit temporal form `Предварительный срок`. Names are preserved byte-for-byte. This is
source-faithful; the placement of `в следующем месяце` before the infinitive remains a normal reading of the
review’s time rather than a concrete new date.

### Query 3, EN question → RU answer, explicit view — rows 216–218

The body preserves the same actor, action, object, proposal-only/nonacceptance limits, source-relative clock,
processing contrast, and calendar unknownness. Its label is `Предложение · Предварительное`, an awkward
neuter adjective that can read as “preliminary proposal” rather than the supplied “preliminary timing.” This
creates a real scope ambiguity about whether tentativeness qualifies the proposal or its time. It did not
cause publication—the block was already held locally—and it does not add a date or change Ada’s action.

### Query 5, RU question → RU answer — rows 223–225

This repeats the first faithful rendering with `Предварительный срок`, exact names, the correct review
object, both personal denials, the source-record/processing distinction, and unknown calendar month.

### Query 7, RU question → RU answer, explicit view — rows 230–232

This is likewise faithful. Its only wording difference is `невозможно установить` rather than
`невозможно определить`; the source itself uses `установить невозможно`, so it preserves the original
unknownness predicate.

All four language-check rows (210, 217, 224, and 231) return `compliant: true`. No name, actor, object,
proposal status, processing contrast, or calendar value is lost in queries 1, 5, or 7. Query 3 has the label
scope ambiguity described above, but the common rejection mechanism is independent of that label.

## Exact local hold

An initial surface reading suggested the final “recording date is unknown” clause might be the missing
unknown-clock signal. Deterministic replay corrects that hypothesis:

| Text | `hasDeicticTime` | `hasSourceRelativeAnchor` | `hasUnknownReferenceClock` |
| --- | ---: | ---: | ---: |
| retained English unit | true | true | true |
| RU query 1 draft | true | **false** | true |
| RU query 3 draft | true | **false** | true |
| RU query 5 draft | true | **false** | true |
| RU query 7 draft | true | **false** | true |
| V70 instructed separate-clause construction | true | true | true |

The retained line therefore activates the source-clock obligation in `noncanonicalMemoryStatusSupported`.
Each answer has deictic time and independently recognizable calendar unknownness, but lacks a locally
recognized source-relative anchor. The natural phrase `месяц после первоначальной записи` is semantically
correct for this source, yet the general fallback does not recognize `первоначальной` in that construction;
the V70-specific recognized use of that word is the unused
`отсчитывается от времени первоначальной записи без даты` form.

The conjunction at `answer.ts` therefore evaluates false and `validateDraft` rejects the block as
`discourse` before semantic verification. This is a local presentation false hold for queries 1, 5, and 7,
and the same local false hold masks query 3’s separate label-scope ambiguity. It is not a language failure,
schema failure, actor failure, or semantic-verifier rejection.

## Smallest bounded next correction

Another global prose reminder is weak evidence: V70 supplied the exact construction, and every private
reading understood the source clock, yet all four public texts chose the same unrecognized natural wording.
I also do not recommend admitting `первоначальной` or adding more Russian clock synonyms to the local regex.
That would expand a safety grammar based on one fluent paraphrase and would need new negation, quotation,
question, and retraction boundaries.

The smallest coherent stronger experiment is a **conditional internal structured translation arm** for an
already activated single-record complete rendering:

```ts
{
  rendering_mode: 'translate',
  translated_record: {
    proposition_and_nontemporal_scope: string,
    source_clock_anchor: string,
    remaining_clock_qualifications: string
  },
  evidence_ids: ['E1']
}
```

Activate this arm only when all of the current trusted conditions already hold: one qualified current
retained record, complete-record rendering, Russian output, unknown temporal precision, and the **readable
retained text itself** passes deictic-time, source-relative-anchor, and unknown-clock checks. Do not activate
from private frame prose, metadata alone, the query, or configuration.

The system contract should require:

- `proposition_and_nontemporal_scope` to translate the complete actor/action/object and all nonclock limits,
  including nonacceptance, no meeting, and proposal-only status;
- `source_clock_anchor` to be one short standalone clause using the already documented recognized
  construction, with the actual selected relative interval as subject;
- `remaining_clock_qualifications` to translate every remaining selected clock restriction, including a
  processing contrast or calendar unknownness only when present in the current retained record.

The server should only concatenate the model-returned fields in that order. It should not manufacture a
date, time unit, direction, predicate, name, or qualification, and should not replace names or silently
rewrite natural text. The materialized block must remain within the current text/token cap, pass the existing
ModelClient language check as one complete string, and then pass the unchanged name, personal-action,
source-clock, discourse, excerpt-selection, anchor, and full semantic verifier gates. Missing/empty/malformed
fields fail closed with no legacy fallback, retry, or repair. Returning no block remains allowed when the
record does not answer.

This changes only the private same-call answer schema for the narrowly activated branch. It adds no model
pass, public field, semantic retry, source authority, dictionary, regex synonym, or output ceiling. It does
not guarantee model competence: a bad `source_clock_anchor` still fails the same local floor, while a wrong
period/direction must fail full source verification. Its purpose is to make the required presentation an
explicit output responsibility rather than distant prose that can be absorbed into a compound sentence.

A less invasive record-local `presentation_requirement` in the input would still be prompt-only and offers
little additional evidence over V70. A server-generated singleton Russian sentence would more reliably pass
the floor but would require the server to select a time unit/direction or insert semantic prose; that creates
the source-free assertion risk this change is meant to avoid. I therefore prefer model-returned structured
segments with unchanged downstream enforcement.

## Counterfactual boundary check

This clock recommendation should not be generalized to the selected counterfactual query 3 merely because
that coordinate also reports a local `discourse` rejection. At trace rows 90–91, its generated block says
`в этом контрфактическом сценарии`; it therefore satisfies both the discussion-view surface requirement
(`сценари`) and the typed counterfactual requirement (`контрфактическ`). The missing condition is attached
to the block's **second citation**. The block cites E1, the counterfactual record, and E2, the rejected-decision
record. `proseStatusSupported` requires every cited non-answer-eligible prose view to remain visible. E2's
history view requires a bounded rejected/cancelled/not-accepted expression, while the block says only that
Ada `не приобрела это продление`. That preserves nonpurchase but does not satisfy the cited rejected-decision
presentation floor. The block is consequently rejected as `discourse` before the semantic verifier.

That result supplies no evidence for adding counterfactual fields to the proposed clock structure. A
counterfactual correction should instead preserve citation discipline: cite only the complete counterfactual
record when it fully supports the focused answer, or, when also selecting the rejected-decision record,
state its rejection disposition explicitly and let the unchanged semantic verifier check the relationship.
Explicit conditional-clause presentation may improve clarity, but it would not correct this observed q3
failure because the conditional and counterfactual scenario were already present.

## Meaningful controls

1. Replay all four actual V70 Russian drafts and confirm the common `anchor=false`, `unknown=true` result.
2. Use the exact separate-clause form from the contract and show all three clock helpers true, then require
   the existing semantic verifier to accept the correct actor, next-month direction, nonacceptance,
   no-meeting, proposal-only, processing, and unknown-calendar scope.
3. Change month to year, after to before, Ada to another actor, or repair terms to another object; local
   presentation may pass, but full source semantics must withhold each draft.
4. Omit either personal denial, proposal-only status, processing contrast, or calendar unknownness and require
   the existing relevant local/semantic gate to hold it.
5. Supply the query-3 ambiguous `Предварительное` label and a correctly scoped `Предварительный срок`
   contrast; ensure label scope remains independently reviewed rather than treated as repaired by the clock
   segment.
6. Verify exact Ada Marlow and Zephyr QX-100 spellings; transliteration remains a language/name hold.
7. Confirm an ordinary dated plan, unknown precision without a readable source anchor, unframed evidence,
   multiple records, and English output stay on their existing schemas.
8. Verify empty blocks, missing fields, extra fields, invalid IDs, over-cap materialized text, truncation, and
   trailing JSON fail closed without another model call.
9. Inspect Chat and Responses emitted schemas and run only the declared frozen provider transport control;
   stub echoes establish schema/enforcement behavior, not semantic reliability.

## Disposition

V70 retained and retrieved the complete undated proposal. Three Russian drafts are materially faithful and
one has an additional tentative-label scope ambiguity. All four were withheld by the same unrecognized
source-anchor presentation before verification, despite receiving complete-record rendering and the exact
new instruction. The bounded next step is to make that source-clock presentation a conditional structured
part of the existing translation response while keeping final text generation model-owned and every current
guard mandatory. Broadening the clock lexicon is not justified by this evidence.
