# V37 code review — round 1

Reviewer: GPT-5.6 Sol, separate read-only code reviewer. Scope: exact retention identity/agent guidance, verifier action-role contract, canonical report generation, active-record interpretation, tentative vocabulary, typed unresolved-question normalization, tests/docs/plan. No fresh v18 output was inspected.

## Finding

### Medium — bare `preliminary` can satisfy tentative scope while modifying an unrelated event

`tentativeLanguage` now accepts `\bpreliminary\b` anywhere in the answer. This fixes the faithful target `two competing preliminary hypotheses`, but it also lets an unrelated noun consume the qualification floor. For example, a tentative source claim can generate prose shaped like:

> Ada says the preliminary inspection showed that the warranty covers silverpine.

Here `preliminary` modifies the inspection, while the coverage proposition is presented as established. The deterministic discourse guard would pass and delegate the lost commitment to the semantic verifier. That verifier remains mandatory and should reject the change, so this is not an acceptance bypass by itself, but it weakens the intended qualification floor and adds avoidable risk if the model verifier errs.

Bind `preliminary` to an epistemic/discourse head or status construction, as was done for `unsupported`: competing/preliminary hypotheses, preliminary report/account/claim/proposal/status, or the relevant head being/remain-ing preliminary. Keep `preliminarily` as an adverbial qualification if desired. Add a negative where `preliminary` modifies an inspection/device/step but the tentative proposition is asserted, while retaining the positive competing-hypotheses regression.

## Other reviewed boundaries

- `questionAssertionText` activates only when every cited source consists of qualified `kind:question`, `commitment:none`, `disposition:active` lines. Digit-bearing protected values are checked before question-scope removal, and the original block still reaches all deterministic qualification/attribution checks and the full semantic verifier.
- The English normalization removes only a bounded `whether ... has/have not been established|determined|resolved` clause. Sentence punctuation and explicit contrast/coordinating heads stop the body. The Russian normalization requires an unresolved metaclaim plus a bounded body containing standalone `ли`; `но/однако/зато/поскольку/ведь/а` and sentence boundaries prevent an adjacent asserted denial from being removed. Paired cross-predicate and separate-sentence tests exercise the main leakage paths.
- Canonical `According to SOURCE` / `По словам SOURCE` generation is compatible with existing reporter grammar, preserves nested speakers and verification limits, and does not change verifier authority.
- The active-disposition clarification distinguishes record validity from the tense of a mental activity while retaining explicit dates, endings, resolution, and selection as source-constrained meaning. It does not alter typed lifecycle data or verdict code.
- Retention now requires exact identity subjects for objectless first-person action denials and explicitly treats omitted source-named agents as action-argument failures. This addresses placement and actor-loss at their source rather than relaxing downstream answers. Semantic verification remains one-pass and unchanged structurally.
- Prompt/verifier versions, documentation, V37 plan, models, calls, retries, output ceilings, dimensions, gates, v18 fingerprint, and unexecuted held-out state are internally consistent.

The V36 forensic note was also corrected: its English alternatives discourse hold came from missing `preliminary` tentative vocabulary, while the separate Russian semantic hold concerned active-versus-past interpretation.

## Round 2 final disposition

The `preliminary` finding is resolved without widening the grammar. The positive regression now uses the exposed head relation, `preliminary hypotheses about silverpine`; the implementation accepts `preliminary` immediately on bounded epistemic/discourse heads or those heads explicitly being/remain-ing preliminary. The unrelated `preliminary ... inspection` negative remains outside that scope. This preserves the tentative floor's qualification attachment rather than relying solely on the model verifier.

The complete folder/slug instruction is also correctly bounded: it tells extraction to emit an exact supplied canonical page or a complete eligible-folder/subject slug and forbids a bare folder, invented folder, renamed taxonomy, or unrelated page. It changes no routing authority, `cleanSlug`, ownership resolution, or admission guard. Combined with the exact named subject instruction, it addresses the observed placement failure at generation rather than accepting ambiguous ownership.

The V37 plan accurately describes these as formulation and deterministic-scope changes while preserving all numeric/identity checks, full unmodified semantic verification, model calls, retries, dimensions, ceilings, models, gates, v18 fingerprint, and unexecuted held-out state.

**Final code-review result: clean; no actionable findings remain.** This conclusion reviews the code and regression structure. Test execution and its final pass status remain evidence supplied separately by the implementing agent.
