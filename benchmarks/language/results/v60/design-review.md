# V60 bounded design review: predicate roles and unresolved-object placement

## Scope and recommendation

I reviewed the finalized V59 built and selected reports and traces, then traced the relevant paths through retention extraction, semantic verification and automatic destination ownership. I did not inspect grading receipts, call a provider, modify runtime code, or treat a model's private interpretation as authoritative source meaning.

The two observed losses have different causes and should remain separate:

1. The built report changes the source action **received no confirmation** into **did not confirm** during first-pass extraction. The semantic verifier correctly rejects that draft. The smallest V60 change is a general extraction instruction to preserve an epistemic clause's predicate and participant roles before translating it. It can use the existing extraction call and existing verifier; no new schema field, pass, repair or retry is justified.
2. The selected report produces a faithful generic-device booking denial, but gives it a relational subject and `page:null`. That leaves ownership no new subject-named destination to evaluate. The safest possible improvement is extraction-side: keep the unresolved device unresolved, make the exact named possessor/person the candidate's canonical subject, and suggest a page named for that person only when an eligible creatable folder is supplied. The existing ownership decision remains mandatory. Do not synthesize a person page downstream from `source_speaker`, and do not make the existing Zephyr page acceptable by inferring that “my device” is Zephyr QX-100.

The first change is sufficiently general and low risk for V60. The second is bounded and defensible as a prompt/dataflow clarification, but its benefit remains fallible because both the subject and page are generated. If it cannot be exercised with an exact person subject and person-named proposal while all current routing checks remain intact, preserving the V59 ownership hold is safer than changing ownership acceptance.

## 1. Built report: the lost action is confirmation receipt, not confirmation status

