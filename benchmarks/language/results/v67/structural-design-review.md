# V67 structural design review

## Disposition

The V66 exposed failures support four small changes: one shared report-uncertainty list parser, one bounded English source-entry clock construction, a shared English/Russian counterfactual wording floor, and deterministic use of the existing report display phrase when the single-record renderer translates a visible report heading. These changes can remain inside existing generation and validation calls. They do not require another model pass, retry, model/budget/gate change, or new source authority.

The first three are deterministic presence floors. final acceptance still requires the existing complete-source semantic verifier. The display phrase is server-derived presentation metadata and may constrain rendering, but it cannot prove inner/outer reporting roles or repair missing source content.

## 1. Consolidate personal report-uncertainty lists

**Files:** `packages/core/src/write/retain.ts`, preferably extracting the grammar into a focused helper such as `packages/core/src/memory/report-uncertainty.ts`, with the existing retention tests moved/extended around that helper.

`hasReportUncertainty` currently has overlapping two-part and three-part alternatives. The V66 main-report candidates are faithful but fall between them:

- `Ada Marlow has not read the agreement or independently checked this account.`
- `Ada Marlow ... has not read the agreement, and has not independently checked Bo Winters’s account.`

The safe structural change is a single closed parser/regex builder with these components:

1. one explicit personal/generic actor;
2. one negative auxiliary (`has/have/had not`, with the current bounded `yet` support);
3. an examination predicate over `terms/contract/agreement`;
4. one or two coordinated report-check predicates over `account/report/message/claim/interpretation/contractual condition`;
5. only `or`, comma-plus-`and`, or the already supported serial-list separators;
6. a true end/clause boundary or one already enumerated closed clarification.

Allow `checked` for an account/report object and `confirmed/verified` for their current bounded objects. Do not globally equate checking an account, verifying an interpretation, reading an agreement, having confirmation, and receiving confirmation. The local helper only proves that an explicit negative epistemic limit is readable; the semantic verifier must still pair each predicate, actor, and object with the source.

Support both an elided shared auxiliary (`has not read X or independently checked Y`) and an explicitly repeated negative auxiliary (`has not read X, and has not independently checked Y`). A repeated **positive** auxiliary must end the match and fail (`..., but she has checked Y`). Named actors must not imply gender. Explicit pronoun/reflexive agreement may remain a grammar constraint; named-person reflexive identity remains semantic.

Adversarial controls:

- exact positives for both V66 initial and repaired candidates;
- the V65 three-part shared-negative form and existing clarification positives;
- positive second finite predicate (`but she has checked/confirmed it`);
- a new actor in the second predicate;
- wrong objects (`checked the device`, `read the report` where the grammar branch requires agreement terms);
- sentence, semicolon, newline, adversative/subordinate, quote, and code boundaries;
- trailing retraction after an otherwise valid list;
- negation attached only to relaying rather than the checks;
- a candidate that passes the helper but receives a negative full-source semantic verdict.

This consolidation should replace the duplicated special cases rather than adding a third V66-shaped alternative.

## 2. Bounded English month-after-source-entry anchoring

**Files:** `packages/core/src/timeline/source-clock.ts` and `.test.ts`; generation wording in `packages/core/src/write/retain.ts` and `packages/core/src/ops/answer.ts` only if needed to prefer the canonical form.

Both V66 undated candidates preserve unknown calendar date, but frozen reproduction gives `hasSourceRelativeAnchor=false` and `hasUnknownReferenceClock=true`. The missing structural form is:

`next month, meaning the month after her undated/original source entry [rather than after processing]`.

Add a dedicated clause-bounded form instead of broadening the already large fallback alternation:

- require an explicit deictic label (`next/last/this day|week|month|year`);
- require `means/meaning/refers to/is` followed by the matching period noun and `after/before`;
- permit a bounded determiner/possessor (`the/this/that/her/his/their`) and `undated/original` modifiers;
- require `source record|source entry|source note` (not a bare entry/event);
- optionally consume the closed `rather than/not after processing` contrast;
- remain within one sentence/clause and outside quotations/examples/conditions.

Unknown-clock qualification remains a separate required predicate at the retention/answer call sites. Thus the new anchor does not itself claim the record lacks a date. Generation should prefer the canonical, impersonal form `next month means the month after the undated original source record, not after processing`, which reduces pronoun attachment ambiguity, while accepting the observed possessive form for robustness.

Negative controls:

- `month after processing/import/receipt`;
- a bare `entry` or unrelated event;
- a quoted grammatical example or conditional/question;
- negated anchoring (`does not mean ...`);
- another clause or new finite subject between deictic label and source record;
- a conflicting actual calendar month/date;
- `her record` when the candidate's actor/record attachment is changed (the local floor may pass only if syntax is valid; mandatory semantics must reject identity drift);
- positive source-relative anchor paired with missing unknown-clock prose, which must still fail the combined caller check.

