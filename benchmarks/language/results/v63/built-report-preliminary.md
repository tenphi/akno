# V63 built report preliminary forensic review

This is an independent source-first snapshot of the first built case while the declared V63 probe was still running. It uses the original structured source and the opening rows of [`language-built-reliability-v63-trace.jsonl`](../../../../bench-results/language-built-reliability-v63-trace.jsonl). It does not use an output-grading receipt. Final publication and abstention classifications are intentionally deferred to the finalized report.

## Original propositions and retention

The source contains three materially distinct propositions:

1. Bo Winters says the Zephyr QX-100 service terms permit sending the device to a technician for dial calibration.
2. Ada Marlow says she gave no instruction to collect the device.
3. Ada relays a Russian clarification: calibration of the regulator is permitted, regulator replacement is not; she has neither seen the terms nor received confirmation of that message.

Trace row 2 extracts two candidates. Candidate `cand_2a68d0e0b58cd467769a7403` joins propositions 1 and 3 as a Bo-attributed service-terms report and explicitly retains regulator calibration, the exclusion of regulator replacement, Ada's lack of personal examination, and Ada's lack of confirmation. Its support and frame each contain both original items. Candidate `cand_1656eaeb0d138f703c2ce6fd` separately retains Ada's collection-instruction denial from the first item. This separation avoids attaching Ada's self-attested denial to Bo's report.

Trace row 3 admits both candidates. For the report candidate, the verifier's `source_meaning`, `candidate_meaning`, `action_arguments`, and `qualification_scope` distinguish Bo's reported claim from Ada's personal limits; all three booleans are true and there are no mismatches. For the denial candidate, all three booleans are also true and the verifier explicitly limits the claim to Ada's instruction rather than inferring that no collection occurred or that no other person gave an instruction. Rows 4-5 place both candidates on the existing Zephyr QX-100 page. No extraction, verification, placement, provider-schema, or typed availability loss is visible in these opening retention rows.

## Opening answer attempts

The first eight generated report attempts all select retained evidence `E1`, the complete service-report record. English attempts choose exact `copy`; Russian attempts choose `translate`. The public candidate prose consistently says that Bo's report concerns regulator calibration rather than regulator replacement and retains both Ada-specific limits. The four English copy attempts reaching trace rows 9, 16, 23, and 30 receive source alignments with `actor`, `object_and_mechanism`, and `qualification` all `preserved`, all three semantic booleans true, `selected_by_retained_excerpt=true`, and no mismatches.

The private record readings generally resolve the query's “dial” wording through the Russian regulator clarification. Those readings are fallible diagnostics; source fidelity here follows from the public prose and anchored original-frame comparison, not from the readings alone. One reading says the source does not establish that Ada personally “recorded” the report, while the materialized retained label is “Reported by Ada Marlow.” That private ambiguity does not itself establish either a public error or a hold.

At this snapshot, the trace showed Russian translated candidates but no corresponding answer-verifier rows. That absence cannot be classified from an in-progress trace: it may represent a local hold, a later trace event, or incomplete flushing. The finalized report is required to determine which attempts were published and to name any exact deterministic reason.

No accepted source, actor, object, qualification, or language defect is established by this preliminary snapshot. This statement is provisional and limited to the observed first-case rows.