The original built source says `Самих условий я не видела и подтверждения этому сообщению не получила`: Ada did not see the terms and did not receive confirmation of the message. The first-pass candidate instead says Ada “has not seen the terms or confirmed this message” ([built trace, rows 2–3](../../../../bench-results/language-built-reliability-v59-trace.jsonl#L2)). That changes the epistemic event:

- source: Ada is the recipient/experiencer who did not receive confirmation;
- candidate: Ada is the agent who did not perform confirmation.

The retention verifier explicitly identifies that change and returns all three semantic booleans false ([built trace, row 3](../../../../bench-results/language-built-reliability-v59-trace.jsonl#L3)). The resulting report has one written collection-instruction denial, no retained service report, and eight `no_eligible_evidence` answers ([built report](../../../../bench-results/language-built-reliability-v59.json)). This is a correct hold of a bad draft and a writable-case coverage loss.

The current extraction contract already says to establish attribution, modality and time before writing prose, preserve process identity, and preserve epistemic experiencers ([retain.ts](../../../../packages/core/src/write/retain.ts#L150)). The shared proposition contract preserves the actor and object of examination and confirmation ([semantic-verdict.ts](../../../../packages/core/src/models/semantic-verdict.ts#L35)). It does not tell generation to retain the **kind of epistemic action** or distinguish its participant roles. The verifier has the broader action-argument rule and applied it correctly, but reaching that verifier is terminal for this candidate: semantic rejection does not invoke the structural repair transaction.

### Smallest coherent change

Extend the extraction-visible proposition contract with a language-neutral event-frame requirement:

> For every material epistemic clause, preserve its predicate and participant roles: who receives, supplies, performs, experiences or lacks what. Receiving evidence or confirmation, personally verifying or confirming a proposition, and a proposition having verified status are different source actions. Translate their meaning faithfully without exchanging recipient, verifier, source or object.

This should live in the shared proposition-scope text already injected into the extraction system, rather than as a one-off Russian example. It should complement, not replace, the existing actor/object rule and the mandatory verifier. “Exact predicate” means the same semantic action and roles; it does not require word-for-word translation or forbid a faithful nominal paraphrase such as “Ada received no confirmation.”

This change:

- uses the same extraction call and output schema;
- adds no stored or public field;
- adds no model, repair, retry or threshold change;
- does not alter source/frame authority;
- does not admit anything locally or weaken the three required semantic dimensions;
- has only a small prompt-token cost.

Its limitation is explicit: prompt guidance can improve the first draft, but it cannot guarantee one. If generation repeats the role swap, the existing verifier should still hold it and the case should still abstain. A generated `predicate_roles` field would not solve that trust problem—it would be another fallible model assertion, would enlarge the schema and budget, and could disagree with the readable record.

### Verification

Local tests can confirm contract wiring and fail-closed behavior, but cannot establish semantic reliability by stubbing the desired judgment:

- capture the extraction request and ensure the shared predicate-role contract reaches the first call;
- retain an invented faithful candidate meaning “the named person received no confirmation” when the verifier returns a valid all-true verdict;
- hold an invented “the named person did not confirm” candidate when the verifier returns the corresponding action-role mismatch;
- preserve neighboring variants where the source really does say the person performed no confirmation, where confirmation status is passive and actorless, and where the source names a different recipient;
- keep exact support/frame bytes and nested attribution in every case.

Only an exposed semantic evaluation after freeze can show whether generation follows the new instruction. The local tests should prove transport, binding and withholding behavior, not pretend that a stubbed model proves translation quality.

## 2. Selected report: faithful record, no safe destination candidate

The selected source says, in Ada's own structured item, “No collection of my device has been booked.” It does not identify that generic device as Zephyr QX-100. Extraction correctly leaves the product out of the retained sentence:

> Ada Marlow states that no collection of her device has been booked.

It also emits:

- `subject: "Ada Marlow's device collection booking"`;
- `page: null`;
- direct user/self-attested/negated qualification;
- exact support and frame containing Ada's first-person statement.

The retention verifier accepts this candidate as source-faithful ([selected trace, rows 2–3](../../../../bench-results/language-selected-v59-trace.jsonl#L2)). The loss occurs later. The ownership request has only `uncertain` and the existing Zephyr page because `page:null` supplies no proposed destination. The ownership model chooses `uncertain`, and the candidate is held as `routing_uncertain` / `ownership_uncertain` ([selected trace, row 4](../../../../bench-results/language-selected-v59-trace.jsonl#L4); [selected report](../../../../bench-results/language-selected-v59.json)). This is a correct placement hold under the supplied choices, not a semantic rejection.

That behavior follows the code. Routing recalls existing destinations from candidate text and subject ([remember.ts](../../../../packages/core/src/ops/remember.ts#L471)). A proposed destination exists only when the extraction candidate supplied `page`, the page does not exist, its temporal boundary fits, and its folder is admitted ([remember.ts](../../../../packages/core/src/ops/remember.ts#L525)). Ownership then receives `proposed` as one constrained choice and still must select it independently; `uncertain` remains available ([remember.ts](../../../../packages/core/src/ops/remember.ts#L575)). The benchmark supplies `memory/**` as creatable knowledge taxonomy, so the missing choice is caused by the candidate tuple, not the folder policy.

### Bounded extraction/dataflow clarification

For a standalone personal denial whose object remains an unresolved generic possessive, distinguish three roles:

- **readable proposition:** preserve the passive or otherwise unspecified action agent; do not claim Ada booked, cancelled or refused anything;
- **canonical candidate subject:** use the exact named possessor/person established by the structured first-person source, rather than inventing a relational event subject;
- **page suggestion:** when one supplied eligible creatable folder can hold that subject, suggest a page whose slug/title names the person, such as the invented shape `memory/ada-marlow` / `Ada Marlow`.

This is consistent with the current instruction to preserve an unspecified object, avoid forcing a neighboring product identity, and avoid invented relational subjects ([retain.ts](../../../../packages/core/src/write/retain.ts#L184)). It also uses the existing rule that a proposed page must name its candidate subject in an eligible folder ([retain.ts](../../../../packages/core/src/write/retain.ts#L252)). The needed clarification is that canonical storage subject and grammatical action agent are separate: using Ada as the home axis for a statement about her own generically described possession must not turn Ada into the person who booked or failed to book collection.

The resulting candidate should still say, in substance, “No collection of Ada Marlow's device has been booked,” with no Zephyr identifier unless an exact antecedent in that proposition's deciding context establishes it. Its `subject` may be `Ada Marlow`; its suggested page may be a person-named page. The router would then expose `proposed` (or an exact existing Ada page) to the unchanged ownership model. Selection remains a semantic ownership judgment, never a consequence of the slug or person match.

### Boundaries

Do not:

- turn `my device` into Zephyr QX-100 from the adjacent service report;
- claim Ada is the booking actor merely because she is speaker or possessor;
- derive a proposed page in `routeAutomaticCandidate` from `attribution.source_speaker`; an outer reporter often does not own an inner proposition;
- choose the first writable folder when several eligible folders leave taxonomy ambiguous;
- create a relational one-fact page such as a device-collection-booking page;
- auto-accept the person page, lower the route threshold, remove `uncertain`, or relax the ownership prompt;
- use private frame text as routing authority. The generated candidate text/subject/page and visible existing profiles remain the ownership input.

If the source has no exact named possessor, has multiple plausible people, describes another person's device, or is an external report whose durable subject is elsewhere, leave the subject/page unresolved as current safety requires. If the only available folder is read-only or noncreatable, the suggestion must not become a writable proposal. A person page can be less specific than a product page; it is appropriate here only because the product identity is deliberately unresolved and the named person's own possession is the narrowest established durable anchor.

### Meaningful tests

Use invented sources and destinations throughout:

1. A corrected candidate with `subject: "Ada Marlow"`, `page: "memory/ada-marlow"`, and generic-device denial should reach ownership with choices `uncertain`, `proposed`, and any actual existing candidates. If the ownership stub selects `proposed`, assert the new page/title and retained bytes.
2. The same candidate with an existing Ada page should offer that exact page rather than silently create another one.
3. If ownership selects `uncertain`, the record must remain held. A page suggestion is only a choice, not authorization.
4. With `page:null`, no admitted folder, or a noncreatable/read-only folder, no implicit person proposal should appear.
5. An outer speaker relaying Bo Winters's product claim must not route that claim to the outer speaker's page merely from `source_speaker`.
6. “Ada says no collection of Bo's device was booked” must not use Ada as possessor/home by first-person provenance; the explicitly named possession controls.
7. Multiple people or unresolved possession must continue to abstain from person-page synthesis.
8. The retained text, subject, page, support and frame must contain no invented Zephyr equivalence for a generic device.

Tests 1–4 establish the actual routing dataflow and fail-closed behavior. Tests 5–8 define semantic boundaries for extraction and should be paired with the existing mandatory verifier; they do not justify a deterministic source-speaker rewrite.

## 3. V59 hypothesis repairs are not an index-binding failure

The selected hypothetical case initially admits position 0 and sends only original positions 1 and 2 as `repair_targets`. The request labels the basis `zero_based_original_extraction_order`, includes each original candidate and its own identifier/frame issue, and keeps position 0 in `read_only_admitted_context` ([selected trace, row 41](../../../../bench-results/language-selected-v59-trace.jsonl#L41)). The response returns repairs for positions 1 and 2 with the missing antecedent span.

Those supplemental candidates—actual requirements remain unknown and no actual missed inspection is reported—are subsequently held at **validation** as `discourse_uncertain`; they are absent from the verifier batch. Position 0, the complete hypothetical rule plus conditional consequence, reaches verification and is written ([selected trace, rows 42–43](../../../../bench-results/language-selected-v59-trace.jsonl#L42)). This demonstrates conservative handling of asserted metaclaims whose deciding frame contains hypothetical language. It does not demonstrate a compacted, duplicated or substituted repair index.

That boundary may reduce complete supplemental retention, but it is outside the two V60 mechanisms above. It should not be “fixed” by weakening hypothetical-frame validation, discarding original-position obligations, or changing the now-correct repair request.

## Final assessment

The confirmation repair should be an extraction-visible semantic action-frame instruction, with the current verifier left intact as the acceptance boundary. The generic-device booking record can gain a safe destination opportunity only by supplying an exact person subject and person-named proposal before routing; ownership must retain every current guard and may still answer `uncertain`. If that extraction-side tuple cannot be produced without inferring product identity or action agency, retain the V59 placement hold and defer the improvement rather than broadening routing.
