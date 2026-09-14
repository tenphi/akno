# V60 selected report — preliminary source-first review

## Scope

This interim review stops at the first completed case, `v19-held-report`: original source in `tmp/language-v20-blind-inputs.json` and [trace rows 1–37](../../../../bench-results/language-selected-v60-trace.jsonl#L1). I did not inspect later cases, a finalized report, or a grading receipt, and I made no provider call or runtime change. Counts and conclusions below apply only to this report case.

## Retention and support

Extraction produced two separate candidates with exact source support ([trace rows 1–2](../../../../bench-results/language-selected-v60-trace.jsonl#L1)):

1. `Ada Marlow reports that Bo Winters said the Zephyr QX-100 service terms permit sending the device to a service bench to measure the tension of its return spring, not replacing that spring; Ada Marlow has not read the service terms and has no independent confirmation of this reported condition.`
2. `Ada Marlow states that no collection of her device has been booked.`

The first candidate is source-faithful. It keeps Ada as outer reporter, Bo as inner speaker, permission rather than booking or completed service, return-spring tension measurement rather than spring replacement, and Ada's distinct personal limits. Its support/frame includes all three original items. The wording `no independent confirmation of this reported condition` is slightly compressed, but in the complete clause it does not assert that the condition was verified; it preserves Ada's lack of confirmation and the reported rather than established basis.

The second candidate is also source-faithful. It preserves the passive denial: no collection of Ada's device has been booked. It identifies Ada as speaker/possessor, not as the booking agent, and does not invent a product identity.

The first-pass verifier independently accepts both candidates on proposition, action arguments, and qualification scope ([trace row 3](../../../../bench-results/language-selected-v60-trace.jsonl#L3)). Its span audit correctly treats the no-collection sentence as independent from the service report.

No structural repair occurred.

## Ownership behavior

The main service-report candidate is assigned to the existing Zephyr QX-100 page ([trace row 4](../../../../bench-results/language-selected-v60-trace.jsonl#L4)).

The generic passive denial has subject `Ada Marlow's device collection`, `page:null`, and text with no Zephyr identifier. The extractor therefore did **not** exercise the new person-page suggestion: ownership received no proposed person page, only `uncertain` and the existing product page as allowed selections. It returned `uncertain`, so the denial is held at placement ([trace row 5](../../../../bench-results/language-selected-v60-trace.jsonl#L5)). This is conservative and avoids falsely attaching an unspecified device to Zephyr, but the final retained set for this case will omit a source-supported independent assertion unless later report assembly says otherwise.

This run demonstrates safe behavior when the model declines the new page suggestion. It does not demonstrate that the person-page proposal branch works or that ownership would accept it.

## First eight answer attempts

All eight attempts use the written main report as their only evidence. The complete-record renderer chooses `copy` for all four English outputs and supplies full Russian translations for all four Russian outputs. Each generated block cites only E1; no private neighboring proposition or held collection denial enters an answer ([trace rows 6–37](../../../../bench-results/language-selected-v60-trace.jsonl#L6)).

The English output is the exact current retained record with its localized report label. The Russian output consistently says, in substance:

> Ada reports that Bo said the Zephyr QX-100 terms permit sending the device to a service bench to measure its return spring's tension, not replace that spring; Ada did not read the terms and has no independent confirmation of the reported condition.

One Russian label variant is `Пересказала Ada Marlow`; the others use `По словам Ada Marlow`. Both preserve Ada's outer-reporting role in the accompanying sentence. Bo remains the person who made the inner statement. The translations retain the action object/purpose, nonreplacement contrast, and verification limits. I found no accepted source, qualification, role, language, or retained-selection error in these eight attempted answers.

All eight blocks reach verification. Each receives all three required semantic booleans and `selected_by_retained_excerpt:true`; no mismatch or unselected content is reported ([trace rows 9, 13, 17, 21, 25, 29, 33, and 37](../../../../bench-results/language-selected-v60-trace.jsonl#L9)). This is execution evidence for first-pass acceptance, not a claim about the unfinished probe's published counts.

## Preliminary case finding

The main report is retained and answered faithfully across all eight language/view combinations. The separate generic no-collection denial is extracted and semantically accepted but held by unresolved ownership. V60's new person-page suggestion is not exercised because the generated candidate carries no page proposal. No conclusion about later probe cases or aggregate V60 readiness follows from this first-case review.