## 3. One counterfactual wording helper for both floors

**Files:** `packages/core/src/memory/counterfactual-wording.ts` and `.test.ts`; existing callers in `packages/core/src/ops/answer.ts` should remain the only integration points.

V66 already uses `hasNominalCounterfactual` from both discussion-view and noncanonical commitment checks, but the helper recognizes only two Russian nominal shapes. That leaves two faithful generated forms:

- English: `an unrealized option in which purchasing ... would have covered ...`;
- Russian: `нереализованный вариант, при котором ... в пятом году был бы покрыт`, where eleven bounded tokens precede `был бы` and the current cap is ten.

Generalize and rename the helper conceptually to a bounded **counterfactual wording** predicate, retaining quote masking and clause splitting. Add an English branch that requires both an explicit `unrealized/counterfactual` option/alternative/scenario noun and conditional morphology (`would have`, `would be`, or an explicit `if ... had/were`). Do not accept `would` alone or an ordinary proposed option without unrealized/counterfactual scope.

For the Russian `при котором` branch, avoid making correctness depend on a ten-versus-eleven incidental count. Scan a bounded relative clause (for example, at most 160 characters/14 safe tokens) whose intervening tokens exclude pronouns, coordination/subordination, reporting verbs, finite new actors, and quotation sentinels, then require the existing past/`был` + `бы` morphology. This covers the observed eleven-token phrase without accepting arbitrary text until a distant `бы`. Preserve the more specific instrumental alternative branch.

The helper establishes counterfactual surface scope only. It does not establish the purchase antecedent, coverage object, fifth-year restriction, nonpurchase, or no-current-coverage qualification; the full verifier retains those duties.

Adversarial controls:

- exact V66 `q6` and `q7` positives;
- existing two Russian positives;
- realized/current option, factual present/past predicate, missing `бы`, and `would` as prediction or politeness;
- sentence, semicolon, newline, adversative, quoted-example, and new-subject boundaries;
- an overlong safe-token span beyond the bound;
- an overbroad `no active coverage at all` draft that passes the wording floor but is rejected by mandatory semantics;
- protected names unchanged and a separate attribution-negative case, so this floor cannot rescue the transliterated-name `q3` draft.

Using one helper at both answer status call sites prevents the current situation where `would have` satisfies one status concept but fails the other.

## 4. Enforce `report_source_display_phrase` for translated single-record report headings

**Files:** `packages/core/src/ops/answer.ts`, `packages/core/src/ops/answer-record-rendering.ts` and tests. Protocol types need not change if the constraint remains private.

Today `report_source_display_phrase` is generation guidance in projected qualification metadata. A single-record translation can ignore it and produce a different or ambiguous visible heading. A bounded enforcement is defensible only when all of these hold:

- the complete-record renderer is active for one qualified record;
- the record basis is `source_report`;
- generation selected `rendering_mode: translate`;
- the generated text uses a visible leading attribution/report heading.

Pass the server-derived localized phrase into the private `AnswerRecordRendering` constraint (or derive it once in the same projection helper). After generation, normalize only the already permitted Markdown heading delimiters and boundary whitespace, then require that the leading heading contains the exact supplied phrase. Do not accept the phrase later in the body, inside a quote/code span, or attached to another speaker. Do not mechanically prepend it to model prose: that could create a false outer/inner scope over a sentence the model composed differently.

If product policy requires every translated source report to use a heading, make the heading a server-owned render field rather than trusting free text: have the model translate the complete body, then materialize the localized metadata heading once. That is safer but broader because body/heading segmentation becomes a schema change. For V67, the smaller guard above should apply only when a heading is present; otherwise existing reporting-role and semantic checks decide a full-sentence attribution. Requiring the phrase even when the model uses an equally clear sentence such as `По словам Ada Marlow, Bo Winters сообщил...` would create avoidable false holds.

Controls should cover generic assistant and named outer sources in EN/RU, wrong inner source in the heading, phrase only in body/quotation/code, translated or altered protected names, duplicate headings, no-heading but semantically explicit sentence, and negative semantic/selection outcomes after a correct phrase. The phrase remains presentation metadata: it cannot license a recording act, replace readable inner attribution, select private neighboring material, or override a negative verifier.

## Recommended V67 boundary

Implement the consolidated uncertainty helper, clock construction, and shared counterfactual predicate first. Treat display-phrase enforcement as a small renderer guard only if the desired heading behavior is explicit; otherwise document it as guidance and defer server-owned heading materialization. Keep the V66 coverage guard and language checker unchanged: they correctly stopped repair-as-coverer Russian and untranslated ordinary component prose. No fresh V21 held-out content is needed or appropriate for this design review.
