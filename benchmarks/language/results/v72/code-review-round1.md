# V72 independent code review — round 1

## Disposition

No actionable correctness defect found in the working diff against `1e6f79d`.

I reviewed the two runtime changes, their unit/integration and Chat/Responses transport tests, fixture migrations, prompt/version changes, the V71 property forensic design, and `benchmarks/language/v72-trial-plan.md`. I did not edit runtime code, call a provider, or inspect fresh held-out data.

## Closed report-uncertainty grammar

The new `personally` form is confined to the final predicate of the existing three-predicate shared-negative grammar. It reuses the bounded `checked | confirmed | verified` predicate and the existing report/meaning/contractual-term object inventory. It does not create a new subject, infer gender from a name, loosen the negative auxiliary, admit arbitrary adverbs, or permit an omitted object.

Quotation masking, clause-start requirements, horizontal predicate spacing, and the existing terminal/retraction boundary remain active. The tests cover pronouns, a validated full name and its unique source-derived short alias, the generic assistant, wrong actors and report objects, positive/repeated auxiliaries, unrelated verbs, quoted/conditional/reported contexts, newline behavior at the direct helper boundary, and immediate continuations/retractions. The exact V71 repair shape is admitted, while admission still only reaches the mandatory full-source semantic verifier. End-to-end controls show a wrong actor/object can pass the lexical shape but is withheld by that verifier, including after the one allowed structural repair.

Generated whitespace normalization means an original newline cannot be treated as a raw generated-candidate boundary at this later stage. The corrected test separation accurately records that limitation: direct source-helper tests retain the horizontal boundary, while normalized generated prose is judged in its actual canonical form.

Residual scope is finite: the helper recognizes this English closed-list family, not arbitrary personal epistemic phrasing. A model can still produce a faithful form outside it and be conservatively held. That is an availability/coverage limitation, not semantic approval.

## Provider-visible operation/property dependency

The revised three-arm entry union encodes the intended state dependency:

1. `tested_property: not_selected` pairs only with an unselected containing operation (`object_and_operation` options 2 or 3).
2. Active property comparison/omission/addition pairs with a selected operation and retains the existing 50-character per-side operation allowance plus 30-character property fields.
3. `tested_property: absent_from_both` pairs with a selected ordinary operation and null property anchors/text, preserving the existing 80-character per-side operation allowance.

The strict singleton shapes make the V71 invalid combination—selected/preserved operation plus property `not_selected`—unrepresentable at provider decoding. Source- and answer-only properties still have their required non-null anchors and descriptions; omitted and added properties remain negative relations. Foreign anchors, missing fields, extra fields, malformed branches, truncation, and trailing JSON remain fail-closed. The final server check accepts `absent_from_both` only for the parsed `tested_property` object and still accepts only `preserved` or truly `not_selected` for the other categories. Generalized, changed, and omitted relations remain rejecting even when all three model booleans are positive.

The schema retains the prior aggregate description allowance: an ordinary selected operation may use 80 characters per side with no property text; a property-bearing operation divides the same 160-character total into 50+30 per side. The new enum adds no free prose. Tests inspect the emitted strict `anyOf` structure on both model endpoints and exclude `oneOf`/`const`.

The design cannot prove that a model correctly chooses `absent_from_both`; a verifier could still falsely assert property absence despite visible source wording. This is explicitly documented and remains subject to the unchanged semantic booleans and exposed evaluation. A deterministic property parser or synonym dictionary is neither added nor implied.

## Compatibility and plan

Only the private answer-verifier version advances to v46. Public operation schemas, answer materialization, model assignments, output ceilings, call count, retry policy, local guards, excerpt selection, anchor ownership, three semantic dimensions, and acceptance thresholds are unchanged. Existing clock materialization and counterfactual behavior are outside this revision.

The trial plan accurately binds the work to the two reproduced V71 mechanisms, preserves the same exposed 64+32 matrix and fresh V21 fingerprint, requires two review/fix rounds and frozen controls, and makes no competence claim from mocks. Actual schema transport size and model branch selection still require the declared frozen controls/probes; this review does not treat the deterministic tests as evidence of model competence or universal budget sufficiency.
