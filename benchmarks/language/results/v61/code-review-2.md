# V61 independent code review round 2

## Disposition

No actionable correctness or safety finding in the current diff against `2f9984e`.

The complete-record query omission is confined to the private support-verifier payload and is keyed by the same `completeRecord` value that emits `rendering_scope: complete_retained_record`. Generation still receives the query, ordinary verification still receives it, and all source, qualification, language, alignment and selection gates remain mandatory. The per-record contribution guidance does not change the schema or the server acceptance predicate. The new Russian nominal assistant attribution form is narrow enough for its intended label and retains fail-closed semantic verification.

The remaining limitations are explicit evaluation risks rather than code defects: omitting the query removes a fallible relevance cue and can affect query-dependent ellipsis; prompt text cannot prove source coreference; the new nominal grammar recognizes a bounded form rather than general Russian attribution. V60 does not establish that query omission will improve the model's judgments, so the exposed V61 probes remain necessary.

## Complete-record verifier dataflow

The implementation at [`answer.ts`](../../../../packages/core/src/ops/answer.ts#L810) conditionally projects the private verifier request as:

- no `question` property and a `complete_retained_record` scope when the one-record renderer is active;
- the original `question` property and no complete-record scope for ordinary composition.

This is the right discriminator. `answerRecordRendering` already requires one evidence item, one qualified managed line, one source frame and a resolved output language. Its draft schema permits at most one block bound to that evidence ID. Therefore `completeRecord` cannot accidentally mark a multi-record ordinary block as complete.

The complete-record verifier still receives:

- the current materialized answer as immutable `answer_segments`;
- the one visible retained excerpt;
- every byte of the bound original frame as immutable source anchors;
- the record's qualification and semantic scope;
- `memory_view` and the complete-record scope marker.

The server still requires `proposition_supported`, `action_arguments_preserved` and `qualification_scope_preserved`; framed calls additionally require selected retained content and `answerAlignmentsSupported`. A negative semantic boolean, selection result, or `generalized`/`changed`/`omitted` alignment remains terminal. Strict JSON parsing, singleton block auditing and the no-retry path are unchanged.

The system contract at [`answer.ts`](../../../../packages/core/src/ops/answer.ts#L337) is consistent with the payload. It states that no question is supplied in complete-record mode and limits question-dependent interpretation to ordinary composition. The generator path is untouched: its user message still contains the exact question, so it can return no block when the record does not answer it.

The updated operation test covers both `copy` and `translate`, proves query presence at generation and absence at complete-record verification, and compares the reconstructed frame to the original bytes ([`answer.test.ts`](../../../../packages/core/src/ops/answer.test.ts#L180)). It also retains negative semantic, excerpt-selection, language, forged-copy and empty-block cases. The separate framed-denial test confirms that an ordinary framed yes/no call still supplies its question and has no complete-record scope.

## Per-record contribution alignment

The added paragraph in [`answer-source-audit.ts`](../../../../packages/core/src/ops/answer-source-audit.ts#L143) addresses the intended multi-citation failure without altering enforcement. It conditions shared-clause treatment on the source explicitly identifying the same example or event, rejects topic-only identity, and requires every material restriction belonging to each record's contribution.

The existing code remains the authority:

- one alignment entry is required for every cited framed evidence ID;
- every entry must select at least one category;
- anchor IDs must belong to the correct source and current answer;
- only `preserved` and `not_selected` relations pass;
- all three global semantic dimensions and excerpt selection are still conjoined.

The prompt can still allocate a contribution incorrectly. In particular, a verifier might mark a category `not_selected` to avoid comparing a record-specific restriction. The new text expressly forbids that when the block uses the record's contribution, and no deterministic natural-language contribution map exists in the current schema. This is an acknowledged model-judgment limit, not a new bypass introduced by the diff.

## Nominal assistant attribution boundary

The new branch in [`answer.ts`](../../../../packages/core/src/ops/answer.ts#L1513) applies only when the selected source is the generic assistant role. It requires:

- a start-of-text or sentence/semicolon boundary;
- exact `по сообщению ассистента` grammar;
- only the optional middle-dot `предварительно` or `предположительно` label;
- comma or colon followed by visible proposition content.

Before matching, complete bounded quotation/code spans are replaced with a nonjoining marker and `**` formatting is removed. That ordering preserves a live bold label without making a quoted example live. Preposed negation, including a soft line break, remains before the clause and prevents a match. The branch does not apply to a named speaker, another reporting object, a bare label with no following proposition, or a label separated from content by a period.

The helper-level matrix covers the live comma/colon and observed bold/middle-dot forms, preposed and embedded negation, wrong/competing reporters, missing content, period separation, and six quote/code families. The answer integration runs the exact observed form through both an all-true semantic verdict and a semantic-negative verdict, confirming that the local attribution admission is only a floor and cannot override semantic rejection.

The existing generic reporter language guard continues to reject an untranslated assistant role in the wrong output language. Named-speaker spelling and `reportingRolesSupported` remain separate mandatory checks.

## Generation-only guidance

The added Russian coverage paragraph preserves the existing covered-subject/provider distinction and does not modify `coverageRolesSupported`. It correctly distinguishes a repair covered by a warranty from a component purportedly covered by repair as an instrument, while retaining uncertainty and negation.

The fictional-answer guidance now uses the source-parametric `SOURCE` placeholder. It requires neutral outer attribution without assigning creation or proposal agency, keeps fictional promisor and recipient separate, and forbids importing a proposed action from the question or promise-only citation. This resolves the round-1 low-severity concrete-speaker concern.

Both additions affect first-pass generation only. They add no authority, schema branch, local acceptance, model call, repair, retry or output budget.

## Versions, scope and validation

The answer prompt versions advance coherently to generation v57 and verifier v38 at [`answer.ts`](../../../../packages/core/src/ops/answer.ts#L63). The grounded-answer benchmark expectation advances to the same values. Retention extraction/verifier and source-clock runtime remain unchanged, matching the trial plan. The changeset describes the private query split, attribution form, coverage roles and unchanged semantic requirements.

I inspected the current diff and the preserved validation artifacts:

- final current-tree suite: 2,706 tests across 143 files passed (`tmp/v61-suite-final.log`);
- focused answer checks: 458 tests across two files passed;
- build/typecheck, final lint, knip and formatting passed;
- documentation doctor/build, smoke, installed-package smoke and repository safety passed;
- compiled boundary and rendering preflights report query separation, complete frame preservation, copy/translation, language checking, strict JSON, mandatory semantics/selection, attribution negatives and unchanged source bytes.

The first lint run failed only for test-variable shadowing. The variables were renamed to `opening` and `closing`; the final lint log is clean. `git diff --check 2f9984e` is also clean.

## Final assessment

V61 is ready to freeze for the declared probes. The code preserves source authority and all existing acceptance gates while changing only where question context is supplied and how fallible alignment/generation instructions describe the intended scope. No local check can establish that these prompt changes improve semantic reliability; the plan correctly leaves that claim to the one-shot exposed evaluation and preserves the 2,400-token evaluation ceiling versus the service's existing 1,024-token overlay.
