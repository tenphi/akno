# Retrieval-unit contract code review

**Reviewer:** independent Sol review  
**Scope:** unselected `tmp/akno-integration` prototype, `retain.ts`, `retain-retrieval-unit.test.ts`, and the new public answer controls  
**Disposition:** **clean for the single integration evaluation**. I found no blocking or actionable correctness defect in this bounded component.

## Runtime assessment

`RETRIEVAL_UNIT_CONTRACT` is defined once and interpolated once into each of the two model roles that must agree about record boundaries: extraction and the existing retention verifier. The verifier placement is independent of `QUALIFICATION_CONTRACT`, so later shortening of that contract cannot silently remove the co-location obligation. The change does not alter a schema, model, call count, retry path, text cap, view filter, or local/semantic acceptance gate.

The consolidation preserves the material rules removed from their former locations:

- a candidate must remain faithful when sibling records are withheld;
- open questions retain lack-of-answer and neither-polarity scope when the source supplies them;
- competing hypotheses retain every alternative, common evidence limits, named nonselection, and the unconfirmed underlying state;
- reports retain the embedded proposition, reporter chain, and verification limits;
- proximity, shared subject, or a shared source transaction does not couple an independently true neighboring fact.

The replacement activity paragraph is also coherent with the existing typed-label machinery. It distinguishes neutral provenance from an asserted discussion, consideration, or proposal; requires the source actor, predicate, and activity status; and says that tentative/hypothetical commitment types the embedded hypotheses without erasing an actually asserted outer activity. Existing `semanticRecordScope` and the mandatory proposition/action/qualification verdicts remain the enforcement boundary.

This is still a prompt-level representation correction. A positive stub proves transport and orchestration, not that a live model will consistently form complete units. The fixed comparison and the one declared integration run must supply that behavioral evidence.

## Control assessment

The focused retention test provides useful paired boundaries:

- a complete question unit survives with its two governing limits;
- a split question is semantically rejected even when a sibling carries the missing limits;
- an answered version is rejected as an unsupported proposition;
- an independent same-subject inspection remains a separate retained fact;
- no structural repair is introduced;
- the shared contract occurs exactly once in every extraction/verifier system prompt, and the superseded activity wording is absent.

Existing tentative-scope tests continue to cover the complete competing-hypothesis tuple, tentative metadata outside factual admission, explicit actual discussion, source-frame ownership, strict endpoint schema shape, and independent negative outcomes for proposition, action, and qualification. Existing language and local nonselection controls remain in place.

The two public tests exercise both complete unit families across 16 coordinates each: two query languages, two requested answer languages, inferred/explicit views, and the full coordinate loop. They use the official managed-memory renderer and verify canonical qualified status before answering. Complete-record generation receives one owned evidence record; an unrelated same-subject managed neighbor is excluded from evidence, citations, and output, and a neighboring sentence in private source context is not selected as answer authority. English copy and Russian translation both preserve the whole selected record through the existing source verifier.

The initial fixture failures were test defects rather than runtime accommodations: the corrected fixtures now carry the visible managed status required by production projection and assert `reason_code` through the public result shape. I found no corresponding runtime weakening.

## Evidence reviewed

- `tmp/akno-report-concern-regressions-fixed.log`: 619/619 passing (relevant overlapping retention regression coverage).
- `tmp/akno-retrieval-unit-tests.log`: 233/233 passing.
- `tmp/akno-retrieval-unit-public-tests-corrected.log`: 2/2 passing, with 567 unrelated tests intentionally skipped by the focused invocation.
- Current prototype diff passes `git diff --check`.

The component is suitable to remain in the unselected integration candidate. Selection should depend on the fixed-suite comparison and the declared single integration verification, including accepted-error and complete-retention results.
