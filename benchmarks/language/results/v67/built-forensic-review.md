# V67 built-package source-first forensic review

## Scope and method

This review covers frozen runtime `ac1059e`, the four declared V20-development cases in [`language-built-reliability-v67.json`](built-reliability.json), the 116 call records in [`language-built-reliability-v67-trace.jsonl`](../../../../bench-results/language-built-reliability-v67-trace.jsonl), and the original-source/public-output packet [`language-built-output-packet-v67.json`](language-built-output-packet-v67.json). I read each original source before its retained records and answers. Runtime booleans, private readings, benchmark expectations, and verifier narratives were treated as fallible diagnostics rather than source authority. I did not inspect an independent grading receipt.

The eight query coordinates in each case are zero-based and ordered:

| Query index | Query language | Answer language | View |
| ---: | --- | --- | --- |
| 0 | EN | EN | inferred |
| 1 | EN | RU | inferred |
| 2 | EN | EN | explicit |
| 3 | EN | RU | explicit |
| 4 | RU | EN | inferred |
| 5 | RU | RU | inferred |
| 6 | RU | EN | explicit |
| 7 | RU | RU | explicit |

## Disposition

| Case | Complete useful retained set | Published answers | Source-faithful published answers | Writable nulls | Principal loss |
| --- | --- | ---: | ---: | ---: | --- |
| `v19-held-report` | Yes, 2 records | 8/8 | 8/8 | 0 | None |
| `v19-held-question` | Yes, 1 record | 7/8 | 7/7 | 1 | One RU draft correctly rejected for losing the exact named attribution |
| `v19-held-rejected` | Yes, 2 records | 8/8 | 8/8 | 0 | Initial booking candidate needed one structural frame repair; no final loss |
| `v19-held-alternatives` | No, 0 records | 0/8 | n/a | 8 | Correct tentative repair was falsely rejected by a whole-record reading that contradicts Akno's declared embedded-hypothesis commitment semantics |

My source-first count is therefore 23 faithful published answers out of 32 observations, with no accepted material source, qualification, language, or promotion error. All nine nulls are losses on source-writable questions: one is a correct rejection of the particular bad draft, while eight result from a false retention-verifier hold on the alternatives record. Three of four cases have complete useful retained sets. The report's typed metrics agree on 23 answers, one `draft_rejected`, eight `no_eligible_evidence`, zero case availability failures, zero answer-operation failures, and zero source-byte changes.

There is no provider/schema failure in this run. Every trace entry has `ok:true` or is a non-model `rendering-choice`; no entry reports a schema error or failure reason. The isolated output ceilings are 2,400 tokens for retention and answer roles. Private verifier strings sometimes contain stray non-English or zero-width characters, but they parsed and are neither public prose nor evidence. I found no public meaning that depends on those malformed private fragments.

## Case evidence

### `v19-held-report` — complete retention and eight faithful answers

The source establishes two independent propositions:

1. Ada Marlow says no collection of her device has been booked.
2. Ada relays Bo Winters's statement that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension. Her Russian clarification fixes the operation as measurement rather than spring replacement and identifies the content as Bo's words in her retelling, not a condition she verified. Ada has not read the service terms and has no independent confirmation of the report.

Trace rows 1–5 produce, verify, and place two records:

```text
Ada Marlow states that no collection of her device has been booked.

Bo Winters reportedly said that the Zephyr QX-100 terms permit sending it to a service bench to measure the tension of its return spring, not replace that spring; Ada Marlow has not read the service terms, has no independent confirmation of this report, and has not personally verified the reported contractual condition.
```

The first safely retains the source's generic possessive device and has `subject: unresolved`; it does not infer that a collection is booked or performed. The second preserves the nested speakers, permission rather than performance, service-bench destination, measured property, measurement/replacement contrast, and all three personal limits. Both candidates receive complete source frames and all-true retention verdicts. No repair is used.

Answer paths occupy trace rows 6–37: query 0 rows 6–9, query 1 rows 10–13, and so on in four-row groups through query 7 rows 34–37. Every query retrieves only the relevant report record. EN answers use exact current-record copy; RU answers use the translation branch. All eight retain a visible Ada source heading, Bo as the inner speaker, Zephyr QX-100, permission to send to a service bench, return-spring tension measurement rather than replacement, and Ada's lack of reading, independent confirmation, and personal verification. Every final alignment is selected and `preserved` on actor, object/mechanism, and qualification.

