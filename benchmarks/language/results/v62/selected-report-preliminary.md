# V62 selected report case: preliminary source-first audit

## Scope

This note covers only `v19-held-report`: the original in `tmp/language-v20-blind-inputs.json` and trace rows 1–37 of `bench-results/language-selected-v62-trace.jsonl`. Rows 38 onward belong to the next case and were not used. No final report totals, output-grader receipt, fresh held-out input, or provider call were consulted.

## Original source contract

The source establishes two independent propositions:

1. Ada Marlow relays Bo Winters's statement that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension. Ada's Russian clarification says measurement, not spring replacement, and identifies this as Bo's words in her retelling rather than a term she verified. Ada has not read the terms and lacks independent confirmation.
2. No collection of Ada's device has been booked. This does not identify who would perform booking and does not itself identify the device as Zephyr QX-100.

Permission is not an actual booking or completed measurement.

## Retention and ownership

Trace row 2 produces both candidates in the new wire order, ending each object with `text`, `subject`, `page`.

### Booking denial

The generated candidate is:

> `Ada Marlow states that no collection of her device has been booked.`

It uses `subject: Ada Marlow`, `page: null`, asserted/active/negated self-attested metadata, and exact support `No collection of my device has been booked.` Its frame also contains Ada's preceding report limits. This is source-entailing: Ada is the source and possessor, while the passive sentence leaves the booking actor unspecified. It does not narrow the generic device to Zephyr.

Retain-verifier row 3 gives all three booleans true and no mismatch. Ownership row 4 receives only `uncertain` and the existing Zephyr page as choices; there is no proposed person page. It returns `uncertain`, so the candidate is not written. This is a conservative placement hold with reduced routing input, not a semantic retention rejection. The generated subject is better aligned with the source than V61's relational subject, but one sample cannot establish that schema ordering caused the change.

### Main nested report

The generated candidate is:

> `According to Ada Marlow's retelling of Bo Winters's words, the Zephyr QX-100 terms permit sending the device to a service bench to measure the tension of its return spring, not replacing that spring; Ada Marlow has not read the service terms and has no independent confirmation of this reported condition.`

It preserves outer Ada, inner Bo, device transport, service bench, return-spring tension measurement, non-replacement, and both personal verification limits. Its attribution chain and support/frame are complete. Retain-verifier row 3 accepts it with all three dimensions true. Ownership row 5 selects the existing Zephyr page. This candidate is written and is the sole answer evidence.

The retained set is therefore useful but incomplete: the report survives; the independent booking denial remains held at placement.

## Eight answer attempts

All eight attempts generate one block, pass deterministic guards, and receive all-true semantic verdicts with `selected_by_retained_excerpt=true`. Complete-record verifier rows 9, 13, 17, 21, 25, 29, 33 and 37 omit the query as designed while retaining the excerpt, qualification, complete original frame, answer anchors, and selection/alignment fields. No retry occurs.

### Faithful outputs

Seven outputs are source-faithful:

- EN copy outputs reproduce the retained record exactly.
- RU outputs at answer rows 12, 28 and 36 preserve the service permission, measurement purpose, non-replacement contrast, Ada/Bo reporting roles, and Ada's unread/unconfirmed limits.
- `**Сообщила Ada Marlow:**` and `**Пересказано Ada Marlow:**` are followed by live `По словам Ada Marlow, в её пересказе слов Bo Winters`, so the body independently binds Ada as outer source and Bo as inner source. They do not rely only on the passive heading.

### Accepted word-sense error

The EN-query/RU-answer explicit-view output generated at row 20 and accepted at verifier row 21 ends:

> `Ada Marlow не читала условия обслуживания и не имеет независимого подтверждения этого сообщения о состоянии.`

`сообщения о состоянии` means a report/message about a state or condition-state. The original clarification uses `условие` in the service-terms context: it is not a contractual condition/term Ada verified. The answer changes that clarified sense to a state and no longer cleanly preserves the source's contractual-condition qualification. The earlier clause `условия Zephyr QX-100` does not erase the incompatible final specialization.

Verifier row 21 nevertheless marks actor, object/mechanism and qualification `preserved`, all semantic booleans true, selection true, and mismatches empty. This is an accepted source/qualification error and a verifier miss. The error is language-compliant Russian; it is not a language-policy failure.

## Preliminary disposition

For this case alone:

- extraction: 2/2 source-supported candidates;
- semantic retention verification: 2/2 accepted;
- routed/written: 1/2, with the booking denial held by ownership;
- answer attempts: 8/8 non-null;
- source-faithful answers: 7/8;
- accepted errors: one `contractual condition → state` sense/qualification error;
- availability, transport, schema, language-check and semantic-call failures: none.

The case does not justify causal claims about the schema reorder. It shows that the reordered generation can produce a correct person subject for the passive possessive denial, while existing ownership still lacks a valid destination. It also shows the semantic verifier remains unable in one row to enforce an explicit cross-language contractual-term clarification.
