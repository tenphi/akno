# V38 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. I compared the generated material with the invented source passages rather than treating runtime verdicts as ground truth. No fresh v18 output was inspected.

## Built-package probe

The built probe retained both cases and produced 16 of 16 answers. I found no accepted source-content error, changed action role, factual promotion, qualification loss, wrong-language answer, or disclosure. There were no retention or answer holds to classify.

### Open question

The retained record faithfully represents Ada Marlow's unanswered question about whether the Zephyr QX-100 agreement includes return of the device after repairs. It keeps both alternatives unresolved: neither coverage nor exclusion is established. All eight answers describe the recorded/open question and preserve the lack of an answer. None asserts that return delivery is included, excluded, arranged, or performed.

The English renderings use neutral record provenance (`The recorded open question attributed to Ada Marlow ...`) rather than inventing a separate recording action by Ada. The Russian renderings are natural enough and preserve question scope. Phrases such as `ни включение, ни исключение ... не установлены` and `ни наличие покрытия, ни исключение ... не установлены` differ stylistically but retain the same two unsettled alternatives.

The raw extraction included Ada redundantly in an attribution chain as well as `source_speaker`; final retained material exposes the correct single authoritative attribution. This does not leak into answer prose or create a nested reporter.

### Assistant report

The retained record preserves the assistant as the source of a preliminary, unverified possibility that servicing Zephyr QX-100 may include checking the indicator twice yearly. It also preserves that the contract had not been examined and the assumption had not been checked. The typed record remains tentative, active, affirmed, and `source_report`; nothing turns the possible servicing condition into an established requirement.

All eight answers retain the assistant attribution, modal possibility, frequency, and verification limits. Generic `assistant` is translated as `ассистент` in Russian answers. English and Russian status descriptions remain presentation wording and do not replace or contradict the typed qualification. I found no accepted grammar issue that changes the proposition.

### V38-specific boundaries

Neither built case contains a personal cause-nonselection proposition or a source-relative calendar expression. The new agency floor, plural/combined-agent exclusions, source-clock syntax, and narrative-backshift guidance therefore were not exercised by this probe. Their absence here should not be reported as live confirmation of those paths; it is only consistent with the expected no-op behavior on unrelated question and assistant-report records.

## Selected probe

The selected probe wrote five of six generated candidates across four cases and returned 22 of 32 answers. Eight nulls are downstream of one material retention hold, one null is a justified language-policy rejection, and one is a semantic-verifier false rejection. The raw report's provisional `usefulRetentionCoverage: 4/4` is not an independent semantic judgment: the nested-report case is materially incomplete despite retaining its separate no-shipment denial.

### Nested report: justified hold after attribution-scope corruption

The original has three distinct layers:

1. Ada directly says she has arranged no shipment.
2. Ada says Bo Winters told her that the terms allow the device to be sent away to measure hinge resistance.
3. In Ada's following Russian clarification, Ada says the discussion concerned measuring hinge resistance rather than replacing the hinge, that she is only relaying Bo, and that she has neither read the terms nor received confirmation.

The generated main candidate collapses layers 2 and 3 into `Ada Marlow reports that Bo Winters said the ... terms allow ... measure hinge resistance, not to replace the hinge`. Grammatically, `not to replace the hinge` is now inside what Bo said. The original does not explicitly attribute that corrective contrast to Bo; it is Ada's clarification of the discussion. Raw extraction initially names Bo as `source_speaker` with no chain. Before verification, `cleanAttribution` correctly normalizes the structured outer source to `source_speaker: Ada Marlow` and retains Bo once in the inner chain. The verifier therefore receives correct attribution metadata and rejects the remaining error in readable proposition scope.

The retention verifier correctly rejects this candidate for changed proposition and qualification scope. This is a genuine safety hold, not a verifier false negative. Because the substantive report is then absent, all eight report queries correctly reach `no_eligible_evidence`; answering them from the surviving no-shipment line would be unsupported.

The retained denial itself is faithful: `Ada Marlow states that she has arranged no shipment, in the same account that mentions the Zephyr QX-100 terms.` It avoids attaching Zephyr as the shipment object while preserving enough neighboring context for routing. It does not claim a shipment, booking, or plan.

A bounded generator correction should require proposition-local attribution inside one complete candidate: preserve the exact speaker for each adjacent clause rather than extending an inner `SOURCE said that ...` complement across a later narrator clarification. A faithful shape here is: `According to Ada, Bo told her that the terms allow sending the device for hinge-resistance measurement. Ada clarified that the discussion concerned measurement, not replacement; she was only relaying Bo and had not read or confirmed the terms.` The normalized attribution should remain `source_speaker: Ada Marlow` with Bo once in the inner chain; outer Ada must not be duplicated in that chain. This changes extraction guidance only; it should retain the same structural and semantic verification, one repair transaction, and call count.

### Rejected offer

Both records are faithful. The main record names Ada as the rejecting agent, preserves workshop shipment for power-switch inspection, and states that sending the device was not her plan. The companion record preserves that collection had not been booked and that the offer was declined. All eight answers correctly identify Ada as the rejecting actor and keep the rejected lifecycle; focused answers that omit the redundant no-plan sentence remain source-entailing and nonactionable. I found no accepted actor, object, status, or language error.

### Undated proposal

Retention preserves the tentative proposal, next month relative to the undated note rather than processing time, unknown calendar month, and absence of an accepted plan or arranged meeting. Seven answers preserve all of those constraints. The V38 source-clock forms work in live prose, including Russian `этот срок отсчитывается от недатированной заметки` and quoted `следующий месяц ... отсчитывается от` constructions.

English `had not accepted` backshift is accepted when it describes the same recorded proposal and adds no date or earlier cutoff. This is the intended narrative-tense behavior and does not alter the source's present-perfect nonacceptance here.

The only null is a justified pre-verifier language hold. The generated Russian answer contains the literal English label `tentative-предложение`; the language checker returns `compliant:false`, so no answer is emitted. All names and the product identifier were otherwise valid protected references, but the untranslated status word is neither a name nor source-exact quotation.

### Competing hypotheses and agency floor

Retention is complete: damaged cable and overheated controller remain competing tentative hypotheses, neither has evidence, and Ada has chosen no cause. Seven accepted answers preserve both alternatives and explicitly keep Ada as the singular person who has not chosen. Russian answers use `Ada Marlow не выбрала причину`; none repeats the V37 indefinite-personal plural or agentless passive error. The new necessary agency floor therefore handles the exposed failure without changing the typed qualification.

One English draft is rejected semantically because it says `The record attributes two competing tentative hypotheses to Ada Marlow ...` rather than explicitly saying Ada considered them. The draft still attributes exactly the two source hypotheses to Ada, states that neither has evidence, and says Ada has not chosen a cause. For the question asking which hypotheses she discussed, neutral record provenance is source-entailing and does not assert that the record, rather than Ada, performed the consideration. The verifier treats the grammatical reporting frame as replacement of the underlying activity; that is a false rejection. The safer calibration is the existing distinction used for open questions: record attribution may introduce sourced content without inventing or replacing its embedded actor. It should remain invalid if the draft changes or omits Ada as the nonselector or assigns consideration to someone else.

### Accepted-output audit

All accepted answers use the requested language, apart from exact invented names and identifiers. I found no fabricated dates, numbers, shipment, booking, completed inspection, established cause, contract requirement, or changed inner speaker. Qualification stays attached to the relevant proposition in every accepted answer. The material loss is upstream in the held nested-report candidate; the other residual losses are one correct language hold and one verifier overreading of neutral record provenance.