The query-7 RU wording `Bo Winters, по имеющимся сообщениям, сказал` initially raised a provenance concern because it is more diffuse than a singular personal retelling. In the complete published sentence, however, the exact heading `**По словам Ada Marlow:**` scopes the statement, Bo remains the inner speaker, and the body separately preserves Ada's lack of confirmation. I treat this as awkward rendering of “reportedly,” not a material third source or global report claim. That judgment is the one residual interpretation uncertainty in the eight report answers.

### `v19-held-question` — complete record, seven faithful answers, one correct bad-draft hold

The source says Ada has an open question about whether preventive coolant top-up for Zephyr QX-100 is included in the service contract. Ada has no answer, and neither inclusion nor exclusion is established. It does not answer the embedded coverage question or assert an external asking/recording action.

Trace rows 38–41 extract, verify, and place one complete question record:

```text
Ada Marlow has an open question about whether preventive coolant top-up for Zephyr QX-100 is included in the service contract; she has no answer, and neither inclusion nor exclusion of this service is established.
```

Queries 0 and 2–7 publish faithful complete-record copies/translations. They preserve Ada as the person with no answer, the coolant-top-up service and contract-inclusion question, and the unresolved inclusion/exclusion pair. The Russian outputs at indices 3, 5, and 7 retain `Ada Marlow` exactly and use local ellipsis or an explicit pronoun without changing the epistemic subject.

Query 1 is the sole `draft_rejected` observation. Its path is trace rows 46–48:

- row 46 supplies the record for RU translation;
- row 47's language check accepts the generated prose;
- row 48 returns `**Открытый вопрос:** Ада Марлоу задаётся вопросом ...`.

The model transliterates `Ada Marlow` to `Ада Марлоу`. The answer result records `generated_blocks:1`, `passed_guards:0`, `rejection_counts:{"attribution":1}`. There is no answer-verifier trace because the local attribution guard rejects the block first. That is a correct rejection of this draft: the exact protected name/source attribution was not preserved. It is still an unjustified case-level abstention under the useful-answer gate because the source and retained record support a faithful RU answer, demonstrated by the other three RU paths.

### `v19-held-rejected` — complete two-record retention after position-preserving repair; eight faithful answers

The source establishes Ada's rejection of an offer to send Zephyr QX-100 to a laboratory for rotor-balance measurement, her lack of a plan under that offer, and a separate absence of a booked pickup. The offered shipment is rejected rather than accepted; no shipment, pickup, or measurement is said to occur.

Trace rows 73–79 show the complete retention path. Initial extraction at row 74 returns:

```text
[0] Ada Marlow declined an offer to send Zephyr QX-100 to a laboratory for a rotor-balance measurement and has no plan to send the device under that offer.
[1] Ada Marlow states that no pickup of Zephyr QX-100 has been booked.
```

Candidate 0 is admitted unchanged. Candidate 1 is initially held `discourse_uncertain` because its frame also includes the independent sentence `The offered shipment was rejected rather than accepted.` The single repair call at rows 75–76 targets original zero-based `candidate_index:1`, keeps its text and metadata, and narrows its frame to the booking denial plus the exact Zephyr antecedent. It does not replace the booking proposition with candidate 0 or change its original position. Row 77's final verifier accepts both candidates; rows 78–79 place both on the existing Zephyr page. This is a successful structural repair, not a semantic retry.

Trace rows 80–111 contain the eight answer paths. Retrieval appropriately selects only the rejected-offer record for the focused offer query; the separately retained no-pickup record need not be repeated in that answer. EN is exact copy. RU preserves Ada as decliner, Zephyr QX-100, laboratory destination, rotor-balance measurement, rejection, and no plan under the offer. `не планирует отправлять ... в рамках этого предложения` is a natural rendering of the source's scoped “I have no plan to send the device under it”; it does not claim an actual booking or performance. All eight blocks pass the local guards and final three-dimension source alignment.

### `v19-held-alternatives` — correct tentative tuple falsely rejected under a whole-record interpretation

The source directly asserts that Ada is discussing two competing Zephyr QX-100 fault hypotheses: a slipping drive belt or a jammed cooling fan. Both hypotheses are preliminary, neither has supporting evidence, and Ada has not selected a cause. The discussion act is actual; the embedded hypotheses remain tentative and unselected.

Trace rows 112–116 expose the complete loss mechanism:

1. Rows 112–113 generate a source-faithful candidate with `commitment:"asserted"`:

   ```text
   Ada Marlow is discussing two competing preliminary hypotheses about a Zephyr QX-100 fault: a slipping drive belt or a jammed cooling fan; neither hypothesis has supporting evidence, and Ada Marlow has not selected a cause.
   ```

