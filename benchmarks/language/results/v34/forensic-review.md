# V34 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. Scope is limited to the V34 selected and built-package reports and traces. Runtime verdicts were checked against the invented sources rather than treated as ground truth. No fresh v18 held-out output was accessed.

## Outcome

The built probe retained both cases and produced 16/16 answers. Its independent review found all 16 useful and all retained/retrieved/answered material source-entailing, qualified, and language compliant. My trace review agrees; I found no accepted content, attribution, qualification, or language error.

The selected probe produced 24/32 answers with no availability or model-operation failure. It has four deterministic attribution holds and four semantic-verifier holds. It retained the material nested report as a complete unit, but a separate no-shipment candidate was held. No language-check rejection occurred. I found no accepted unsafe output; the eight nulls are false or materially disputable holds described below.

## Targeted V34 changes

### Exact-reference hints fixed the exposed language false holds

All Russian selected answers that V33's shared checker rejected as wrong-language prose now pass the same first-pass language boundary. This includes preserved `Ada Marlow` and `Zephyr QX-100` references and the previously imperfect but recognizably Russian wording. The traces show no language-policy rejection in either probe, and no inspected Russian answer contains untranslated generic `assistant` attribution.

The built assistant answers use `Ассистент`/`Он` in Russian and `assistant` in English. The generic source label is localized during generation, while retained and verifier metadata still carry the original assistant role. This confirms the intended authority separation; no hint masks surrounding prose or overrides a negative verdict in these runs.

### Text-last extraction preserved the complete nested report

For `v17-held-report`, extraction now generated one substantive record:

> Ada Marlow relayed Bo Winters's assertion that the Zephyr QX-100 terms allow the device to be sent away to measure hinge resistance, not to replace the hinge; Ada Marlow had not read the terms and had received no confirmation.

It contains the inner speaker, outer relayer, permission, shipment action, measurement purpose, no-replacement contrast, and both verification limits. The retention verifier accepted all three semantic dimensions. This resolves V33's sibling-qualification split without relaxing verification.

Extraction separately generated `Ada Marlow asserted that she had arranged no shipment for the Zephyr QX-100.` The verifier rejected it because the source clause `I have arranged no shipment` does not repeat the device object. This remains disputable: an unrestricted denial of arranging any shipment entails no arranged shipment for the contextually discussed device. On the stricter reading, adding the device is an unsupported contextual attachment. Either way, it is a conservative hold, not an unsafe acceptance. Because the review expectation requires the no-arrangement fact as well as the nested report, selected retention may remain incomplete despite the substantial text-ordering improvement.

## Residual answer holds

### Four English nested-report answers: deterministic attribution false holds

All four English report rows generated materially faithful text of this form:

> Ada Marlow relayed Bo Winters’s unverified assertion that the terms allow the device to be sent away to measure hinge resistance, not to replace the hinge. Ada Marlow had not read the terms and had received no confirmation.

They were rejected before semantic verification with reason `attribution`. The failure is lexical, not semantic: `hasBoundReporter` does not include English `relay/relays/relayed/relaying`, and its possessive nominal branch recognizes a speaker's `report|account|statement` but not a speaker's `assertion`. Russian equivalents using `передала` passed. The answer explicitly preserves both reporters and their roles, so these are false holds.

If addressed later, the bounded correction is to treat English relay forms as reporting predicates and a named speaker's possessive `assertion` as a reporting construction, with the existing same-source, grammatical-position, wrong-speaker, non-report-object, and semantic-verifier controls. No retry or verifier relaxation is needed.

### Four alternatives answers: semantic equivalence false holds

The four English-query rows describe Ada as having `discussed` / `обсуждала` the two competing tentative hypotheses. The retained English record says she `is considering` them, so the verifier rejected all four as changed actions. The original Russian source, however, says `обсуждаю` (I discuss/am discussing), while extraction translated that to `is considering`. The query itself asks which hypotheses she discussed. The answers preserve Ada, both alternatives, their tentative status, lack of evidence, and absence of a selected cause.

These are false holds caused by inconsistent treatment of a natural cross-language equivalence: retention accepted `обсуждаю` → `is considering`, then answer verification rejected `is considering` → `discussed`. Past tense can sometimes imply a completed state, but the answers do not say the hypotheses were superseded, resolved, or inactive; several explicitly retain tentative/unestablished status. A future bounded calibration should require a concrete changed event or lifecycle consequence before rejecting `consider/discuss` in this scenario, while continuing to reject changed actors, hypothesis contents, selection, evidence status, or explicit completion. The existing one-pass three-dimension verifier and no-retry policy can remain intact.

## Accepted material

- All eight rejected-offer answers preserve the declined workshop shipment and power-switch inspection. The separate retained record correctly preserves that collection was not booked.
- All eight undated-proposal answers preserve next month relative to the undated original note, unknown calendar placement, tentative proposal status, no accepted plan, and no arranged meeting.
- The four accepted alternatives answers preserve both hypotheses, lack of evidence, and nonselection.
- All built open-question answers use neutral record provenance and preserve the unresolved coverage-versus-exclusion question without inventing a recording act by Ada.
- All built assistant answers preserve tentative/unverified status, twice-yearly indicator checking, and lack of contract review/verification.

I found no accepted factual promotion, altered action/object/purpose, lost source clock, translated proper name, or generic-role language error.

## Disposition

V34 demonstrates that source-backed language hints removed the exposed false language holds and text-last formulation repaired the material nested-report unit. Remaining losses are existing bounded-grammar and semantic-equivalence false holds, plus the previously disputed negative-quantifier scope decision. They do not reveal a new unsafe acceptance path and do not justify a retry, model, schema, threshold, or gate change.
