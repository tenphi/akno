# V48 selected-probe forensic review

Scope was limited to `tmp/language-selected-output-packet-v48.json`, `bench-results/language-selected-v48.json`, and `bench-results/language-selected-v48-trace.jsonl`. I compared the current invented source, retained text and answers directly. I did not read an independent grader receipt, edit code, or make live calls.

## Result

- Retention: all four cases retained their expected record sets (2 + 2 + 1 + 1), with no hold, repair degradation, routing failure or availability failure.
- Answer production: 27/32 rows are non-null. This is production, not an independent usefulness score. Three report rows returned empty drafts; one undated row was rejected by excerpt selection; one undated row was rejected by a deterministic discourse floor.
- I found no accepted source-entailment, speaker/actor, qualification, polarity, language-identity or protected-value error in the 27 non-null answers.
- Minor retained-record weakness remains: the separate no-collection record says `Ada Marlow has given no instruction to collect it` and has `subject: unresolved`, so neither readable text nor typed subject independently identifies Zephyr. Its surrounding page can supply retrieval context, but the unit is not self-contained.

## Retention and accepted answers

### `v18-held-report`

The main record preserves Bo Winters as inner reporter, Ada Marlow as outer relay, reported permission to send the device to a technician, regulator calibration rather than regulator replacement, and Ada's lack of access to the terms or confirmation. The separate no-collection assertion is retained, subject to the self-containment issue above.

Five accepted answers are source-faithful. Each preserves both speaker layers, the clarified regulator sense, calibration/replacement contrast and unverified status. None promotes permission to an arranged shipment.

Three rows are empty, described below.

### `v18-held-rejected`

Both records are complete. The rejected offer binds Ada as the person declining it and preserves the device, destination, thermostat-measurement purpose, rejected/nonaccepted lifecycle and absence of a plan. The independent no-booked-handover denial is retained separately.

All eight answers are faithful. `Измерения параметров термостата` remains a grammar-neutral rendering of thermostat measurement and does not select a particular property. Focused omission of the separate no-booking record is allowed by the query expectation.

### `v18-held-undated`

The retained proposal preserves Ada as proposer, next week relative to the undated original record, unaccepted status and no arranged meeting. Its text omits the explicit sentence that the calendar week cannot be determined from processing time, but `next week relative to the undated original record` retains the two facts from which unresolved calendar placement follows. The optional frame carries the full explicit qualification.

Six accepted answers preserve Ada's proposal, unaccepted status, absent meeting, source-relative next week and an unknown/undated source clock. No answer resolves the date from processing time.

Two rows are null, described below.

### `v18-held-alternatives`

The retained record is complete: `loosely seated` preserves `неплотно вставленный`, both alternatives remain unsupported hypotheses, and Ada both considers them and personally selects neither.

All eight answers preserve loose seating, the faulty temperature probe alternative, explicit lack of evidence/support for both, tentative status and Ada's personal nonselection. V48 therefore closes the V47 mechanism and evidence-status losses in every selected row.

## Exact null causes

### Three report empty drafts

The EN query → EN inferred, EN query → RU inferred, and EN query → RU explicit calls returned no block. Their `missing_concepts` claimed an unresolved conflict between dial/scale calibration and regulator calibration, for example:

> Whether the reported service concerned dial calibration or regulator calibration; the supplied evidence contains incompatible descriptions and does not establish which is authoritative.

That assessment is wrong. The bilingual source expressly clarifies the intended referent: the English dial wording is clarified by Russian `регулятор`, with calibration contrasted against replacement. The retained excerpt already says regulator calibration, and the supplied retention frame contains the governing clarification. These are generation abstention errors and coverage losses, not safe source ambiguity. Because no block was emitted, no semantic or excerpt-selection verdict was requested for these rows. V46's static-note boundary prevents the false `missing_concepts` text from being echoed publicly.

### Undated EN query → EN explicit: false excerpt-selection rejection

Draft:

> Ada Marlow proposed reviewing the Zephyr QX-100 warranty exceptions next week, relative to the undated original record. The proposal remains unaccepted, no meeting has been arranged, and the calendar week cannot be determined.

The original semantic dimensions were all true, but `excerpt_selection` was false because the verifier said the retained excerpt did not contain `the calendar week cannot be determined`. This is an overly literal selection judgment. The excerpt says next week is relative to an undated original record; inability to determine the calendar week is the direct temporal meaning/qualification of that selected proposition, not an adjacent new fact introduced only by the frame. The frame makes the meaning explicit. The hold is a false rejection under the intended “frame constrains selected meaning” contract.

### Undated RU query → RU explicit: false deterministic discourse rejection

Draft:

> Ada Marlow предложила проверить исключения из гарантии Zephyr QX-100 на следующей неделе относительно исходной записи с неизвестной календарной датой. Предложение остаётся непринятым, и встреча не назначена; данные подтверждают предложение Ada Marlow, но не то, что она лично его записала.

It was rejected before semantic verification with `discourse: 1`. The draft preserves the proposer, proposal status, meeting absence and source-relative unknown calendar date. The bounded clock matcher does not recognize the otherwise faithful construction `исходной записи с неизвестной календарной датой`, so the typed temporal floor false-holds it. The final provenance sentence is unnecessary and awkward. It says the evidence supports Ada's proposal but does not establish a personal recording act; it does not assert that Ada did not record it. On source meaning it is not a promotion, though generation should omit it.

## Source-frame and selection-path verification

- All 32 answer-generation calls received a non-null `retention_source_frame` with the retrieved evidence.
- All 28 calls that produced a block reached first-pass semantic verification with a bound frame.
- Every one of those verifier results contained the required `excerpt_selection` object. Twenty-seven were `{selected_by_retained_excerpt: true, unselected_content: null}`. The one negative selection withheld its block despite all three original semantic dimensions being true.
- No malformed or inconsistent selection object appeared. Frames remain absent from the public packet answers and citations.

This confirms that the V48 binding and fail-closed selection schema execute in the probe. It also exposes a calibration limit: selection must allow an equivalent qualification entailed by the retained proposition and clarified by its frame, rather than demand that every answer clause be textually present in the excerpt.

## Bounded conclusion

V48 has complete retention and materially improves the alternatives case, but its 27/32 non-null production is below the 90% target and all five nulls are source-usefulness losses. The frame mechanism reached every intended call, yet generation still misread explicit cross-language clarification three times, and excerpt selection rejected one direct qualification entailment.

The coherent next scope is to refine the existing frame contract rather than add sampled nouns:

1. Define excerpt selection as semantic selection, allowing a conclusion that is inherent in the retained proposition's stated relation (for example, a relative week anchored to an undated record has no determinable calendar week), while still rejecting adjacent independent facts found only in the frame.
2. Make explicit source clarification authoritative over an apparent cross-language lexical conflict during generation; when the retained excerpt already chooses the clarified referent, the frame should constrain that sense rather than trigger `missing_concepts`.
3. Add the bounded source-linked `с неизвестной календарной датой` construction with an unrelated-device/date negative, while retaining full semantic verification.

No semantic retry, new model, threshold relaxation or gate change is supported. V48 should remain preserved as exposed evidence; the fresh held-out corpus should remain unused pending the separate independent usefulness judgment and resolution of these observed losses.
