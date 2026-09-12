# V54 built-package forensic audit

## Scope and method

This is a source-first audit of the frozen V54 built-package diagnostic at `9fd704d`. I compared every retained item and every non-null answer with the original invented source in [the finalized packet](language-built-output-packet-v54.json#L6), then used [the reliability report](built-reliability.json#L54) and [the raw trace](../../../../bench-results/language-built-reliability-v54-trace.jsonl) only to explain nulls and enforcement outcomes. I did not inspect the independent output-grading receipt, call a model, retry a row, or modify runtime code.

Coordinates below use the fixed matrix order:

| q | Query | Answer | View |
|---:|---|---|---|
| 0 | EN | EN | inferred |
| 1 | EN | RU | inferred |
| 2 | EN | EN | explicit |
| 3 | EN | RU | explicit |
| 4 | RU | EN | inferred |
| 5 | RU | RU | inferred |
| 6 | RU | EN | explicit |
| 7 | RU | RU | explicit |

## Disposition

The run retained a useful, typed, retrievable set for all four cases and left source bytes unchanged. It produced 21 of 32 answers: 21 `answered`, one `empty_draft`, and ten `verification_rejected`. There were no availability failures or answer-operation failures. All eleven nulls are unjustified case-level abstentions under the useful-answer contract because each original source supports a faithful answer. Some individual draft rejections were correct; that does not make the whole case unwritable.

I found no accepted source, qualification, or language error among the 21 non-null outputs. A preliminary concern about the question case's RU ellipsis is recorded and resolved below. The result is therefore complete retention, 21 useful non-null answers, and eleven lost useful answers.

## Retention and routing

All retained sets are faithful and complete enough for their queries:

- **Report:** the first item preserves Ada Marlow as outer reporter, Bo Winters as inner reporter, permission to send the device for regulator calibration rather than replacement, and both of Ada's personal epistemic limits. The second independently preserves that Ada gave no collection instruction. See the original bilingual source and retained records at [packet lines 14–73](language-built-output-packet-v54.json#L14).
- **Question:** the retained item preserves Ada's unresolved coverage question, Ada's personal lack of an answer, and the note's distinct failure to establish inclusion or exclusion. It does not say that Ada “recorded” the question, but that act is not needed to answer faithfully; neutral wording such as “Ada's unresolved question is …” remains available. See [packet lines 294–336](language-built-output-packet-v54.json#L294).
- **Rejected offer:** one record preserves Ada's rejection, the complete offered action, and her lack of a plan under that offer; a second preserves the separate absence of a booked handover. See [packet lines 557–610](language-built-output-packet-v54.json#L557).
- **Alternatives:** the single record preserves both mechanisms, their shared hypothetical status and lack of evidence, and Ada's personal nonselection. “Loosely inserted internal connector” preserves the seating/engagement mechanism. None of these outputs broadens it to generic incorrect installation. See [packet lines 838–874](language-built-output-packet-v54.json#L838).

Each query retrieved the relevant retained record. The two noncanonical eligibility flags on the report and rejected-offer views are expected typed-view behavior, not routing defects. There were no placement holds or retained-set omissions.

The private source-frame bridge reached every generation call: all 32 responses contain one candidate-keyed `record_readings` entry for `E1`. It also reached all 31 verifier calls: every submitted block contains the frame and a candidate-keyed source alignment. The report frame contains the English `dial calibration` line and the later Russian clarification `калибровка регулятора, а не замена регулятора`; the frame was therefore present even where a model decision ignored the clarification.

## Non-null answers

All answers below include the expected memory citation shown in the packet. The table quotes the answer body exactly and gives my source-first disposition.

### `v18-held-report`: 2/8 non-null

| q | Answer body | Disposition |
|---:|---|---|
| 2 | “According to Ada Marlow, Bo Winters reported that the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not regulator replacement. Ada Marlow had not seen the terms herself or received confirmation of this report.” | Faithful: both reporting roles, permitted action, correction, and personal limits are explicit. [Packet](language-built-output-packet-v54.json#L152) |
| 4 | Same English body as q2. | Faithful for the RU query for the same reasons. [Packet](language-built-output-packet-v54.json#L204) |

Neither output turns permission into a booking, collection, replacement, or verified service fact.

### `v18-held-question`: 6/8 non-null

| q | Answer body | Disposition |
|---:|---|---|
| 0 | “Ada Marlow recorded the unresolved open question of whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter. She still has no answer, and the note establishes neither inclusion nor exclusion.” | Faithful and keeps Ada's personal state distinct from the note's evidential state. [Packet](language-built-output-packet-v54.json#L363) |
| 1 | “Ada Marlow записала открытый нерешённый вопрос о том, включает ли сервисное соглашение Zephyr QX-100 профилактическую очистку фильтра. У неё по-прежнему нет ответа, а запись не устанавливает ни включение этой очистки, ни её исключение.” | Faithful; the two epistemic subjects are explicit. [Packet](language-built-output-packet-v54.json#L389) |
| 2 | “Ada Marlow recorded the unresolved question of whether the Zephyr QX-100 service agreement includes preventive cleaning of the filter. She still has no answer, and the note establishes neither inclusion nor exclusion of that cleaning.” | Faithful. [Packet](language-built-output-packet-v54.json#L415) |
| 3 | “Ada Marlow записала открытый нерешённый вопрос о том, включает ли сервисное соглашение для Zephyr QX-100 профилактическую очистку фильтра. У Ada Marlow по-прежнему нет ответа, и запись не устанавливает ни включение, ни исключение этой очистки.” | Faithful; both scopes remain explicit. [Packet](language-built-output-packet-v54.json#L441) |
| 5 | “Ada Marlow записала открытый вопрос о том, включает ли сервисное соглашение для Zephyr QX-100 профилактическую чистку фильтра. У неё по-прежнему нет ответа, и запись не устанавливает ни включение, ни исключение этой чистки.” | Faithful. [Packet](language-built-output-packet-v54.json#L493) |
| 7 | “Ada Marlow записала открытый вопрос о том, включает ли сервисное соглашение для Zephyr QX-100 профилактическую чистку фильтра. Ответа пока нет: запись не устанавливает ни включение этой чистки, ни её исключение.” | Faithful under cohesive local ellipsis; see the scope discussion below. [Packet](language-built-output-packet-v54.json#L545) |

I initially flagged q7's bare `Ответа пока нет` because, in isolation, an impersonal no-answer clause can erase the personal subject in “I still have no answer.” In this actual two-sentence answer, however, Ada is directly named as the recorder/owner of the open question immediately before the ellipsis, and the following `запись не устанавливает...` clause keeps the second proposition scoped to the record. The natural reading is that Ada's recorded question remains unanswered, not that nobody knows or could know the answer. This differs from an explicit broadening such as `никому не известен ответ`, and it differs from an unassigned passive embedded action with no local owner. I therefore do not count q7 as an error. This boundary is independently documented in [the question-scope audit](question-scope-audit.md).

### `v18-held-rejected`: 6/8 non-null

| q | Answer body | Disposition |
|---:|---|---|
| 1 | “По словам Ada Marlow, она отклонила предложение отправить Zephyr QX-100 в сервисный центр для измерения термостата. По этому предложению у неё не было плана отправлять устройство.” | Faithful self-attribution; rejection and no-plan scope stay attached to the same offer. [Packet](language-built-output-packet-v54.json#L670) |
| 2 | “Ada Marlow declined and rejected the offer to send Zephyr QX-100 to the service centre for a thermostat measurement. She had no plan to send it under that offer.” | Faithful. [Packet](language-built-output-packet-v54.json#L696) |
| 3 | “Ada Marlow отклонила предложение отправить Zephyr QX-100 в сервисный центр для измерения термостата. По этому предложению у неё нет плана отправлять устройство.” | Faithful. [Packet](language-built-output-packet-v54.json#L722) |
| 5 | “Ada Marlow отклонила предложение отправить Zephyr QX-100 в сервисный центр для измерения параметров термостата. По этому предложению у неё нет плана отправлять устройство.” | Faithful. `параметров` remains generic measurement wording and does not invent a particular property. [Packet](language-built-output-packet-v54.json#L774) |
| 6 | “Ada Marlow rejected the offer to send Zephyr QX-100 to the service centre for a thermostat measurement. She had no plan to send it under that offer.” | Faithful. [Packet](language-built-output-packet-v54.json#L800) |
| 7 | “Ada Marlow отклонила предложение отправить Zephyr QX-100 в сервисный центр для измерения термостата.” | Faithful focused subset. The corpus contract expressly permits stating the rejection without redundantly restating no plan. [Packet](language-built-output-packet-v54.json#L826) |

None implies acceptance, booking, handover, completed measurement, or collection.

### `v18-held-alternatives`: 7/8 non-null

| q | Answer body | Disposition |
|---:|---|---|
| 0 | “Ada Marlow was considering two competing tentative fault hypotheses for Zephyr QX-100: a loosely inserted internal connector or a faulty temperature probe. Both remained hypotheses with no evidence for either, and she had selected neither cause.” | Faithful. The past forms are ordinary narrative backshift inside the same undated record; they do not add a later endpoint or resolution. [Packet](language-built-output-packet-v54.json#L901) |
| 1 | “Ada Marlow рассматривает две конкурирующие гипотезы неисправности Zephyr QX-100: неплотно вставленный внутренний разъём и неисправный температурный зонд. Обе остаются предположениями без доказательств, и Ada Marlow не выбрала ни одну причину.” | Faithful; both alternatives and shared qualifications remain explicit. [Packet](language-built-output-packet-v54.json#L927) |
| 2 | “Ada Marlow is tentatively considering two competing fault hypotheses for Zephyr QX-100: a loosely inserted internal connector or a faulty temperature probe. Both remain hypotheses with no evidence for either, and she has selected neither cause.” | Faithful. [Packet](language-built-output-packet-v54.json#L953) |
| 4 | “According to Ada Marlow, the two competing tentative hypotheses are: a loosely inserted internal connector, or a faulty temperature probe. Both remain hypotheses with no evidence for either, and Ada Marlow has selected neither cause.” | Faithful focused attribution. It does not adopt the query's “discussed” presupposition as a separate event. [Packet](language-built-output-packet-v54.json#L1005) |
| 5 | “Ada Marlow рассматривает две конкурирующие предварительные гипотезы о сбоях Zephyr QX-100: неплотно вставленный внутренний разъём или неисправный температурный зонд. Обе остаются предположениями, доказательств нет ни для одной, и Ada Marlow не выбрала ни одну причину.” | Faithful. [Packet](language-built-output-packet-v54.json#L1031) |
| 6 | “Ada Marlow is considering two competing tentative hypotheses about failures of Zephyr QX-100: a loosely inserted internal connector or a faulty temperature probe. Both remain hypotheses, there is no evidence for either one, and Ada Marlow has selected neither cause.” | Faithful. [Packet](language-built-output-packet-v54.json#L1057) |
| 7 | “Ada Marlow рассматривает две конкурирующие предварительные гипотезы о сбоях Zephyr QX-100: неплотно вставленный внутренний разъём либо неисправный температурный зонд. Обе остаются предположениями, доказательств нет ни для одной, и Ada Marlow не выбрала ни одну причину.” | Faithful. [Packet](language-built-output-packet-v54.json#L1083) |

All seven preserve the source's specific deficient insertion/engagement mechanism. This is within the established seating convention for “loosely inserted” or natural “improperly seated” wording and does not license the broader `неправильно установленный`/“incorrectly installed” paraphrase.

## The eleven nulls and their exact causes

| Case/q | Faithful generated draft or reading | Immediate hold | Forensic disposition |
|---|---|---|---|
| report/0 | No block. Its reading says English `dial calibration` and Russian `regulator calibration` do not establish the same component. | `empty_draft`; missing concept asks whether dial and regulator refer to the same service/component. [Trace L6](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L6) | Incorrect source reading. The second source span is an explicit bilingual clarification and contrast, so a faithful answer was available. |
| report/1 | “По словам Ada Marlow, Bo Winters сообщил ... для калибровки регулятора, а не ... замены ... Ada Marlow не видела ... и не получила подтверждения ...” | Model verifier sets proposition/action false, treating dial→regulator as an object change. It also aligns the answer's personal epistemic limits to the unrelated no-collection sentence. [Trace L9](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L9) | Safe rejection of the verifier's own asserted mismatch, but the mismatch is wrong because the full frame clarifies the bilingual term. Case-level null is unjustified. |
| report/3 | Same faithful regulator-calibration/replacement contrast and both personal limits. | Model verifier again sets proposition/action false from dial→regulator. Its qualification anchor is again the unrelated no-collection source span. [Trace L15](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L15) | Same incorrect comparison; unjustified null. |
| report/5 | Faithful RU report, correction, and both personal limits. | Model returns all three booleans true, but every purported `source_quote` is copied from the retained English excerpt rather than the original frame. Exact quote validation correctly fails. [Trace L21](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L21) | Correct fail-closed enforcement of a malformed audit; faithful draft lost. |
| report/6 | Faithful English report, correction, and both personal limits. | Model verifier sets proposition/action false from dial→regulator, although this generation call's reading explicitly says the cross-language clarification resolves the term. [Trace L24](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L24) | Independent verifier contradicts the correct source reading; unjustified null. |
| report/7 | Faithful RU report, correction, and both personal limits. | All booleans and selection are true, but all three source anchors are retained-excerpt English, not original-frame bytes. [Trace L27](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L27) | Correct fail-closed enforcement; faithful draft lost. |
| question/4 | “Ada Marlow recorded an unresolved open question ... She still has no answer, and the note establishes neither inclusion nor exclusion.” | All semantic comparisons are true and source quotes are exact, but `selected_by_retained_excerpt` is false because the visible retained excerpt does not explicitly say “recorded.” [Trace L46](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L46) | Correct application of the frame-as-constraint rule to this draft; nevertheless, a useful answer could omit the recording act, so the case-level abstention is unjustified. |
| question/6 | Same faithful English question description. | Selection is false for “recorded”; actor and qualification `source_quote` values are additionally copied from the retained excerpt and fail exact-frame validation. [Trace L52](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L52) | Correct fail-closed enforcement; a neutral faithful draft was available. |
| rejected/0 | “Ada Marlow declined and rejected ... The shipment was not accepted, and she had no plan to send it under that offer.” | All semantic comparisons and exact source anchors pass, but selection is false because “The shipment was not accepted” is said to occur only in the frame. [Trace L63](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L63) | Over-literal selection judgment. The retained excerpt's “declined and rejected an offer” selects the same-event nonacceptance; no new event or fact is introduced. Unjustified null. |
| rejected/4 | Faithful rejection and no-plan answer. | All booleans and selection are true; actor source anchor `Ada Marlow declined and rejected an offer` is copied from the retained excerpt instead of exact original `I, Ada Marlow, declined an offer`. [Trace L75](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L75) | Correct fail-closed exact check; faithful draft lost. |
| alternatives/3 | Faithful RU rendering of both specific hypotheses, shared lack of evidence, and Ada's nonselection. | All booleans and selection are true, but actor, mechanism, and qualification source anchors are copied from the retained English excerpt rather than the original Russian frame. [Trace L100](../../../../bench-results/language-built-reliability-v54-trace.jsonl#L100) | Correct fail-closed exact check; faithful draft lost. |

Five rows contain invalid original-frame anchors: report/5, report/7, question/6, rejected/4, and alternatives/3. Question/6 also has a selection hold. There are no answer-quote byte mismatches. The eleven nulls therefore group as follows (with one overlap):

- one false source-ambiguity generation decision: report/0;
- three false bilingual semantic comparisons: report/1, report/3, report/6;
- five exact-source-anchor failures: report/5, report/7, question/6, rejected/4, alternatives/3;
- three excerpt-selection failures: question/4, question/6, rejected/0.

The overlap at question/6 makes the unique total eleven. The deterministic exact-quote floor behaved correctly: it did not accept model verdicts whose claimed source evidence was absent from the original frame.

## Budget and response integrity

The report records explicit answer and retention output ceilings of 2,400 tokens. All trace records have `ok: true`, `schemaError: false`; there is no malformed, transport-rejected, or truncated structured response. The 32 generation calls used 10,946 output tokens in total (mean 342, maximum 751). The 31 verifier calls used 19,345 (mean 624, maximum 932). Both observed maxima are well below 2,400.

Trace line 9 contains unfinished-looking explanation prose (`contrasts it...`, `does not contain the answer's full...`) despite complete valid JSON. That is degraded model-authored rationale, not output truncation or schema failure. Its false booleans cause a safe hold, so it did not produce an unsafe acceptance. Each row has one generation and at most one verifier call; no semantic retry appears in the trace.

The 2,400-token setting is material to this diagnostic and must remain attached to its interpretation. This run does not show that the same audits fit a service configuration capped at 1,024, although the observed outputs happened to remain below 1,024.

## Bounded next scope supported by this run

The highest-yield change is to make the two bodies in the verifier transport unmistakable without relaxing the exact checker: name the fields as original frame versus retained excerpt, require `original_frame_quote` to be copied only from the original-frame field, and order/present them so the model cannot silently use the retained paraphrase as its quote source. The five exact-anchor holds are the direct evidence. Exact matching should continue to fail closed; accepting paraphrase anchors would remove the only reliable evidence that the verifier actually consulted the authority.

The bilingual report failures need a source-interpretation instruction inside the existing verifier call: resolve explicit cross-language clarification over the whole original frame before comparing a term, and anchor the mechanism to the clarifying span when it supplies the more specific reading. This is narrower than a dial/regulator alias dictionary, adds no retry or model pass, and preserves rejection when two spans truly conflict. The fact that seven generation readings and the retention audit resolved this source, while three independent verifier judgments did not, shows that the frame is present and the failure is comparison behavior.

For excerpt selection, generation should avoid a source-frame-only recording act when the retained excerpt supports a neutral answer, as in question/4 and question/6. Separately, the verifier's selection guidance should recognize same-event semantic entailment such as retained “declined and rejected the offer” selecting “the offered shipment was not accepted”; selection must not become a lexical-substring test. These are distinct fixes because the first removes unselected detail while the second prevents rejection of a selected equivalent.

No evidence here supports adding a broad obligation array, weakening the three semantic dimensions, accepting non-exact source anchors, changing thresholds, or retrying rejected semantics. The retained language and typed records are already adequate; the losses occur in first-pass source interpretation, audit quote provenance, and excerpt-selection decisions.
