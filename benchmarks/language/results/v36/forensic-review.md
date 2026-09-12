# V36 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. Runtime verdicts are checked against the invented source rather than treated as ground truth. No fresh v18 held-out output was inspected.

## Built-package probe

The probe retained both cases completely and produced 13/16 answers. I found no accepted content, qualification, attribution, language, or status-label error. All three nulls are deterministic false holds before semantic verification.

### Open question: two `protected_value` false holds

The English draft says:

> The recorded open question attributed to Ada Marlow is whether the Zephyr QX-100 agreement includes returning the device after repairs. Whether the return delivery is covered or excluded has not been established.

The Russian draft equivalently says the unresolved issue is whether the agreement provides or excludes that delivery. Both preserve the open question and explicitly avoid selecting either answer.

`protectedValuesSupported` nevertheless rejects them. For typed memory it calls `containsPredicateDenial`; that lexer sees English `excluded` or Russian `исключает` as a new denial because the readable retained support uses the noun `exclusion` / an English source form rather than the same predicate morphology. In these drafts the predicates are alternatives inside a question/non-establishment frame, not asserted denials. These are false protected-value holds and an existing question-about-question polarity-boundary issue, not a V36 status-display problem.

Any later bounded correction should activate from the cited typed `kind: question`, `commitment: none`, active/unresolved record and recognize that both predicates occur inside the explicitly unresolved question. It must continue to reject an answer that states either coverage or exclusion as settled. No semantic retry or verifier relaxation is required.

### Assistant report: one `attribution` false hold

The faithful English draft says:

> The assistant’s tentative, unverified preliminary reading was that servicing Zephyr QX-100 may include checking the indicator twice a year. The assistant had not studied the contract or verified this assumption.

The deterministic reporter floor accepts possessive `report|account|statement|assertion` but not possessive `reading`, even though the retained evidence itself describes `The assistant's preliminary, unverified reading`. This is a lexical false hold. A future bounded option is a possessive source-bound `reading` only when cited typed evidence is a tentative source report and readable support itself uses that report noun; full semantic verification should remain mandatory.

### Accepted built answers and display labels

The other six open-question answers use neutral record provenance, retain Ada Marlow's attribution, and preserve that neither coverage nor exclusion is established. Seven assistant answers preserve the generic assistant source, possible twice-yearly indicator check, preliminary/unverified status, and lack of contract study or verification. Russian answers use localized role and status prose; none copies English enum values or turns a tentative report into an assumption. Original typed enums remain in verifier evidence and public context.

## Selected probe

The selected probe retained one or more records in all four cases and produced 23/32 answers. There were no language-policy or provider failures. I found no accepted unsupported fact or qualification promotion, but two material source details were lost before answer generation: the no-shipment denial failed placement, and the retained rejected-offer sentence erased Ada as the rejecting agent. The nine nulls divide into four deterministic guard holds and five semantic-verifier holds.

### Nested report and complete no-shipment denial

Extraction produced two source-faithful records. The main report preserves Bo Winters as inner speaker and, after attribution resolution, Ada Marlow as authoritative outer reporter with Bo in the chain. It keeps shipment permission, hinge-resistance measurement, the no-replacement contrast, and Ada's lack of reading and confirmation. The retained marker and answer evidence correctly expose outer `source_role:user/source_speaker:Ada Marlow`, `basis:source_report`, with Bo's nested role in the readable proposition/frame. I found no chain inversion or qualification loss in the accepted report answers.

The second candidate is now exactly the authored denial:

> Ada Marlow states that she has arranged no shipment.

It passed all three retention-verifier dimensions. It was nevertheless held at placement with `routing_uncertain` / `ownership_uncertain` because extraction set its subject to the invented relational label `Ada Marlow's shipment arrangement`. V36 fixed semantic formulation but did not produce a routable identity, so the durable set and all report answers still omit the no-arrangement fact.

The bounded correction is to make an exact named speaker the structured subject for an objectless first-person action denial, while leaving the prose proposition objectless. Routing should not be widened to accept arbitrary invented relational subjects. A regression should distinguish `subject: Ada Marlow` plus `arranged no shipment` from a neighboring product report.

Three Russian report answers were false attribution holds. Their drafts use faithful passive record provenance such as:

