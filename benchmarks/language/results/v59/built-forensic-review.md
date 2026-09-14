# V59 built-package source-first forensic review

## Scope and disposition

I reviewed the finalized [`bench-results/language-built-reliability-v59.json`](built-reliability.json), [`bench-results/language-built-reliability-v59-trace.jsonl`](../../../../bench-results/language-built-reliability-v59-trace.jsonl), and [`tmp/language-built-output-packet-v59.json`](language-built-output-packet-v59.json) against the four original V19-development/V18-held sources. I did not inspect an independent grading receipt, call a provider, retry any row, or modify runtime code.

My source-first result is:

- **24/32 published answers**, all 24 useful and source-faithful on this review.
- **8/32 nulls**, all in `v18-held-report`. Each is an unjustified writable-case abstention because the original source supplies the requested report, although the runtime correctly withheld the particular bad retained draft.
- **No accepted source-entailment, actor/action, qualification, language, disposition, or factual-promotion error** among the 24 published answers.
- **Complete expected retained sets in 3/4 cases.** Seven records were written and one proposed report record was held. The benchmark's typed `usefulRetentionCoverage=4/4` recognizes some useful content in every case, but the report case does not preserve its deciding report; source-first complete-set coverage is therefore 3/4.
- **Query-useful retrieval in 3/4 cases.** The report query retrieves a qualified but unrelated no-collection-instruction record. The question, rejected-offer and alternatives cases retrieve the records needed for their focused questions.
- **No typed availability or operation failure:** 0/4 case availability failures, 0/32 answer-operation failures, no degraded retention or answer row, no language-policy rejection, and no source-byte change. The eight nulls are `no_eligible_evidence`, not outages.

## Case evidence

### `v18-held-report`: correct bad-draft hold, incomplete retention, eight writable nulls

The source contains two independent durable meanings:

1. Bo Winters reports that the Zephyr QX-100 terms permit sending the device to a technician for dial calibration. Ada's Russian restatement says she is relaying only Bo's words and clarifies regulator calibration rather than regulator replacement. Ada has not seen the terms and **received no confirmation** of the message.
2. Ada has given no instruction to collect the device.

Trace row 2 extracts both. The main report draft otherwise preserves the bilingual clarification, Bo as inner reporter, Ada as outer recorder, permitted sending, calibration rather than replacement, and lack of firsthand reading. Its final qualification says Ada “has not seen the terms or **confirmed this message**.” The source says `подтверждения этому сообщению не получила`: she **did not receive confirmation**. These are different epistemic actions. A person can fail to receive confirmation yet independently confirm something, or receive confirmation without personally confirming it.

Trace row 3 identifies this exact difference and sets all three semantic dimensions false. That is a sound rejection of the generated draft, not a false semantic hold. The separate record—“Ada Marlow says she has given no instruction to collect the Zephyr QX-100.”—passes and is written.

The consequence is still a case-level coverage failure. All eight query combinations retrieve only the collection-instruction record. Context activation selects zero evidence for the requested dial/regulator-calibration report, so answer generation and verification are never called and every row returns `no_eligible_evidence`. The original source supports a faithful answer in both languages; all eight nulls are unjustified writable-case abstentions even though withholding this particular draft is correct.

The V59 answer instruction about a query repeating the earlier source term is not exercised here. Retention correctly interprets dial/regulator as one source-clarified referent, but the report does not survive long enough for query-time selection or answer rendering.

Smallest supported next scope: preserve the confirmation predicate and experiencer before semantic verification. A narrow generated-only, source-conditioned rejection floor can distinguish Russian `подтверждения ... не получила` / “received no confirmation” from “did not confirm,” attach Ada to the correct action, and route the existing structural repair call. It must not weaken the verifier or treat the original candidate as evidence. A prompt clarification alone is cheaper but the V59 extraction already demonstrates that general epistemic guidance can still lose this action role.

### `v18-held-question`: complete two-record set and eight useful answers

The source records Ada's unresolved question about whether the service agreement includes preventive filter cleaning, followed by her personal statement that she still has no answer and the note establishes neither inclusion nor exclusion.

Trace rows 6–7 produce and accept two records:

- the open question, attributed to Ada; and
- Ada's continued lack of an answer together with the note's neutral inclusion/exclusion scope.

No repair call occurs in this case. Both initial candidates pass structural and semantic verification directly, and `repair_obligations` is empty. This matters because V59's original-index repair behavior cannot be inferred from this case.

The questions view retrieves the first record for the focused query. Rows 10–41 render all eight combinations: English output uses exact complete-record `copy`; Russian output uses complete-record `translate`. Every answer names Ada, Zephyr QX-100, the service agreement, preventive cleaning and the filter, and keeps the content an unresolved/open question. Omitting the separately retained longer no-answer statement is acceptable for this focused “which question” query: “unresolved/open question” supplies the relevant non-answer status and none of the outputs asserts inclusion or exclusion.

