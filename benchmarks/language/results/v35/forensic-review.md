# V35 exposed-probe forensic review

Reviewer: GPT-5.6 Sol in a read-only forensic/code-review role. Scope is limited to `language-selected-v35` and `language-built-reliability-v35` reports and traces. Runtime verdicts were compared with the invented sources rather than accepted as truth. No fresh v18 held-out output was inspected.

## Outcome

The built-package probe retained both cases and produced 16/16 answers. Independent review found all 16 useful and all retained, retrieved, and answered content correct. My trace review found no accepted content, action-role, qualification, attribution, or language error.

The selected probe retained a useful record in all four cases and produced 28/32 answers. The four nulls are one deterministic attribution hold, two semantic rejections, and one language-check/generation failure. I found no unsafe accepted statement or qualification promotion. The nested-report set remains incomplete because its separate no-shipment denial was held; consequently its seven accepted answers omit that material source fact.

## V35 behavior

### Relay grammar

Seven nested-report answers now pass guards and semantic verification. They preserve:

- Ada Marlow as outer relayer;
- Bo Winters as inner speaker;
- permission to send the device away;
- hinge-resistance measurement as the purpose;
- hinge replacement as the excluded alternative; and
- Ada's lack of reading and confirmation, leaving the permission unverified.

English possessive `Bo Winters’s report/statement`, direct `Ada Marlow reported`, attributed-report, and active relay wording all reach verification correctly. I found no wrong-speaker or possessed-object false acceptance in the probe.

The single remaining report null is Russian-query/Russian-answer/explicit-view. Its faithful draft says:

> Неподтверждённое сообщение, переданное Ada Marlow со слов Bo Winters: ...

It was rejected at the deterministic attribution floor. `со слов Bo Winters` binds Bo, but the grammar does not recognize passive Russian `сообщение, переданное Ada Marlow` as binding Ada as the relayer. This is a false hold, not a semantic defect. A future bounded correction, if needed, is a passive transferred/relayed-report construction tied to a report noun and the required source, with wrong-source and transferred-object negatives. Full semantic verification can remain unchanged.

### Neutral hypothesis provenance

All eight competing-hypothesis answers pass. The retained record now preserves the original source action as `Ada Marlow discusses ...`, so answer wording using `discussed`/`обсуждала` no longer depends solely on the question or reverse translation from `is considering`. Every answer preserves both alternatives, their preliminary/unsupported status, evidence for neither, and no selected cause.

The generation prompt's neutral-provenance instruction did not force an artificial “recorded by” sentence when the evidence itself supports discussion. That is the intended boundary: avoid inventing an act, while preserving an act actually stated by the source. I found no accepted invented writing or recording action.

### Unspecified denial

Extraction preserved the main negation but added an explanatory clause:

> Ada Marlow states that she has arranged no shipment, without specifying what would have been shipped.

The verifier rejected it because the larger source does identify the device that could be shipped in Bo's adjacent report. The direct denial itself leaves the object unstated, but asserting as a new fact that the source did not specify the object conflicts with the complete-source context. The hold is justified for the generated sentence as written.

This exposes a formulation failure rather than a need to narrow the denial to the product. The safe future direction is to retain the authored denial directly (`Ada Marlow states that she has arranged no shipment`) without adding a metaclaim about what the source specifies. The V35 instruction correctly permits the speaker as subject, but the model unnecessarily verbalized the instruction's “unspecified” rationale.

Because this candidate was held, the retained report record and all seven accepted report answers omit the separate no-arranged-shipment fact. They are faithful to what they do say and preserve report qualification, but they are incomplete against the full case expectation.

## Other residual holds

The undated proposal accounts for the remaining three nulls:

- Two Russian drafts changed source-relative `next month` to `next week`. The verifier correctly rejected the changed temporal value and qualification.
- One draft both changed month to week and inserted the English phrase `tentative proposal` into Russian prose. The language checker correctly rejected the mixed-language output before answer admission.

The other six proposal answers preserve the undated source anchor, unknown calendar month, tentative proposal, lack of plan acceptance, and absence of an arranged meeting.

## Accepted output review

- Rejected-offer answers preserve the declined workshop shipment and power-switch inspection. The separate retained record preserves that collection was not booked. The focused answer does not repeat that sibling fact; this is a potential completeness judgment for independent grading, not unsupported content.
- All alternatives answers preserve both competing hypotheses, lack of evidence, and nonselection.
- Built open-question answers use neutral record provenance and do not assign Ada an unsupported recording act.
- Built assistant answers localize the generic role and retain tentative, preliminary, unverified status, twice-yearly indicator checking, and lack of contract review/verification.

No accepted answer changes a month to a week, turns permission into shipment, turns a rejected offer into a plan, selects a hypothesis, answers an open question, mistranslates a generic role, or drops an explicit uncertainty qualifier.

## Residual cause summary

V35 reduces the exposed answer holds from eight to four. The remaining causes are:

1. one false deterministic hold for a bounded Russian passive relay construction;
2. two correct semantic holds for `next month` becoming `next week`; and
3. one correct language hold that also contains the same temporal error.

Retention still loses the no-shipment denial because generation converted scope-preservation guidance into an unsupported scope metaclaim. No finding calls for semantic retry, verifier relaxation, a model change, or a gate/threshold change.
