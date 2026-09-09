# V62 built report preliminary forensic audit

Scope is only `v18-held-report`, using the original source in [`language-v19-blind-inputs.json`](language-v19-blind-inputs.json) and trace rows 1–35 in [`language-built-reliability-v62-trace.jsonl`](../../../../bench-results/language-built-reliability-v62-trace.jsonl). The final report did not yet exist. I did not inspect later cases or grading receipts, call a provider, or alter runtime files. Counts below describe these trace calls and remain preliminary until the finalized report binds public outcomes.

## Source authority

The original source contains two related but separately scoped statements:

1. Bo Winters says the Zephyr QX-100 service terms permit sending the device to a technician for dial calibration. Ada Marlow is the outer recorder.
2. Ada's Russian restatement says she is relaying only Bo Winters' words, identifies the permitted work as regulator calibration rather than regulator replacement, and says she has neither seen the terms nor received confirmation of the message.
3. Ada separately says she gave no instruction to collect the device.

I read the Russian statement as a source-supplied clarification of the earlier English `dial` referent: regulator calibration is permitted and regulator replacement is excluded. This is supported by the original bilingual source rather than a dictionary inference. The personal verification limits belong to Ada, while the embedded service statement remains Bo's report. Permission to send is not a booking, shipment, performed calibration, or independently verified term.

## Retention and ownership

Trace row 2 produced two records in the new schema order, with qualification/evidence first and `text`, `subject`, `page` last. That observed order does not establish why the content improved or failed.

- `cand_9871bffd0aaba0e1da433fd2` retains the complete report: Ada relays only Bo's words; the terms permit sending Zephyr QX-100 to a technician for regulator calibration rather than regulator replacement; Ada has not seen the terms or received confirmation. It uses `source_report`, asserted/active/affirmed qualification, Ada as outer `source_speaker`, and Bo as the one inner external reporter. Support and frame include both exact original items. `time=null` correctly avoids converting permission into a scheduled event.
- `cand_1656eaeb0d138f703c2ce6fd` separately retains Ada's direct denial that she gave an instruction to collect Zephyr QX-100. The source's `it` has the device and named product as its visible antecedent. The record uses self-attested, asserted/active, negated qualification, and its exact frame is the first source item.

Trace row 3 accepted both only after complete-source semantic verification. For the report, all frame spans were accounted for and all three semantic dimensions were true; its comparison kept Bo/Ada roles, device, technician destination, calibration/replacement contrast, and both personal limits. For the denial, the verifier kept Ada as the actor who did not give the instruction and the device as the collection object. There was no cleaner hold and no repair call.

Trace rows 4–5 independently routed both records to the existing Zephyr QX-100 page. The first is plainly product-centered. The second has `subject=Ada Marlow`, but its readable proposition is about collection of the product whose antecedent is in the exact source; routing it to the product page does not change the actor or assert that Ada owns it. The proposed title shown to the ownership call remains advisory. I found no ownership-based source expansion in the resulting evidence.

The retained set is complete for this source: the report and the independent no-collection-instruction denial both survive. The focused answer path retrieves/cites only the report record as E1, which is sufficient for the report question and does not erase the separately retained denial.

## Eight answer attempts

All nonempty choices were schema-valid, their language checks returned `compliant=true`, their answer calls returned complete JSON, and their answer-verifier calls returned complete verdicts. Complete-record verifier inputs omit the query as designed and contain the immutable answer segments, E1 qualification, retained excerpt, and all five original-frame anchors. The query remains present in generation. E1 selection was true in every verifier verdict.

1. **Rows 6–9, English query / English answer:** exact copy mode. The public text preserves Ada as reporter, Bo as inner source, permitted sending to a technician, regulator calibration versus regulator replacement, and Ada's two personal limits. All semantic dimensions and selection were true.
2. **Rows 10–13, English query / Russian answer:** complete translation. It preserves the same roles, action, object, corrective contrast, and personal limits. All dimensions and selection were true.
3. **Rows 14–15, English query / English answer:** the generator returned no blocks and named “a service report specifically about dial calibration” as missing. No language or semantic verifier call followed because there was no draft. This is a writable-source false abstention under the source-clarification reading above: the bilingual source and retained E1 do answer the question.
4. **Rows 16–19, English query / Russian answer:** complete translation, with the record reading explicitly giving the Russian clarification priority over the earlier dial wording. The draft is source-faithful and all dimensions and selection were true. The verifier's private `source_context` ends with the malformed fragment `received confirmation-of`; its comparison, anchor details, booleans, and public result still preserve the actual no-confirmation limit. This is private fallible narration, not added public content.
5. **Rows 20–23, Russian query / English answer:** exact copy mode. The target answer language is English despite the Russian query; the language check passed and the copy is source-faithful. All dimensions and selection were true. The private `source_context` contains a stray `received2` fragment, while the qualification detail and comparison correctly state no confirmation.
6. **Rows 24–27, Russian query / Russian answer:** complete translation. The public text preserves the full record and all verifier gates were true. The private `source_context` trails off at `received independent`, but its qualification detail correctly preserves Ada's lack of confirmation.
7. **Rows 28–31, Russian query / English answer:** exact copy mode. The answer is the same source-faithful E1 copy and all gates were true. Its private `source_context` contains `confirmation of12`; the anchored comparison and qualification fields remain correct.
8. **Rows 32–35, Russian query / Russian answer:** the complete translation itself preserves regulator calibration, excluded regulator replacement, Ada/Bo reporting roles, and Ada's two verification limits. The verifier nevertheless sets `object_and_mechanism.relation=changed`, `proposition_supported=false`, and `action_arguments_preserved=false`, while leaving qualification and selection true. Its `source_context`, `source_meaning`, and mismatch choose only the English `dial calibration` wording and treat the translated regulator calibration as a changed object, despite the supplied Russian clarification at `E1_da7fc5167671_4`. The runtime therefore correctly withholds under the returned negative verdict, but this is a false hold of a source-faithful draft under the complete bilingual source reading.

Thus the opening trace contains six source-faithful nonempty drafts passing every gate, one generator empty-block false abstention, and one source-faithful draft withheld by a negative object/mechanism verdict. There is no accepted unsupported, qualification-losing, role-reversing, or wrong-language answer in these rows. Both withheld cases still lose useful coverage because the source can answer them.

## Guard and availability observations

- Retention, retention verification, both ownership calls, all seven nonempty language checks, all eight answer calls, and all seven invoked answer verifiers report successful transport. `schemaError=false` wherever the trace records that field. The empty-block attempt is a semantic generation choice, not a typed transport failure.
- Every complete-record answer verifier received the five original-frame anchors, including both the English dial wording and Russian regulator clarification. The false hold is therefore a returned interpretation, not missing frame bytes or a citation-selection failure.
- The malformed suffixes in four private `source_context` strings warrant diagnostic attention, but the JSON was complete and the corresponding anchored details and verdicts were coherent. They do not by themselves establish truncation, provider failure, or a public semantic defect.
- No inference about the effectiveness of the V62 response-field ordering follows from this single result. The trace establishes only that the endpoint accepted and returned the ordered shape.

## Preliminary disposition

For this case, retention and ownership are source-faithful and complete. Six of eight answer attempts appear publishable and faithful. Two are unjustified writable-case abstentions: one empty selection at rows 14–15 and one negative semantic hold at rows 32–35. The latter's exact mechanism is the verifier's failure to apply the supplied Russian clarification when comparing regulator calibration to the earlier English dial wording. Final public counts, bytes, and case availability await the finalized V62 report.