2. The deterministic cleaner rejects that initial candidate as `noncanonical_without_context`: speculative wording is present while the record metadata is asserted. Under Akno's declared contract, this local hold is correct even though the prose is source-faithful. `QUALIFICATION_CONTRACT` requires competing unconfirmed hypotheses to use tentative or hypothetical commitment even when the readable sentence confidently states that the user discussed them.
3. Rows 114–115 run the one structural repair at original `candidate_index:0`. The repair keeps all prose, actors, alternatives, unsupported status, and nonselection, and correctly changes commitment to `tentative` for the embedded hypotheses.
4. Row 116's mandatory source verifier returns `proposition_supported:true`, `action_arguments_preserved:true`, `qualification_scope_preserved:false`. Its mismatch says the tentative field broadly qualifies the whole claim instead of only the hypotheses. That interpretation is understandable from an undifferentiated record-level field, but it is wrong under Akno's explicit semantics. The same verifier prompt says: “Tentative commitment qualifies the hypotheses, not whether the source directly asserted its discussing act. Do not require asserted commitment for that coupled record merely because the discussion itself is asserted.” The repaired tuple follows that rule. Row 116 is therefore a false semantic hold, surfaced by the report as verification-stage `discourse_uncertain`.

No record is placed, so all eight queries return `no_eligible_evidence` without generation or answer-verification calls. Those are not availability failures and do not validate an absence answer; they are eight source-writable coverage losses caused by the retained representation path.

The concrete production defect is the final verifier's failure to apply the declared two-layer commitment rule. The initial asserted metadata is not the intended representation; the tentative repair is. `semanticRecordScope` supplies only the generic active-validity definition for this record and has no tentative definition, so the per-candidate payload leaves the model to reconcile the record-level field with the more distant system instruction. This explains the observed interpretation gap without making the private narrative source authority.

## Bounded correction supported by this evidence

The smallest coherent correction is to add a tentative entry to the existing per-record `semanticRecordScope`, expressing the already authoritative two-layer convention next to the submitted candidate, then test it with the same mandatory source comparison. A suitable definition would say, in substance:

> Tentative marks the selected uncertain content. When readable prose and source explicitly separate an asserted report/discussion act from tentative embedded propositions, compare the act and embedded content independently; the label neither proves nor hedges the outer act by itself.

This is bounded because `semanticRecordScope` is explicitly a definition of submitted labels, never evidence. It can accompany the correctly repaired tentative record into the existing verifier without adding a field, model call, retry, acceptance shortcut, or frame expansion. It does not relax the three booleans. The verifier must still reject a changed activity (`discussing` → `considering`), a source that only tentatively suggests discussion, established alternatives, missing unsupported status, lost personal nonselection, wrong actors/objects, or factual promotion.

There is a material limitation: `semanticRecordScope` sees only kind/commitment/disposition, not the source or clause structure. A generic sentence must not tell the verifier that every tentative record contains an asserted outer act. The wording therefore has to be conditional on an explicit distinction in both source and candidate, and tests must include ordinary tentative propositions where the label still qualifies the whole proposition. The current source verifier already contains equivalent authoritative guidance, so a record-local definition is an attention/locality correction; it cannot be claimed to solve model behavior before an exposed probe.

The meaningful positive regression should use this exact coupled shape: asserted source discussion, two tentative unsupported alternatives, and named nonselection, with candidate commitment `tentative`. Negative controls should change discussion to considering, make the discussion itself merely tentative in the source, promote either hypothesis, omit the lack of evidence or personal nonselection, and exercise an ordinary tentative proposition whose whole content remains tentative. The initial asserted candidate should continue to fail the deterministic noncanonical floor; the correctly repaired tentative candidate should proceed to full verification. No split-record redesign is justified by this evidence.

## Limits of this forensic conclusion

- This is a four-case exposed diagnostic, not fresh held-out evidence.
- The 23 published answers were judged against their exact originals; positive runtime verdicts did not establish their correctness.
- The single diffuse RU report phrase is documented above rather than silently normalized into a definite error or definite ideal rendering.
- Correct rejection of the question's bad transliterated draft does not make that source-writable observation a justified abstention.
- The row-116 whole-record interpretation is preserved in the initial forensic artifact, but it is not the governing Akno label semantics. The repaired tentative tuple is correct under the explicit retention and verifier contracts, so its rejection is a false hold.
