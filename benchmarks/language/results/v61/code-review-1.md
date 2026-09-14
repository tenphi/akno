# V61 code review round 1

## Finding

### Low — fiction guidance uses a concrete fixture speaker where the rule is source-parametric

`packages/core/src/ops/answer.ts` adds:

> Neutral attribution such as "According to Ada Marlow, in the fictional example ..."

The surrounding contract correctly requires the named outer source supplied by the selected evidence. The concrete sentence, however, is in a shared generation prompt and can encourage copying `Ada Marlow` for a fictional record whose actual named outer source is different. Existing protected-value, attribution and semantic checks should withhold that output, so this is a likely false-hold/cost risk rather than an acceptance bypass. The smallest correction is to use the already established placeholder form, for example `According to SOURCE, in the fictional example ...`, and retain the following instruction to name the fictional promisor and recipient separately. A contrastive generation fixture with a different invented named source would make the intended parameterization explicit.

No other actionable defect found in the reviewed boundary.

## Attribution-floor review

The new branch is narrower than making the adjective optional in the pre-existing named-source pattern:

- It runs only when `genericRole` is true and the supplied label is the generic assistant form.
- It hard-codes the grammatical genitive `ассистента`, so it does not broaden named reporters.
- It requires a clause start (`^` or sentence/semicolon punctuation), `по сообщению ассистента`, the optional middle-dot status label, comma/colon, and visible following content.
- Quoted spans are replaced with a nonjoining marker before matching. Removing `**` preserves the boundaries around a live bold label but does not turn a quoted label into live attribution.

The exact V60 opening

`**По сообщению ассистента · Предварительно:** ...`

matches this branch after bold removal. The tests cover comma, colon, the exact bold/middle-dot shape, preposed negation including a newline, embedded `Неверно, что`, colon-introduced example text, six quotation/code forms, wrong reporter, device-as-reporter, period separation, and missing proposition content. The operation test runs the exact structural opening once with an all-true semantic verdict and once with a negative verdict; the latter remains withheld as `semantic_support`. These are meaningful boundary tests rather than prompt-string snapshots.

The branch remains a presence floor, not semantic authority. It can recognize that a proposition is grammatically presented according to the assistant, while the unchanged verifier must still decide whether the proposition, actor/object roles, uncertainty and selected source content are supported.

## Coverage and per-record verifier guidance

The coverage addition gives the generator a grammatical explanation of the existing role invariant. It does not change `coverageRolesSupported`, schemas or acceptance code. The distinction between `ремонт` as the covered service and `гарантия` as coverage provider/instrument is consistent with the deterministic guard and mandatory semantic verifier.

The per-record alignment paragraph does not relax the allowed relations: `generalized`, `changed` and `omitted` still fail in `answerAlignmentsSupported`, as do negative semantic booleans and failed excerpt selection. Its exception is explicitly conditioned on the source establishing the same example/event, and it retains every material restriction of each selected contribution. The main residual limitation is model calibration: the prose can guide a fallible verifier but cannot prove coreference. The existing source-frame coordinates, per-evidence membership and semantic conjunction remain the enforcement boundary.

## Complete-record query omission

The conditional is correctly wired at the verifier payload only:

- `answerMessages` still includes `question` for generation.
- `verifyDraftBlock` omits `question` only when `completeRecord` is true and adds `rendering_scope: complete_retained_record` in that same branch.
- Ordinary composition retains the question and has no complete-record scope.
- Both branches retain memory view, exact current block, retained excerpt, original source frame, qualification metadata, alignment schema and excerpt-selection judgment.

Tests assert query presence in generation and ordinary verification, query absence only in complete-record verification, complete original-frame byte equality, and the correct rendering-scope discriminator. There is no new call, retry, schema dimension, output-limit change or semantic acceptance override.

## Plan and version consistency

The answer generation/verifier tags move from v56/v37 to v57/v38, and the benchmark expectation changes to those exact values. Retention and source-clock versions are untouched. The V61 plan accurately describes the generic-only nominal form, conditional query omission, unchanged gates/models/calls, full source/selection checks and the finite risk that removing the query also removes a fallible relevance cue. It does not claim that the prompt changes prove causal improvement.

## Disposition

No correctness or safety blocker. I recommend replacing the concrete `Ada Marlow` fiction example with a source-parametric placeholder before freeze to reduce avoidable wrong-source drafts. The remaining limitations are explicitly bounded: nominal attribution is not a general parser, source coreference remains a fallible semantic judgment, and complete-record verification intentionally judges the preselected retained unit without query context.

## Finding resolution

The low-severity fiction-guidance finding is resolved. The example now reads `According to SOURCE, in the fictional example ...`, matching the existing source-parametric attribution convention immediately above it. The surrounding text still requires the named outer source, keeps the fictional promisor and recipient separate, and forbids importing a proposing action from the question. No new finding in this narrow recheck; the round-1 disposition is clean.
