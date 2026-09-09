# V64 code review — round 1

## Disposition

No actionable correctness defect found in the current V64 runtime diff against `00aa524`.

## Retention limit and repair

The implementation exposes the existing admission rule accurately. Candidate text is trimmed and whitespace-folded before `text.length` is measured; the prompt and diagnostic correctly name JavaScript UTF-16 code units and retain the inclusive 400-unit limit. The cleaner now distinguishes fewer than four words, over-limit text, and failure to read as a statement without changing candidate admission.

The observed length-specific issue continues through the existing original-position repair transaction. The regression checks the exact original candidate and read-only admitted sibling, then sends the repaired candidate through the unchanged full-source verifier. The negative confirmation test is meaningful: a repair that changes `has no independent confirmation` into personally `has not independently confirmed` fits the cap but is withheld by semantic verification. The 399/400/401, folded-whitespace, and astral-symbol cases bind the documented unit behavior.

No admitted sibling becomes mutable, no additional repair is introduced, and the prompt explicitly permits omission when the complete proposition cannot fit rather than authorizing qualification loss.

## Report-source display phrase

`report_source_display_phrase` is derived only for `basis:source_report` from the existing typed outer attribution and requested output language. Generic assistant roles are localized; named speakers retain their supplied spelling. The field is generation-only, is absent from verifier input and public evidence/context, and does not alter stored bytes.

The generation contract correctly calls the phrase presentation guidance and forbids mechanical prepending, missing support, invented recording acts, adjacent content, and outer/inner role substitution. Existing reporter guards and mandatory semantic verification remain authoritative. The tests show both positive and semantic-negative paths, and cover generic, named-assistant, and ordinary named-user presentation. I found no new route by which the hint itself can satisfy selection or verification.

Finite limitation: the phrase remains a model-visible suggestion, so it can still be attached awkwardly or ignored. Existing deterministic attribution and semantic checks must continue to decide those outputs; V64 does not claim otherwise.

## Conditional complete-record rendering

When configured knowledge language and requested answer language are both set and differ, `copy_allowed:false` removes the copy arm from the strict block schema and leaves only a required-text `translate` object. This is a conservative schema restriction, not a claim about the language of stored prose. A model may preserve already-correct target-language text through the translate arm, after which the same language, citation, source-frame, selection, and semantic checks run.

Same-language and unset-policy paths retain the prior copy/translate union. The strict translation schema rejects copy, missing text, and extra fields. The operation passes configured knowledge language only to rendering eligibility; `copy_allowed` is not inserted into evidence, verification, or public output. The operation tests exercise faithful translation, invalid copy, language rejection, and semantic rejection. No source or language gate is bypassed.

The direct strict-object schema for cross-policy translation is simpler than the prior `anyOf` union and introduces no unsupported `oneOf`/discriminator form. Existing provider transport coverage remains applicable.

## Versions and scope

Prompt versions match the changed roles: retention extraction advances to `v47`, retention verifier remains `v31`, answer generation advances to `v59`, and answer verifier remains `v39`. The benchmark expectation and changeset agree. The diff changes no model, pass count, retry, budget, source authority, language decision, reporter regex, semantic schema, selection rule, or gate.

The bounded design remains subject to three explicit limits: 400 UTF-16 units can still make a faithful proposition unrepresentable; presentation hints cannot prove attribution; and configured-language mismatch only removes a risky shortcut rather than identifying the actual stored language. Those are accurately preserved rather than hidden by the implementation.
