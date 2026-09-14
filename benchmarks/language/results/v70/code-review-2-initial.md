# V70 independent code review — round 2, initial findings

Reviewed the current uncommitted diff against `6444de3`, [`v70-trial-plan.md`](../../v70-trial-plan.md), production paths, tests and prepared offline controls. Read-only: no runtime edits, provider calls, private configuration/KB access, fresh held-out inspection or GitHub mutation.

## Findings

### Medium — literal Russian clock guidance omitted the undated marker required by the unchanged floor

**Location:** [`answer-record-rendering.ts`](../../../../packages/core/src/ops/answer-record-rendering.ts), `ANSWER_RECORD_RENDERING_CONTRACT`.

The first V70 wording told Russian translation to make the interval the subject of `отсчитывается от времени первоначальной записи`. That exact phrase does not establish an unknown source clock to the frozen deterministic grammar. An offline call on `Следующий месяц отсчитывается от времени первоначальной записи. Календарный месяц неизвестен.` returned `hasSourceRelativeAnchor=false`, `hasUnknownReferenceClock=true`. Thus a model following the literal new instruction could still produce the V69 class of local `discourse` hold.

The integration test used the materially stronger `отсчитывается от времени первоначальной записи без даты`, which returned both floors true, so it did not expose the instruction/fixture mismatch.

**Bounded correction:** put the selected record's undated status in the procedural phrase itself, while retaining separate processing-clock and calendar-unknown clauses. Do not broaden the helper grammar.

### Medium — ordinary records lose the claimed unchanged comparison budget

**Location:** [`answer-source-audit.ts`](../../../../packages/core/src/ops/answer-source-audit.ts), `operationAlignmentSchema` and the entry-level operation/property union.

The former object/mechanism schema allowed `source_specifics` and `answer_specifics` up to 80 characters each. V70 globally lowers both to 50 and allocates 30+30 to the new tested-property descriptions. That sums to the prior 160 only when a tested property is active.

In the provider-visible branch whose `tested_property` is all-null `not_selected`, an ordinary plan, question, denial, promise or other non-test record cannot use those 60 characters. Its effective operation-description allowance falls from 160 total to 100. A previously valid ordinary audit can therefore become schema-invalid/unavailable or be forced into materially tighter descriptions even though the plan and comments state that the aggregate allowance is unchanged.

**Bounded correction:** parameterize the operation-description cap. Use the legacy 80 characters per side in the property-not-selected entry branch, and 50 per side only in the active-property branch, where 30 per property side keeps the same 160 total. Assert the distinct incidental=80 and active=50 caps in the emitted Chat and Responses schemas. This preserves the new dependency without increasing the previous per-entry prose ceiling.

## Other reviewed behavior

- The round-one dependency fix is provider-visible: an entry with a present/omitted/answer-added property can use only a present or omitted containing operation. An all-null not-selected property uses the other strict entry branch. The two branches are disjoint by property shape.
- Property shapes correctly distinguish present comparison, omitted answer property, answer-added property and all-null not-selected. Added properties require an answer anchor and no source anchor; omitted properties require a source anchor and no answer anchor.
- `answerAlignmentsSupported` reparses the exact union, enforces evidence-local source anchors and current-block answer anchors, requires exact evidence coverage, and accepts only preserved/not-selected relations. A positive property cannot override excerpt selection, the three semantic booleans or another negative relation.
- The all-categories-not-selected and exact evidence-set refinements remain local/parser-level inherited constraints. The new operation/property dependency itself no longer depends on a provider-invisible refinement.
- Retention remains one candidate record bounded to 400 normalized UTF-16 units, one structural repair, immutable admitted siblings and mandatory full-source semantic verification. Allowing short sentences changes presentation rather than admission. The personal-limit wording distinguishes lacking/receiving evidence from personally checking it.
- Complete-record generation remains limited to one selected current retained record. Counterfactual, source-clock and exact-name instructions are translation procedures over retained content, and expressly forbid adding absent roles, dates, properties or qualifications. Copy/translation language checking, local floors, excerpt selection and full original-frame semantic verification remain mandatory.
- The 2,400-token ceiling, models, call/pass count, no-retry behavior, public protocol and acceptance thresholds are unchanged. The larger strict alignment shape increases JSON overhead; the prepared two-record maximum-description control is relevant evidence, while stub decoding cannot prove live provider compatibility.

## Initial disposition

The Russian clock wording finding is straightforward to correct without runtime grammar changes. The ordinary-record budget regression remains a provider-schema compatibility blocker to the plan's unchanged-budget claim. I found no source-authority expansion, semantic-gate relaxation, repair-position mutation or public-schema change in the reviewed diff.