> В записи, приписанной Ada Marlow, содержится неподтверждённый отчёт ...

V36 recognizes report-noun-bound `переданное Ada Marlow`, but not `приписанное Ada Marlow`; Bo's inner reporting remains explicit. These are narrow lexical false holds, not unsafe drafts. Repeatedly adding sampled participles will continue to trail generation. A more coherent boundary is to make generation use one of a small documented canonical localized attribution constructions already accepted by the floor, while the full semantic verifier continues to check outer/inner roles. If another passive is admitted, it should remain report-noun-bound with wrong-source, recipient, possessive-object, and nearby-name negatives.

### Rejected offer: actor lost during retention

The original source explicitly says:

> I, Ada Marlow, rejected the offer; sending it is not my plan.

Retention wrote:

> Ada Marlow stated that an offer ... was rejected and that sending it was not her plan.

This weaker passive sentence is source-entailing, but it omits the material fact that Ada performed the rejection. The retention verifier incorrectly marked `action_arguments_preserved:true`, describing the actor as preserved. Three later drafts correctly said `Ada Marlow rejected/отклонила`; answer verification then rejected them because the retained evidence no longer establishes that agent. Those answer-verifier decisions are correct relative to the supplied retained evidence but expose the upstream retention loss. One accepted answer uses the weaker `Ada stated that the rejected proposal was ...`; it is safe yet incomplete relative to the original requested fact.

The principled correction is to reinforce the existing action-role dimension at retention: when the source names the agent of a decision/refusal, a passive with an unspecified rejecting agent is a material omission. This should be a source-versus-candidate action-role regression, not a phrase list or answer-verifier relaxation.

### Undated proposal

All seven accepted answers preserve `next month`, the undated original-note anchor, unknown calendar month, tentative proposal status, no accepted plan, and no arranged meeting. The concrete prompt example contamination is gone; no answer substitutes `next week`.

The one rejected Russian draft changes `has not accepted a plan` to `не утверждала план` (did not assert/approve a plan in an ambiguous lexical sense). The verifier specifically identifies non-acceptance becoming non-assertion. Given the qualification contract's distinction between commitment and disposition, this is a justified semantic hold.

### Competing hypotheses

Six answers pass with both alternatives, preliminary status, evidence for neither, and no selected cause. One English explicit draft was rejected by the deterministic discourse floor because `tentativeLanguage` does not recognize English `preliminary` in `competing, preliminary hypotheses`; this is a lexical tentative-status false hold, not a tense check. One Russian explicit draft was separately rejected by semantic verification because past imperfective `рассматривала` may imply that retained active `is considering` has ended. Neither draft states resolution, supersession, or a selected cause, so both are conservative false holds rather than clear factual errors.

Neutral record provenance worked in several answers (`The recorded tentative alternatives attributed to Ada...`, `The record attributes...`) without inventing a writing act. Other answers described consideration directly; that action is supported by the retained record. I found no accepted invented discussion/recording event.

## Cross-cutting diagnosis

The V36 losses are split between narrow lexical floors and source meaning/routing lost upstream:

- lexical guards: three selected Russian passive-attribution holds, two built unresolved-question polarity holds, one built possessive `reading` attribution hold, and one selected English `preliminary` tentative-vocabulary hold;
- upstream retention/placement: the complete no-shipment denial has an unroutable invented subject, and the rejected-offer record drops Ada's agent role;
- semantic decisions: one justified accepted-versus-asserted plan mismatch, three downstream rejections caused by the retention actor loss, and one conservative active/past alternatives rejection.

This does not support weakening gates or adding semantic retries. The coherent next work, if undertaken, is to preserve routable identity and material action roles before answer generation, use canonical localized attribution surfaces to reduce lexical variation, and make question/active-status guards reason over typed scope instead of isolated morphology. Full source comparison and the zero-error dimensions should remain unchanged.

## Final disposition

No accepted answer in the inspected probes invents a fact, changes a protected time value, promotes uncertainty, or misattributes the nested report. The main accepted-output limitation is incompleteness inherited from retention: absent no-shipment and Ada's explicit rejection role. Localized display labels introduce no observed assumption/status drift and remain absent from verifier/public evidence.
