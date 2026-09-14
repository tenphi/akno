# V39 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. This interim review covers only the first retention and retention-verifier entries of the in-progress selected probe. No fresh held-out output was inspected.

## Selected probe — interim nested-report assessment

The first V39 extraction produces a faithful separate denial, `Ada Marlow states that she has arranged no shipment.` It also produces this nested-report candidate:

> Bo Winters reportedly told Ada Marlow that the Zephyr QX-100 terms allow the device to be sent away to measure hinge resistance, not to replace the hinge; Ada Marlow is only relaying this, has not read the terms, and has received no confirmation.

The normalized verifier candidate has the correct canonical metadata: outer `source_speaker: Ada Marlow`, with Bo Winters once in the inner `chain`. There is no metadata normalization defect.

### Contrast scope is disputed, not a clear invented proposition

V39 generation did not visibly follow the new clause-local instruction. The words `not to replace the hinge` remain inside the grammatical complement of `Bo Winters reportedly told Ada Marlow that ...`. It then closes that complement before the semicolon and places Ada's relay and verification limits outside it. This is materially the same scope shape that V38 rejected.

On reconsidering the complete bilingual source, however, that shape is not unambiguously false:

- Ada first says Bo told her that the terms allow sending the device away to measure hinge resistance.
- Ada then says `Речь шла об измерении сопротивления шарнира, а не о замене шарнира`—the discussion was about measuring hinge resistance, not replacing the hinge.
- Ada immediately says she is only relaying Bo and has neither read the terms nor received confirmation.

The second sentence is grammatically Ada's narration, not a direct quotation attributed to Bo. Yet its placement and `only relaying Bo` continuation strongly support a cohesive reading in which Ada is clarifying the meaning of the same Bo report. The candidate says `reportedly told`, not that Bo used those exact words. On that reading, folding the measurement/replacement contrast into the paraphrased reported content preserves meaning and remains qualified by Ada's relay-only status and lack of confirmation.

A narrower alternative reading remains possible: Bo explicitly supplied only the positive permission for measurement, while Ada independently added the corrective contrast. Under that reading, the candidate overextends Bo's speech scope. The source does not syntactically settle which discourse attachment was intended. I therefore revise the earlier V38 classification from “justified semantic hold” to a disputed interpretation. V39's verifier acceptance is defensible and is not an unsafe factual promotion: both the positive measurement purpose and explicit non-replacement contrast come from the source, and the outer Ada/inner Bo attribution plus nonverification limits are retained. It should not be presented as proof that the new clause-separation instruction worked, because the generated surface did not actually separate the clauses.

### Bounded contract implication

The least ambiguous generated form remains two explicit clauses in one candidate:

> According to Ada, Bo told her that the terms allow sending the device away for hinge-resistance measurement. Ada clarified that the discussion concerned measurement, not replacement; she was only relaying Bo and had not read or confirmed the terms.

That form preserves outer Ada in `source_speaker`, inner Bo in `chain`, and the distinction between Bo's explicitly reported statement and Ada's later clarification without losing their shared report context. The current semantic verifier should continue to judge full meaning rather than impose quotation-level identity. If deterministic evidence is needed that the V39 prompt change took effect, the exposed output does not provide it; the prompt may need a more direct surface-shape requirement or contrastive generation example, while retaining the same verifier, call count, and metadata normalization.

## Completed selected probe

The final selected report retained all six generated records across four cases and returned 29 of 32 answers. The three nulls comprise one justified semantic rejection and two false holds. I found no accepted factual promotion, language error, fabricated value, or material action-role loss. The report contrast retains the disputed interpretation described above.

### Nested report answers

Both the explicit no-shipment assertion and the qualified nested report are retained. All eight answers preserve Ada as outer relay, Bo as inner reported speaker, permission to send the device away for hinge-resistance measurement, the explicit non-replacement contrast, and Ada's lack of reading and confirmation. None implies an actual shipment or booking. Russian `сопротивление петли` is a defensible mechanical translation of hinge resistance in context, although `шарнир` is less ambiguous; it does not change the serviced component or action.

As explained in the interim analysis, attaching the corrective contrast inside the paraphrased Bo report is a disputed discourse reading rather than a clear source invention. The accepted answers repeat that attachment but retain all outer qualification. I do not count them as unsafe promotion, and they do not demonstrate that the new explicit two-clause generation instruction took effect.

### Rejected offer

Retention preserves Ada as the rejecting actor, workshop shipment for power-switch inspection, the rejected disposition, her statement that shipment is not her plan, and the separate absence of booked collection. Seven answers are faithful. The sole null is Russian-query/Russian-answer with explicit history view. Its draft—`Ada Marlow отклонила предложение отправить Zephyr QX-100 в мастерскую для осмотра его выключателя питания`—directly and completely answers which offer Ada rejected. The verifier rejects it only because it omits the additional `sending it is not her plan` clause. The frozen review expectation expressly allows a focused answer to describe the explicit rejection without repeating that redundant no-plan wording. This is a semantic-verifier false rejection caused by treating all source context as obligatory rather than assessing the requested proposition.

