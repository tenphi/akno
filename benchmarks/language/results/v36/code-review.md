# V36 code review — round 1

Reviewer: GPT-5.6 Sol, separate read-only code reviewer. Scope: answer generation v33, retention extraction v27, localized presentation metadata, Russian passive report attribution, tests, documentation, and the V36 trial plan. No fresh v18 output was inspected.

## Finding

### Medium — Russian commitment display labels inject an assumption speech act across all record kinds

`MEMORY_DISPLAY_LABELS.ru.commitment` maps:

- `tentative` to `предварительное предположение`;
- `hypothetical` to `гипотетическое предположение`; and
- `counterfactual` to `контрфактическое предположение`.

These labels are supplied for every qualified kind. `предположение` means an assumption/supposition and can change the proposition type when the record is a tentative plan, preference, question, decision, event, fictional rule, or counterfactual alternative rather than a claim someone assumed. The generation prompt explicitly tells the model to use these labels to express status, so the added noun can cause the model to describe a tentative proposal as an assumption even though the authoritative `kind` remains `plan`. Full semantic verification should reject that drift, but it creates an avoidable false-hold/coverage regression and makes the presentation aid contradict the claim that it “adds no proposition.”

Use kind-neutral Russian status labels, for example an adjectival/adverbial status (`предварительно` / `предварительный статус`, `гипотетическая рамка`, `контрфактическая рамка`) or make the presentation label depend on both kind and commitment. Add at least one non-claim regression, such as a tentative plan, asserting that generator-facing labels do not call it an assumption; retain the existing verifier/public-metadata exclusion checks.

## Other reviewed boundaries

- The source-relative instruction removes the concrete interval that contaminated prior drafts and still requires the actual evidence interval, original undated-source anchor, and unknown calendar reference. It adds no example value that could replace source content.
- The Russian passive reporter branch is bounded to `сообщение|отчёт|утверждение`, optional comma, an agreeing `переданн...` participle, and the exact required source. Recipient (`для Ada`), wrong-source, non-report noun, nested possessed-object, and immediate possessive suffix cases remain blocked before semantic verification. I found no new reporter-ownership bypass in the reviewed grammar.
- Retention guidance correctly says to omit absent arguments and forbids turning extraction rationale into a source-scope proposition. It changes first-pass formulation only; cleaner and semantic verification remain unchanged.
- The post-build explicit `Record<string, unknown>` annotation is a type-inference correction and does not widen runtime fields. Removing the misleading inner-Ada positive improves the test's asserted contract.
- Prompt versions, benchmark snapshot, documentation, and V36 plan consistently preserve calls, output ceilings, semantic dimensions, retries, models, gates, v18 fingerprint, and the unexecuted held-out state.

## Round 2 final disposition

The presentation-label finding is resolved. Russian `tentative`, `hypothetical`, and `counterfactual` now use kind-neutral status/context wording rather than the proposition-bearing noun `предположение`; `none` is neutralized to `без утверждения` / `no assertion`. `resolved question` remains appropriately question-specific because the protocol permits `resolved` disposition only for `kind: question`.

The corrected end-to-end tentative-plan regression is structured to verify all relevant authority boundaries: generator evidence retains authoritative `kind: plan`, `commitment: tentative`, and `disposition: proposed`; localized labels remain presentation-only; the generated answer stays a proposal rather than an assumption; and neither verifier input nor public context exposes `display_labels` while original typed enums remain present. Its first fixture version used the wrong managed-memory visible prefix and was correctly excluded before generation; the fixture was corrected to `Tentative · Proposal`. Test execution status is reported by the root gate run, not independently claimed by this review.

No further actionable finding remains in the reviewed V36 diff. The passive attribution branch, example-free source-clock instruction, absent-argument retention guidance, documentation, prompt versions, and V36 plan remain consistent with unchanged semantic verification, model calls, retries, output ceilings, models, gates, and unexecuted v18 held-out state.
