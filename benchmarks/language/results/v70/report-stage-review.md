# V70 first-report retention-stage forensic review

This review is limited to the first report scenario in each live V70 trace. It compares the original
source with extraction, structural cleaning/repair, retention verification, and ownership. It does not
grade answer drafts or infer eventual public acceptance. I did not inspect final reports, independent
grades, private configuration/KB data, or fresh held-out inputs, and made no runtime/provider/GitHub
changes.

Sources and trace coordinates:

- selected probe: `v20-held-report`, case 0 of
  [`tmp/language-v20-blind-inputs.json`](../v65/language-v20-blind-inputs.json), with retention-stage calls at
  [`bench-results/language-selected-v70-trace.jsonl`](../../../../bench-results/language-selected-v70-trace.jsonl)
  rows 1–5;
- built probe: `v19-held-report`, case 0 of the same exposed V20 input file, with retention-stage calls at
  [`bench-results/language-built-reliability-v70-trace.jsonl`](../../../../bench-results/language-built-reliability-v70-trace.jsonl)
  rows 1–5.

## Selected probe: `v20-held-report`

### Original source meaning

Ada Marlow says she is passing on Bo Winters’s account without having read the agreement or independently
checked the account. She separately says she has not arranged delivery of her Zephyr QX-100. Bo Winters’s
reported proposition is that the agreement permits sending Zephyr QX-100 to the workshop to measure the
gap at the latch. The Russian clarification fixes the operation as measuring the latch gap rather than
changing the latch and repeats that Ada only relays Bo’s meaning and has not personally checked it.

The source establishes permission and a reported measurement purpose. It does not establish delivery,
completed measurement, latch replacement, or personal verification by Ada.

### Extraction and cleaning — rows 1–2

Row 1 language-checks two generated records plus their subjects and returns `compliant: true`. That is a
language result only; the source comparison below supplies the semantic judgment.

Row 2 returns two candidates with no events:

1. `Ada Marlow has not arranged delivery of her Zephyr QX-100.` (58 UTF-16 units), independently
   supported by `turn-1111`.
2. `Bo Winters says the agreement permits sending Zephyr QX-100 to the workshop to measure the gap at
   the latch, not to change the latch. Ada Marlow is only passing on this meaning; she has not read the
   agreement or independently checked Bo Winters’s account.` (255 units).

The report candidate’s `support` and `discourse_frame` contain all three deciding source items: Bo’s
permission statement, the Russian measurement-versus-change clarification, and Ada’s original
read/check limit. The frame intentionally stops the first item before its independent delivery denial,
so that denial is not silently folded into the report record. Its metadata names Ada as outer
`source_speaker`, Bo as the sole inner chain speaker, `basis: source_report`, and product subject/home.

The prose preserves:

- Ada as the person relaying the account and Bo as its inner speaker;
- permission to send Zephyr QX-100 to the workshop;
- the tested property, the gap at the latch;
- measurement rather than changing the latch;
- Ada’s lack of reading the agreement and lack of independently checking Bo’s account.

The source contains no independent receipt/confirmation predicate here, and the candidate does not invent
one. It retains the actual personally performed checking limit instead.

### Repair and retention verification — row 3

There is no repair call. Row 3 has `repair_obligations: []` and verifies the two original extraction
positions. The verifier supplies a three-span audit for the report and returns all three semantic booleans
true with no mismatches. Independently comparing the bytes supports that result: its source/candidate
meanings, action arguments, and qualification scope are materially faithful. The delivery denial is also
source-faithful and remains a separate record.

One typed discrepancy remains in the delivery-denial candidate: its readable proposition is negative
(`has not arranged`), but extraction records `polarity: affirmed`. The built scenario’s parallel denial is
typed `negated`. The selected verifier describes the readable negative proposition accurately yet accepts
the `affirmed` metadata. This does not erase or reverse the stored prose at this stage, but it is a real
metadata inconsistency that could affect polarity-aware filtering or downstream presentation. It is
separate from the report record, whose asserted reported proposition is correctly `affirmed`.