### Undated proposal

Retention preserves a tentative, unaccepted proposal to review the service-transfer terms next month relative to the undated source note rather than processing time; the calendar reference is unknown, and Ada accepted no plan and arranged no meeting. Six answers are emitted and preserve these constraints. The localized temporal-status label works in accepted Russian generation: `предварительно`, `предварительный срок`, and equivalent prose appear without the former English `tentative` leak. It does not imply an accepted plan.

The English-query/Russian-answer inferred-planning draft is correctly rejected by semantic verification. `По словам Ada Marlow, предварительно предложено ... План не был принят, встреча не организована` changes Ada's direct actions into unassigned passives. Outer `По словам Ada Marlow` provides attribution to the statement but does not establish that Ada was the proposer, non-acceptor, or non-arranger. The hold follows the same material-agent rule as the competing-hypothesis correction.

The Russian-query/Russian-answer inferred-planning draft is a false deterministic `discourse` hold. It says `Ada Marlow предлагает ... относительно недатированной исходной записи; календарную дату определить нельзя. Она не приняла план и не организовала встречу.` This preserves Ada as every material agent, the tentative proposal, source-relative anchor, unknown date, and nonacceptance/non-arrangement. The trace records a compliant language verdict but no semantic-verifier call, so rejection occurs in the deterministic status/discourse floor. The concrete gap is the proposed-disposition floor: its Russian stem is `предлож`, which recognizes `предложила`/`предложение` but not present-tense `предлагает`. The same missing form also fails the plan-status requirement. Other required qualifications—`предварительно`, the source anchor, unknown calendar date, explicit Ada agency, nonacceptance and no meeting—are present. This is a lexical guard false negative rather than a semantic defect.

### Competing hypotheses

Retention preserves Ada actively considering the damaged-cable and overheated-controller alternatives, their tentative status, lack of evidence for either, and Ada's personal nonselection. All eight answers are faithful. They explicitly retain Ada as the consideration and nonselection actor; no passive or indefinite-personal plural survives. Neutral `The record says Ada Marlow is ... considering` introduces provenance without replacing the embedded activity, demonstrating the intended distinction. Past or present progressive variants do not add a resolution or selected cause.

### Selected disposition

V39 resolves the V38 coverage collapse and removes the untranslated temporal label, but its three remaining nulls expose two different calibration issues. The semantic verifier overrequires adjacent no-plan context in a focused rejected-offer answer, while the deterministic discourse floor rejects one fully qualified Russian proposal for an opaque lexical reason. The passive undated-proposal hold is correct and should remain. No finding supports weakening agent checks, qualification checks, or adding retries.

## Built-package probe

The completed built probe retained both cases and returned all 16 answers. There are no holds to classify. I found no accepted source-content, action-role, qualification, factual-promotion, or language error.

### Open question

Retention faithfully preserves Ada Marlow's still-open question about whether the Zephyr QX-100 agreement includes return of the device after repairs, and that neither coverage nor exclusion is established. All eight answers keep the proposition inside open-question scope. None answers the embedded question, infers a return arrangement, or turns either alternative into contract content.

English answers consistently use neutral record provenance without attributing a writing/recording act to Ada. Russian formulations such as `ни включение, ни исключение ... не установлены` and `остаётся неустановленным, предусматривает ли ... или исключает` preserve the same unresolved alternatives. The wording varies naturally without changing the return-delivery action or agreement scope.

### Assistant report

Retention preserves the generic assistant as source of a preliminary, unverified possibility that servicing Zephyr QX-100 may include checking the indicator twice yearly. It also preserves that the assistant did not study/review the contract or verify the assumption. The typed record remains tentative and source-reported; no answer promotes the possibility to an established requirement.

All eight answers use direct assistant attribution and preserve modality, frequency, and verification limits. Russian answers translate the role and status prose. `верифицировал это предположение` is borrowed but valid Russian technical vocabulary rather than an English-language leak. The masculine possessive/pronoun wording is compatible with the source's masculine first-person `не изучал` and does not identify a new person.

### V39 boundary coverage

The built cases exercise the neutral-provenance rule successfully for an open question, but they do not contain a material consideration/nonselection action whose actor could be erased. They also contain no temporal envelope, so the new localized temporal-status field is not exercised here. The assistant report confirms that unrelated source-report behavior remains stable. These results do not alter the interim selected-report conclusion: the nested-report contrast remains a disputed attachment, and its generated surface did not demonstrate explicit narrator-clause separation.
