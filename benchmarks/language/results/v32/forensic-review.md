# V32 exposed-probe forensic review

This read-only review covers only `language-selected-v32` and `language-built-reliability-v32` reports and traces. The V32 full V18 trial was not started. V31 full artifacts were consulted only to audit their publication summary, not to tune these V32 forensic conclusions. Both V32 probe receipts are treated as the independent semantic evidence.

## Inventory

All six probe case-runs retained at least one record and had no retention availability failure. The selected probe has one null answer. The built probe has five null answers and one accepted Russian-language error.

### Selected probe

The only answer null is `v17-held-undated`, English query, explicit view, Russian answer. Generation produced a substantively qualified answer:

> Ada Marlow … proposed … during the month after the original undated record; the calendar reference date is unknown. The plan was not accepted, and the meeting was not scheduled.

The verifier emitted three false booleans but only two mismatches. It marked `action_arguments_preserved:false` without the required action-argument mismatch, so `semanticVerdictConsistent` correctly rejected the malformed verdict and the operation reported `verification_unavailable` / `answer_verification_failed`. This is a structured-verdict contradiction rather than a transport or model-availability failure.

The two supplied mismatches argue that passive “the plan was not accepted” and “the meeting was not scheduled” broaden Ada's personal nonacceptance/nonarrangement. That reading is overly strict in this answer context: Ada remains the only named actor and the clauses restate the cited proposal's explicit status. The draft preserves tentative proposal status, source-relative month, undated anchor, and unknown reference date. The attempted semantic rejection is a false hold, while fail-closing the internally inconsistent response is correct runtime behavior.

The report retention verifier rejected this generated record, but the entailment judgment is disputed:

> Ada Marlow has arranged no shipment of the Zephyr QX-100.

The verifier treats Zephyr QX-100 as an invented shipment object because the source first says only “I have arranged no shipment” and then separately reports terms about sending the device. Under the ordinary universal reading, however, arranging no shipment entails arranging no shipment of Zephyr QX-100; narrowing the domain of a denial is unlike adding an object to a positive shipment event. The adjacent Zephyr sentence also supplies a plausible discourse domain. If “shipment” had an implicit unrelated domain, the narrower claim would not follow, so the source remains contextually ambiguous. This should be reported as disputed rather than an unambiguous correct rejection. It does not justify a blanket rule forbidding sound restriction of negative propositions.

No selected answer was held by a deterministic answer guard.

### Built probe

All five nulls are `v17-held-question` semantic-verifier rejects. Each rejected draft faithfully describes the retained open question and unresolved alternatives. Typical prose is:

> Ada Marlow recorded an open question about whether the Zephyr QX-100 agreement includes returning the device after repairs; neither coverage nor exclusion of the return delivery is established.

The comparison repeatedly treats “Ada Marlow recorded” / `Ada Marlow зафиксировала` as a newly asserted historical recording action, even though the cited managed-memory record attributes the open question to Ada and the user's question asks which question she recorded. Three equivalent drafts passed, while five were rejected. Under the existing record-query contract, this provenance wording does not assert that the embedded question was answered or invent a separate domain event. These are five semantic false rejects, demonstrating inconsistent calibration rather than unsafe drafts.

The built assistant case produced one accepted Russian answer containing the untranslated generic role label twice:

> Предварительный, неподтверждённый отчёт assistant … assistant не изучал контракт …

`assistant` is a schema role label and descriptive vocabulary, not a proper name, identifier, exact quotation, or source-required title. The answer is therefore not Russian-language compliant. The semantic verifier correctly judged content and qualification, but semantic verification does not own output-language enforcement; the model language check falsely accepted the mixed prose.

No built answer was held by a deterministic answer guard, and there were no correct semantic answer rejections in this probe.

## What the comparison audit showed

The new comparison output is useful forensic evidence. It exposed:

- one disputed retention rejection whose audit makes the quantifier/scope disagreement explicit;
- five repeated false answer rejections sharing the same mistaken provenance/action interpretation;
- one internally contradictory verdict that failed closed instead of becoming an unexplained rejection.

It did not itself cure verifier inconsistency. Redundant booleans plus a separate mismatch list create a new malformed-output path even when the comparison clearly expresses the intended judgment.

## Bounded coherent fixes

### Keep malformed verdicts fail-closed

The selected null came from one response that contradicted its own mismatch list. The existing consistency check correctly withheld it. One malformed response does not establish that the three-boolean contract needs another redesign before fresh evaluation. Keep all three booleans and concrete mismatch requirements, retain the no-retry rule, and count this outcome transparently as verification unavailable. If this structured contradiction recurs materially, a later schema can bind verdict and mismatch more tightly using broader evidence.

### Define record provenance separately from embedded events

For answer verification, state that when a cited managed-memory question is attributed to source speaker X and the user asks which question X recorded, “X recorded/has the open question” describes record provenance. It does not add a historical domain action unless the answer adds an external event, time, method, different actor, or claims the embedded question was answered. Continue rejecting a different recorder or changed embedded actor.

This is one semantic rule for record-oriented questions, not an English/Russian phrase allowlist. Add paired tests where the attributed speaker records/has the question (pass), another person records it (fail), a recording date or method is invented (fail), and the question is presented as resolved (fail).

### Enforce known role-label language deterministically

Generic schema roles have a finite translation contract. When Russian output is requested, reject standalone English `assistant` or `user` used as prose for the corresponding typed source role; when English is requested, reject standalone Russian role labels. Preserve proper names, identifiers, exact quotations, and cited evidence. Do not rewrite the answer after generation.

Apply this in the answer-language guard using `requestedAnswerLanguage` plus cited `required_records.source_role`, before semantic verification. Keep the model language check for the rest of the prose. Paired tests should cover a translated role label, an untranslated standalone role label, the same bytes inside an exact quotation, and an unrelated identifier containing the substring.

### Do not add a blanket negative-object prohibition

Keep the existing action-role verifier for positive events and changed predicates, but do not convert this disputed example into a rule that every negative proposition must repeat the source's explicit object syntax. Contrastive tests should distinguish adding an object to a positive event from restricting a universal denial, and should include context that clearly sets a different shipment domain. No V33 change is required solely from this one disputed retention verdict.

## Recommendation

The smallest coherent V33 change is:

1. generate neutral record-provenance wording for open questions, such as “The recorded question attributed to Ada is …,” instead of assigning the source speaker a separate recording action; retain actor/date/method negatives in semantic verification;
2. localize finite generic role labels during generation and add a deterministic target-language attribution-role floor that preserves actual names, identifiers, code, and exact source quotations.

Keep the existing three booleans plus mismatch consistency check and fail closed on malformed verdicts. These changes address the exposed repeated defects without relaxing source entailment, retrying semantic rejection, or turning the disputed no-shipment judgment into an unsound general prohibition.