The denial candidate’s frame includes the entire first source item, including the neighboring relay/read
qualification. The verifier correctly treats those clauses as pertaining to Bo’s account rather than the
delivery denial. This over-inclusive source frame does not produce a semantic addition in the retained
text, though it leaves more interpretive work to later frame selection than the built denial’s exact span.

### Ownership — rows 4–5

Both candidates are placed on the existing `page_1` titled `Zephyr QX-100`. The report’s product subject
and the denial’s explicit product object support that placement. Neither decision is `uncertain`, and no
new source identity is inferred.

## Built probe: `v19-held-report`

### Original source meaning

Ada says she has not read the service terms and has no independent confirmation of the report below. She
separately denies that collection of her device has been booked. Bo tells Ada that the Zephyr QX-100 terms
permit sending the device to a service bench to measure the tension of its return spring. The Russian
clarification says this is return-spring tension measurement rather than spring replacement, attributes the
words to Bo in Ada’s retelling, and says the condition is not one Ada personally verified.

This source distinguishes two epistemic limits: Ada has not received/possessed independent confirmation,
and she has not personally verified the reported condition. Neither is equivalent to a global claim that
nobody verified it.

### Extraction and cleaning — rows 1–2

Row 1 returns `compliant: true` for the generated report/denial prose and subjects. Row 2 returns two
candidates and no events:

1. A 374-unit report record: `Bo Winters reportedly told Ada Marlow ...` followed by the complete service
   permission, return-spring tension measurement versus replacement contrast, Ada’s unread-terms and
   no-independent-confirmation sentence, and a separate sentence saying this is Bo’s wording in her
   retelling rather than a condition she verified.
2. A 67-unit independent denial: `Ada Marlow states that no collection of her device has been booked.`

The report is below the unchanged 400-unit limit and uses the V70 short-sentence presentation to preserve
all material qualifications. Its four exact source spans cover Bo’s report, the measurement/replacement
clarification, the retelling-versus-personal-verification clause, and the unread/no-confirmation clause.
Metadata correctly binds Ada as outer source speaker, Bo as inner chain speaker, `basis: source_report`, and
Zephyr QX-100 as subject. The candidate does not turn permission into shipment or completed work.

Unlike the selected report, this record visibly preserves both distinct epistemic forms: `has no independent
confirmation of this report` describes missing received evidence, while `not a condition she verified`
preserves Ada’s lack of a personally performed check. The pronoun in the third sentence is locally bound to
Ada by the preceding explicit subject; it does not create an anonymous or global absence claim.

The booking denial has exact sentence-only support/frame, `basis: self_attested`, and `polarity: negated`.
It does not borrow the report’s service permission or verification limits.

### Repair and retention verification — row 3

There is again no structural repair: `repair_obligations` is empty. The report receives a four-span audit
and both candidates receive all three positive semantic booleans with no mismatches. Those decisions agree
with the original bytes. In particular, the report verifier keeps the roles distinct in
`action_arguments`—Bo is the reported speaker and Ada is the reteller—and keeps both nonverification forms
attached to Ada rather than the terms or an unnamed actor.

### Ownership — rows 4–5

The report is placed on existing product `page_1`. The independent booking denial is sent to its proposed
`memory/ada-marlow` page because extraction chose Ada as its subject; the ownership result is
`selection: proposed`. Both Ada and the device are explicit in the source, so this is not an ownership
invention. It does split a device-related denial from the existing product page, unlike the selected case,
but the record is retained rather than lost or marked uncertain. Whether that person-first placement is
preferable is a retrieval-policy question outside this source-faithfulness stage.

## Stage disposition

Both first scenarios preserve a complete report record plus the independent delivery/collection denial.
The outer/inner speaker chains, permitted sending operation, measured property, negative replacement/change
contrast, and personal epistemic limits survive extraction and semantic retention. The built report
specifically preserves missing independent confirmation separately from lack of personally verifying the
condition. Neither scenario uses structural repair, loses an original position, reports a schema failure,
or receives an uncertain ownership decision in trace rows 1–5.

The selected delivery-denial `polarity: affirmed` value is the only concrete source/typed discrepancy in
this bounded stage. The built person-page versus selected product-page choice is a placement inconsistency,
not a semantic omission. No conclusion about answer generation, retrieval coverage, or public usefulness is
drawn from these retention drafts.
