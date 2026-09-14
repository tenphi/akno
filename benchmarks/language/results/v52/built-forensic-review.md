# V52 built-package forensic audit

## Scope

This is an independent evidence/cause audit of the frozen V52 built run at `7658928`. I read only:

- `tmp/language-built-output-packet-v52.json`;
- `bench-results/language-built-reliability-v52.json`;
- `bench-results/language-built-reliability-v52-trace.jsonl`.

I did not inspect an independent grading receipt, contact a grader, run a model, retry an operation, or change runtime code.

## Run-level accounting

All four cases completed retention without a typed degradation, routing hold, placement failure or byte change. Seven generated candidates were proposed and all seven were written: report 2, question 2, rejected offer 2, alternatives 1. The run retrieved the intended qualified record for every query. Placement is therefore not a cause of any null.

The result reports 26 nonnull answers out of 32 and no answer-operation or case-level availability failures. The six nulls are content/validation outcomes from successful model calls:

| Case | Retained | Nonnull | Null mechanism |
| --- | ---: | ---: | --- |
| `v18-held-report` | 2 | 4/8 | four generation `empty_draft` responses |
| `v18-held-question` | 2 | 7/8 | one semantic-verifier rejection |
| `v18-held-rejected` | 2 | 8/8 | none |
| `v18-held-alternatives` | 1 | 7/8 | one deterministic `draft_rejected/discourse` hold before semantic verification |

These are production/nonproduction counts, not independent usefulness grades. Coordinates in the result are case starts 167, 801, 1461 and 2119; null reasons occur at 295/355/415/475, 1193 and 2293. The packet cases start at lines 6, 287, 568 and 849. Trace coordinates below are one-based JSONL rows.

## `v18-held-report`

### Retention is complete and source-faithful

The original has two distinct records (packet line 18 onward):

1. Bo Winters reports permission to send the device to a technician for `dial calibration`; Ada separately says she gave no instruction to collect it.
2. Ada relays only Bo Winters's words and supplies the positive bilingual clarification `калибровка регулятора, а не замена регулятора`; Ada has not seen the terms and has not received confirmation of the message.

Retention trace row 2 creates two candidates. The first retains Ada as outer relay, Bo as inner speaker, permission to send the device to a technician, regulator calibration rather than replacement, and both of Ada's personal verification limits. The second separately retains `Ada Marlow has given no instruction to collect the Zephyr QX-100 device.` Both are present in the packet at lines 39 and 57.

The multi-span audit at trace row 3 explicitly classifies F1 as a restatement and F2 as a clarification. Its comparison recognizes the clarified regulator referent and replacement exclusion. All three semantic dimensions are true. The earlier retention-side bilingual conflict does not recur, and permission is never promoted into an arranged shipment.

### Four nulls reopen the already-resolved referent

Trace rows 6–9 are successful answer-generation calls that return no blocks. Each claims a conflict between `dial calibration` and `regulator calibration`; row 7 also doubts whether Ada recorded the report. No deterministic guard, language checker or answer verifier causes these nulls, because there is no draft to check. The result consequently records four `empty_draft` outcomes.

The same retained excerpt and bound source frame are present in every call. The Russian query produces answers at trace rows 11, 14, 17 and 20, while the English query phrase `dial-calibration` triggers all four abstentions. This is query-influenced source interpretation in first-pass generation. It is not missing retrieval context, a source-frame binding failure, or a verifier hold.

### Accepted answers

The four nonnull answers preserve the regulator-calibration/replacement contrast, sending permission, Ada/Bo attribution and Ada's two personal limits. None claims collection was instructed or scheduled. Trace rows 12, 15, 18 and 21 accept all semantic dimensions and confirm that the source frame reached verification too.

Three answers use a report-status shorthand in addition to retaining the personal limits: `so it remains an unconfirmed report` (row 11), `the unconfirmed message` (row 17), and `поэтому оно остаётся неподтверждённым` (row 20). A strict reading can hear these as broadening “Ada did not receive confirmation” into a global confirmation claim. Under the established scoped-report convention, however, the status adjective remains inside Ada's named attribution and both personal limits are still explicit; none says that nobody anywhere confirmed it. I therefore preserve this as a forensic interpretation issue, not an established accepted qualification error.

Row 20's Russian `но не замену регулятора` is syntactically compressed and less polished than `но не для замены регулятора`, but its exclusion remains intelligible. It is not a mixed-language policy violation or a changed action.

## `v18-held-question`

### The separate epistemic subjects now survive retention

The original says both `I still have no answer` and `This note establishes neither inclusion nor exclusion`. Trace row 23 creates a dedicated open-question record plus a second claim:

> Ada Marlow still has no answer ... and this note establishes neither inclusion nor exclusion of that cleaning.

Trace row 24 compares the two clauses with separate subjects and accepts all dimensions. The packet exposes both records at lines 320 and 338. V52 therefore fixes the retention loss: Ada's knowledge state is not assigned to the note, and the note's evidentiary state is not assigned to Ada or the agreement terms.

All eight answer calls retrieve only the first open-question record, which is the record directly selected by the question view. Seven nonnull answers faithfully describe an open/unresolved question without asserting coverage, exclusion, booking, agreement silence or an answer. Omitting the second retained claim is not a source error for “which question” because the selected record itself says the question is unresolved. It does mean the new two-subject record is preserved and retrievable independently rather than exercised in these answer blocks.