I find all eight useful and source-faithful. Explicit versus inferred view and English versus Russian query wording cause no semantic change.

### `v18-held-rejected`: V59 repair binding works; complete three-record set and eight useful focused answers

The source establishes three separate meanings: Ada declined/rejected the offer to send Zephyr QX-100 to the service centre for thermostat measurement; she has no plan to send it under that offer; and no handover has been booked.

Trace row 43 extracts all three. The rejected decision at original position 0 passes immediately. Positions 1 and 2 are structurally held because their prose claims the Zephyr identifier while their initial frames contain only pronoun/device references.

Trace row 45 exercises the V59 request precisely:

- `repair_targets[0].candidate_index=1` contains only the exact no-plan draft and its identifier/frame issue.
- `repair_targets[1].candidate_index=2` contains only the exact no-booking draft and its issue.
- `read_only_admitted_context` contains position 0's rejected decision and does not label it rejected repair material.
- The response returns the same indices 1 and 2, preserves each proposition, and adds the exact offer/device antecedent span to its deciding frame.

Trace rows 46–47 show the two existing verifier batches. Position 1's repaired no-plan record receives position 1's exact original as its obligation; position 2's no-booking record separately receives position 2's original. Both pass full-source semantics, as does the admitted rejection. No sibling proposition is copied, no original index is compacted, and no immutable candidate changes.

All three records are written. The focused query retrieves and selects the rejected decision. Rows 51–82 produce eight complete-record copy/translation answers. Each preserves Ada as rejecting actor, sending Zephyr QX-100 to the service centre, thermostat measurement as purpose, and rejected/not-accepted disposition. Russian “измерение термостата” and “измерение параметров термостата” are ordinary faithful renderings of the source's “thermostat measurement.”

The focused answer does not repeat the separately retained no-plan and no-booking facts. That is a valid scope choice for “Which ... offer did Ada decline?” and the source expectation explicitly permits a focused rejection answer without redundantly restating no plan. I find all eight answers useful and source-faithful.

### `v18-held-alternatives`: complete one-record set and eight useful answers

The Russian source states that Ada considers two competing explanations for Zephyr QX-100 failures: a loosely inserted internal connector or a faulty temperature probe. Both remain hypotheses, neither has evidence, and Ada selected neither cause.

Trace rows 84–85 retain one complete tentative record containing the two mechanisms and their shared qualifications. The translation “loosely inserted internal connector” preserves `неплотно вставленный внутренний разъём`; “faulty temperature probe” preserves `неисправный температурный зонд`. The record keeps Ada as the considering and nonselecting actor, applies lack of evidence to both alternatives, and does not promote either to an established cause.

Rows 87–118 use exact English copy or complete Russian translation. All eight published answers preserve both alternatives, tentative/competing status, the common absence of evidence, and Ada's personal nonselection. I find no connector-mechanism, actor, scope, or language error.

Trace row 110 contains a malformed private verifier `source_context` ending in the mixed-script fragment `selected no원`. The same verdict's anchored actor, object/mechanism, qualification, comparison fields, booleans, and the published Russian answer are complete and correct. This is a fallible diagnostic narrative defect, not published answer content, source authority, a schema failure, or an accepted language error. It should remain observable; it did not change the result in this row.

## Rendering, verification and availability mechanics

The 24 nonnull rows use the one-record renderer consistently: 12 English outputs choose `copy` of the complete current readable record and 12 Russian outputs choose `translate`. Every rendering-choice record is schema-valid, every language check returns compliant, and every answer block passes the ordinary local guards plus mandatory source alignment and semantic verification. All verifier outputs select the cited retained excerpt and report no unselected content or mismatch.

The private frames constrain meaning without becoming visible answer material. Citations point to the selected retained record, not to adjacent source-frame facts. This is especially clear in the question case, where the answer selects the shorter open-question record while the independent no-answer/note-neutrality record remains stored, and in the rejected case, where the focused rejected-decision record does not expand to the two neighboring negative records.

The configured diagnostic ceilings are 2,400 tokens for answer and retention. All model calls complete successfully; there is no invalid schema, truncation, retry, or typed degradation. The new Russian `установить нельзя` source-clock branch is not exercised by these four cases, so V59 built evidence says nothing about its live semantic reliability beyond the completed offline boundary checks.

## Bounded conclusion

V59 fixes the observed repair-position ambiguity in the case that exercises it: the two rejected-offer repairs remain bound to their own original propositions through separate verifier batches. The remaining built failure is earlier and independent of that transaction design: report extraction changes who performs the confirmation action, and the sound verifier consequently removes the only query-relevant report. Preserve the verifier and address that predicate/actor loss before expecting the new query-clarification instruction to affect this case.
