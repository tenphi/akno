# V61 built report preliminary source-first audit

## Scope

This preliminary review is limited to `v18-held-report`: its two original source items in [`language-v19-blind-inputs.json`](language-v19-blind-inputs.json) and trace rows 1–37 in [`language-built-reliability-v61-trace.jsonl`](../../../../bench-results/language-built-reliability-v61-trace.jsonl). I did not inspect a grading receipt, fresh held-out inputs or provider state, and I made no runtime call or edit.

The final benchmark report is not yet available, so this note classifies the completed retention and model-call path rather than claiming final case/report metrics.

## Original-source meaning

The first source item says:

> Bo Winters says that the Zephyr QX-100 service terms permit sending the device to a technician for dial calibration. I, Ada Marlow, have given no instruction to collect it.

The second says:

> Я передаю только слова Bo Winters: разрешена калибровка регулятора, а не замена регулятора. Самих условий я не видела и подтверждения этому сообщению не получила.

Read together, the Russian item expressly presents itself as Ada's transmission of Bo's words and restates the service as regulator calibration rather than regulator replacement. Ada has not seen the terms and has not received confirmation of the message. Her separate direct assertion says she gave no instruction to collect Zephyr QX-100. Permission to send the device for service does not establish collection, booking, replacement or completed work.

## Retention outcome

The first extraction produces two candidates ([rows 1–2](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L1)):

1. `Bo Winters says that the Zephyr QX-100 service terms permit sending the device to a technician for regulator calibration, not regulator replacement; Ada Marlow conveys only Bo Winters's words, has not seen the terms herself, and has not received confirmation of this message.`
2. `Ada Marlow has given no instruction to collect the Zephyr QX-100.`

Both are source-faithful:

- Bo remains the inner speaker and Ada the outer transmitting source;
- the report remains permission to send the device to a technician;
- the Russian restatement's regulator-calibration/not-replacement contrast is preserved;
- Ada's lack of firsthand access and lack of received confirmation remain personal predicates;
- the separate collection-instruction denial keeps Ada as actor and resolves `it` to the immediately named Zephyr QX-100 without turning the denial into a booking claim.

The report candidate's support and deciding frame contain both complete source items. The collection denial's support/frame contains the first complete item. The retention verifier explicitly identifies the independent collection denial inside the report frame as not part of the first candidate, reads the Russian item as a clarification of Bo's reported service, and returns empty mismatches with all three booleans true for both candidates ([row 3](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L3)). This is sound separation despite the item-wide source quotes.

No repair call occurs. Ownership selects the proposed Zephyr page for the report and the existing Zephyr page for the denial ([rows 4–5](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L4)). The completed retention path therefore has two admitted, placed records and no observed retained-proposition loss.

## Eight generation and verifier attempts

The eight combinations follow the fixed matrix: English or Russian query, English or Russian output, and inferred or explicit report view. Every generation selects the same report record through the complete-record renderer:

- all four English outputs choose `copy` and materialize the same complete current retained record;
- all four Russian outputs choose `translate` and translate the complete record;
- every rendering-choice response is schema-valid;
- every generated block cites only E1;
- every language check returns `compliant:true`.

The exact call coordinates and verifier dispositions are:

| Combination | Generation / language / verifier rows | Mode | Verifier result |
| --- | --- | --- | --- |
| EN query, EN answer, inferred view | [6–9](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L6) | copy | all alignments preserved; all booleans true; selection true |
| EN query, RU answer, inferred view | [10–13](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L10) | translate | all alignments preserved; all booleans true; selection true |
| EN query, EN answer, explicit view | [14–17](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L14) | copy | all alignments preserved; all booleans true; selection true |
| EN query, RU answer, explicit view | [18–21](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L18) | translate | all alignments preserved; all booleans true; selection true |
| RU query, EN answer, inferred view | [22–25](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L22) | copy | all alignments preserved; all booleans true; selection true |
| RU query, RU answer, inferred view | [26–29](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L26) | translate | all alignments preserved; all booleans true; selection true |
| RU query, EN answer, explicit view | [30–33](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L30) | copy | all alignments preserved; all booleans true; selection true |
| RU query, RU answer, explicit view | [34–37](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L34) | translate | all alignments preserved; all booleans true; selection true |

More precisely, every verifier verdict contains:

- `mismatches: []`;
- `proposition_supported: true`;
- `action_arguments_preserved: true`;
- `qualification_scope_preserved: true`;
- `excerpt_selection.selected_by_retained_excerpt: true`;
- `excerpt_selection.unselected_content: null`;
- `actor`, `object_and_mechanism` and `qualification` relations all `preserved`, with anchors belonging to E1 and the current answer.

The prior V60 dial/regulator false-hold signature does not recur in these eight attempts. Each object alignment uses the Russian clarification span or judges the complete frame and accepts regulator calibration rather than regulator replacement. This is an observed V61 outcome, not evidence that query omission caused it: generation wording, verifier instructions and stochastic model behavior also differ, and the trace exposes no causal state.

## Draft source and language assessment

All four English copies are byte-identical materializations of the retained report and are source-faithful. They preserve the complete actor chain, permission, service purpose, replacement exclusion, and both of Ada's personal limits.

All four Russian translations preserve the same content. They keep the names in original spelling, make Bo the person saying what the terms permit, state regulator calibration rather than regulator replacement, and state that Ada only transmits Bo's words, has not seen the terms and has not received confirmation.

One Russian inferred-view draft begins with `**Сообщено Ada Marlow:**` ([row 10](../../../../bench-results/language-built-reliability-v61-trace.jsonl#L10)). With an indeclinable Latin-script name, that short passive label is locally ambiguous between source and recipient readings. The following clauses resolve the role—`Bo Winters говорит` and later `Ada Marlow передаёт только слова Bo Winters`—so I do not classify the complete draft as an actor reversal or source-entailment error. It is less clear than the other Russian drafts' `По словам Ada Marlow` and is a language-quality observation for the final source-only audit.

Several private `source_context` strings end with stray or truncated-looking characters. These strings remain schema-valid, are not published answer prose, and do not override their exact anchors or verdicts. Their presence limits any attempt to infer more about model reasoning from the narrative fields.

## Query omission observation

Every rendering-choice generation payload includes the exact user question. Every support-verifier payload in rows 9, 13, 17, 21, 25, 29, 33 and 37 omits the `question` property and includes `rendering_scope: complete_retained_record`. Each still contains:

- the complete materialized answer segments;
- the visible retained excerpt;
- all original-frame bytes as E1 anchors;
- qualification metadata and record scope;
- the report memory view.

This confirms the intended V61 transport split. It does not show why the verifier accepted these drafts or establish a reliability improvement. The final report and remaining cases are required before making probe-wide availability or accepted-answer claims.

## Preliminary conclusion

The completed report path retains the two source propositions without repair or omission. All eight generated report drafts are faithful complete copies/translations, pass language checking, and receive fully positive support verdicts with valid selection and alignments. No unsupported action, qualification loss, language mismatch, schema failure or typed availability event is visible in report rows 1–37. The only local wording concern is the contextually resolved but avoidably ambiguous Russian label `Сообщено Ada Marlow`; final classification should consider the complete sentence rather than that label alone.
