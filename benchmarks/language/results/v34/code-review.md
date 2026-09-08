# V34 code review — round 1

Reviewer: GPT-5.6 Sol, separate read-only code reviewer. Scope: typed language-reference hints, generator-only generic assistant projection, language-check contract/budgets, retention schema ordering and their focused tests. No fresh v18 output was inspected.

## Assessment

No actionable correctness or safety finding in the reviewed diff.

- `languageReferences` remain caller-supplied typed data, are filtered after generation to references whose exact bytes occur in the generated excerpts, remain present in the prose being checked, and cannot override a `compliant:false` verdict. Because an unused reference is not transmitted, this adds no source-text disclosure beyond bytes already present in generated output. The combined 24,000-character limit and 64-reference ceiling fail closed before the second call.
- The answer caller derives hints from current cited page titles, qualified source speakers, and indexed subject labels only when the exact label appears in current evidence. Generic assistant/user speaker labels are excluded from name hints. Deduplication prevents the same spelling from consuming repeated answer-side slots.
- Reference hints do not mask text. The system contract says they are untrusted, exact, and do not exempt surrounding prose or longer containing phrases. The existing deterministic generic-assistant reporter floor remains an independent backstop if the fallible language checker treats a role as a title or name.
- The language-check clarification separates recognizable language identity from minor grammar without excusing mixed-language explanatory prose. Truth, role equivalence, and usefulness remain under their existing checks.
- Generator-facing metadata removes only a generic assistant speaker that duplicates typed `source_role: assistant`; it supplies a localized `source_label` when an output language exists. Named speakers remain byte-exact. Full verifier evidence and public context retain the original `source_speaker`, so the projection does not become evidence authority or weaken attribution verification. Legacy unset-language generation still retains `source_role`, while language enforcement remains disabled as before.
- Moving retention `text` to the final constrained-schema property does not change accepted fields, caps, cleaner validation, repair obligations, or semantic verification. The prompt now asks the model to select support/frame and typed qualification before composing one independently retrievable proposition, directly addressing the exposed sibling-qualification split without adding a call, retry, coercion, or verifier relaxation. The endpoint-schema regression confirms the intended emitted property order.

## Residual limits

The reference list is a hint to a model verdict, not a deterministic language proof, so false holds or misses remain possible. A reference whose spelling is also an ordinary word requires the checker to judge its use in context; the deterministic assistant floor covers the currently evidenced high-risk role case. These are stated architectural limits rather than regressions introduced by V34.

## Final disposition

Final review of the complete diff, documentation, changeset and `v34-trial-plan.md`: **clean, with no actionable findings**.

The public wording matches the implementation:

- constrained output ordering is described as a generation aid, while required fields, semantic meaning, cleaner admission and all three verifier dimensions remain unchanged;
- reference hints remain source-backed data, are sent only when their exact bytes occur in checked output, stay within the existing combined 24,000-character and 64-reference bounds, do not mask prose or override a verdict, and add no model call beyond the existing language check;
- generator-only localization does not replace named speakers or alter verifier/public evidence authority;
- prompt and verifier versions, output ceilings, no-retry behavior, Luna runtime, Sol review roles, repeated-run matrix and gate thresholds are stated consistently; and
- the plan preserves V33's failed probe evidence, the unchanged v18 fingerprint and the fact that no v18 held-out source has yet executed.

The reported final checks—1,987 tests across 132 files plus build, lint, knip, formatting, repository safety, documentation, CLI/demo and installed-package smoke—cover the changed boundary without implying that they establish language quality or full-trial success.