### One source-supported recording phrase is rejected

Trace row 40 generates:

> Ada Marlow recorded an unresolved open question ...

The exact bound frame says `My unresolved question, recorded by me, Ada Marlow`. Nevertheless, trace row 41 reads only the retained paraphrase for this action, marks proposition and action arguments false, and sets excerpt selection false because `recorded` is supposedly unselected. This is a conservative original-frame false hold in my source-first reading: the frame establishes the same selected question's recorder, rather than an adjacent proposition.

This observation does not justify weakening the guard that blocks query-invented recording actions. Seven other drafts avoid the dispute with neutral wording such as `The recorded open question attributed to Ada Marlow` or `В записи содержится ... вопрос Ada Marlow`. The smallest availability response is to keep that neutral composition stable unless the retained excerpt itself verbalizes the personal recording action. If direct use of exact frame-supported recording is intended, the excerpt/frame rule needs a narrow same-record-modifier clarification rather than a general frame override.

## `v18-held-rejected`

Retention trace row 52 produces:

- the rejected offer to send Zephyr QX-100 to the service centre for a thermostat measurement, with Ada as decliner and no plan to send it under that offer;
- the independent denial that no handover has been booked.

Trace row 53 accepts both with correct action arguments and scope. The second candidate's `Ada Marlow states that` is neutral provenance for a direct user statement; it does not turn the anonymous no-booking state into a claim that Ada personally failed to book it. The later `offered shipment was rejected, not accepted` is not written as a third duplicate record, but its same-event corrective meaning remains in the first record's explicit rejection/decline and rejected disposition. No accepted answer claims acceptance, an actual shipment, a booking, or performance.

All eight query answers cite the rejected-offer record and are source-faithful. Some omit the no-plan clause because the question asks which offer was declined; this is a relevant compression. Rows 69 and 75 use narrative backshift (`had no plan`) within the same undated record. They do not add a later endpoint or say the non-plan status ended, so this is not a source-clock error.

The final Russian answer says `измерения параметров термостата`. `Parameters` is generic measurement language and does not name a particular property, method or result absent from source. I do not treat it as the kind of unsupported specialization prohibited by the source-specificity rule.

## `v18-held-alternatives`

Retention trace rows 81–82 and packet line 882 preserve all material content in one record: Ada considers two competing hypotheses, the connector is inserted/seated loosely, the temperature probe may be faulty, both remain tentative, neither has evidence, and Ada personally selected neither cause. The retained record and every nonnull answer keep Ada attached to nonselection. No alternative is promoted to an established fact.

Seven answers are nonnull. Each preserves both alternatives, their common absence of evidence and personal nonselection. Trace row 102 additionally declines the query's unsupported presupposition that Ada “discussed” them and answers only that she is considering them; this is a correct distinction, not a missing source fact.

The sole null is trace row 88. Generation returns source-faithful Russian:

> Ada Marlow рассматривает две конкурирующие, пока не установленные гипотезы ... Доказательств нет ни для одной ... Ada Marlow не выбрала ни одну причину.

The same output passes the language check, then is rejected as `discourse` before an answer-verifier call. The precise deterministic cause is the tentative-status floor: `tentativeLanguage()` recognizes forms such as `не установлен`, `не установлена/о/ы` and the single-word stem `неустановлен...`, but not the ordinary adjectival form `не установленные гипотезы`. The block therefore fails the required tentative marker even though that marker is present and attached to the epistemic head. This is a false hold, not a semantic mismatch, action-agency failure, language violation or provider failure.

## Accepted-error assessment

I found no clear accepted source-entailment, polarity, action-role, personal-nonselection or output-language error in the 26 nonnull answers under the stated conventions. The three scoped `unconfirmed` report labels are the one interpretive qualification concern described above; they retain Ada's personal limits and do not explicitly assert universal nonconfirmation. All language-check calls return compliant, and manual inspection found no foreign explanatory prose hidden by the new review-token path.

The two clear runtime defects are false nonproduction: the four report empty drafts that misread a positive bilingual clarification, and the alternatives inflection false hold. The question recording rejection is a source-authority disagreement/false hold in this review, with a safe neutral-composition route that does not require verifier relaxation.

## Smallest warranted next scope

1. Extend the existing tentative-status grammar only for an epistemic-head-bound Russian adjective such as `не установленная/ые гипотеза/гипотезы`. Keep punctuation and head binding; do not make arbitrary `не установлен...` prose a tentative marker.
2. Keep open-question generation on the already-successful neutral record wording when the retained excerpt omits a personal recording verb. If exact source-frame modifiers are meant to be answerable, specify same-selected-record modifier handling and preserve the existing prohibition on adjacent unselected actions.
3. Treat the repeated bilingual report abstention as a structural handoff gap. Retention already has a candidate-keyed, exact-span audit saying F2 clarifies F1, while answer generation receives only the admitted prose plus raw frame. A bounded private carry-forward of the accepted span relationship, tied to the existing retained-record/source hashes and exposed to the same answer calls, would preserve the prior source interpretation without an alias dictionary, extra model call, retry or public-schema change. Do not simply tell the answer model again that both raw terms are equivalent; the current prompt and raw frame already failed that test.

No threshold, retry policy or semantic-verifier acceptance rule should change from this diagnostic alone.
