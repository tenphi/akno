# V52 code review — round 1

## Findings

No actionable correctness finding in the reviewed V52 implementation.

## Personal negative actions

- `personalNegativeActionsSupported` activates only from readable source grammar for personal plan adoption or meeting arrangement. Source-speaker metadata alone cannot activate it.
- Adoption and arrangement use separate action entries. An explicit actor on adoption cannot satisfy an emitted anonymous meeting state, and an actor on arrangement cannot satisfy anonymous plan adoption. The paired regressions cover both directions, combined clauses, later duplicated passives, and attribution-only suffixes.
- Candidate scanning targets emitted passive/anonymous negative forms. An answer may omit an unrelated negative action and leave completeness to the mandatory semantic verifier, as intended; the floor does not turn every source sentence into an answer obligation.
- An independently anonymous source clause exempts only its corresponding action type. The tests show anonymous meeting does not exempt personal adoption and anonymous plan does not exempt personal meeting arrangement.
- Explicit passive agents are bound to the local predicate and checked against readable source spelling. Another action's actor is not borrowed. Identity pairing across multiple people and multiple actions remains with the semantic verifier; the helper is not used as approval.
- Both generated retention cleaning and answer validation call the helper. Caller-provided/model-free retention remains outside the new floor. Failure holds before storage/answer verification and does not coerce text or trigger a retry.

The regex family is deliberately finite. Some valid active/nominal paraphrases are not recognized as passives and therefore defer to semantic verification; some unrecognized anonymous paraphrases can likewise reach the verifier. That is consistent with the declared presence-floor scope and does not bypass the unchanged semantic call.

## Final recheck: Russian passive-agent placement

The round-two correction closes the reproduced false hold for Russian instrumental agents placed after the full complement, such as `Предложение не принято как план ею`.

- A suffix agent must occur immediately after the complete matched action, before punctuation or any intervening word. It must be an allowed singular pronoun or a name present in readable source text.
- A preposed agent is restricted to the explicit instrumental pronouns `ею`, `им`, or `мной`, followed only by an optional plan/proposal subject immediately before the matched action. Punctuation, coordination, or an intervening reporting/discussion verb prevents borrowing.
- Existing local-agent detection within the passive body remains intact. The new branches do not search across clauses and do not let a reporter elsewhere satisfy this action.
- Contrast tests cover suffix and preposed positives, punctuation/verb-separated negatives, one action retaining an agent while the other loses it, and explicit agent borrowing between actions.
- The multi-plan exemption remains type-level deferral only. The integration regression demonstrates that a candidate can pass this necessary floor yet still be rejected by the unchanged semantic verifier for pairing the anonymous state with the wrong proposal.

I found no further actionable issue in this narrow correction. It fixes the grammatical false hold without changing caller-provided retention, action identity authority, semantic acceptance, model calls, retry behavior, or gate policy.

## Shared epistemic and source-frame contract

- The shared proposition contract separates personal lack of an answer from record-level non-establishment and explicitly rejects agreement-term/document means unless the source supplies them. It also requires adoption and arrangement actors independently.
- The answer frame contract correctly states that the retained excerpt selects the proposition while the bound original frame controls its source meaning. Its example permits `допускаю правило` to be rendered as positing/introducing that same hypothetical rule, while expressly withholding enacted/adopted rules, completed discussions, and adjacent unselected acts.
- This does not make the frame additional answer evidence: selection remains tied to the retained excerpt and the existing `excerpt_selection` verdict. The three semantic dimensions, mismatches, and strict response parsing are unchanged.

I found no conflicting instruction between the new text and the existing neutral-provenance/material-action rules.

## Language review tokens

- `languageReviewTokens` runs only for Russian output and derives at most 32 lowercase Latin hyphen compounds, each at most 96 characters, from prose already sent to the same language checker. It masks fenced/inline code and closed exact quotations before extraction.
- Tokens remain attention hints. Source-backed references are still sent separately, and neither presence in `review_tokens` nor absence from `supplied_references` determines compliance. Tests demonstrate both a referenced identifier and surrounding untranslated prose without overriding the checker's boolean.
- The original full excerpts remain in the request. The hint list cannot suppress prose or create a blanket Latin-token rejection.
- The hint bytes count toward the existing 24,000-character ceiling. This bounds the expanded payload; no model-output token budget or call count changes.
- There is no additional privacy surface: every hint is copied from generated prose already sent to that same configured checker, and no original source span is newly forwarded through this field.

The instruction properly distinguishes ordinary technical-looking compounds from actual identifiers without claiming that exact source occurrence proves identifier status. Valid lowercase identifiers, names, paths, code, and quotations remain possible.

## Versions and runtime behavior

The prompt bumps correspond to changes in generation/shared verification text. No schema dimension, verifier boolean, model role, retry, gate, public evidence shape, or source authority changed. The additions can only focus the existing language call or hold generated prose before the unchanged semantic verifier.

## Disposition

The V52 diff is clean on the reviewed boundaries. Its finite lexical floors still depend on mandatory semantic verification for omissions, identity pairing, and unsupported paraphrases; that limitation is explicit and appropriate.
