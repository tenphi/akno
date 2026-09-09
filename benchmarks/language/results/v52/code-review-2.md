# V52 code review — round 2

## Disposition

No unresolved correctness blocker remains in the current V52 implementation diff against `20f6f03`.

I found one generated-output false hold during review. The initial Russian agency matcher recognized an adoption passive ending at `как план` but did not recognize the same action's instrumental agent after that complete complement. Thus a faithful form such as `Предложение не принято как план ею` was held before semantic verification. The current implementation resolves it in `personal-negative-actions.ts:35-44`: it accepts only a source-supported agent immediately after the matched Russian predicate/complement, or an instrumental pronoun immediately before that action's subject. The scan does not cross punctuation or intervening clause text. Current contrasts cover the suffix, the preposed form `Ею предложение не принято как план; ею встреча не назначена`, a source-supported name, and nearby reporting/conjunction forms that must not lend their agent. I independently reproduced the corrected results and the four focused files pass with 576 tests.

## Personal negative-action floor

The helper is a generated-only necessary-condition check. It is invoked from both generated retention cleaning (`retain.ts:1183`) and answer draft validation (`answer.ts:1290`); caller-provided retention remains outside it. A failed check holds/rejects the prose and does not rewrite it, retry it, or approve an alternative.

Adoption and meeting arrangement remain distinct entries. Source activation requires readable personal negative-action grammar or an explicit agent on a recognized passive. Source speaker/proposer attribution alone does not activate or satisfy the floor. Once activated, every recognized anonymous passive of that action type in generated prose needs its own locally bound agent. An actor attached to adoption cannot satisfy meeting arrangement, and a name after `according to` cannot masquerade as the action agent.

The new suffix and preposed handling is locally bounded:

- the post-complement Russian agent must begin immediately after the matched body;
- the preposed instrumental pronoun must end immediately before the matched action subject, with only an optional proposal/plan noun;
- names must occur in readable source, while the narrow personal pronouns remain presence markers whose identity is still checked semantically;
- punctuation, another verb, an attribution phrase, or another action prevents borrowing.

This is intentionally finite grammar. Active and nominal wording that does not emit a recognized anonymous passive defers to the mandatory semantic verifier. Complex coordinated or parenthetical passives outside these local shapes can still be conservatively held; the prompt asks generation to use explicit active personal subjects, and no broader agent search is justified by the current evidence.

An anonymous source passive exempts its whole action type from the floor. It does not exempt the other action type. This is an explicit event/object-pairing boundary rather than semantic approval: multiple people or multiple plans remain verifier work. The added helper contrast documents this behavior, and the answer integration test proves that a personal `silverpine` adoption cannot be accepted as anonymous merely because a separate `amberfin` plan is anonymous—the floor defers, the existing semantic call runs, and its false verdict withholds the block. This preserves the source-anonymous contract without presenting the regex as an event parser.

## Epistemic scope and original-frame comparison

The shared proposition contract now separates a person's lack of an answer from a note's failure to establish either alternative. It requires explicit subjects when both are selected and rejects speaker/note/agreement-term substitution. The semantic schema and its three mandatory dimensions are unchanged.

The answer-only source-frame guidance keeps the retained excerpt as the proposition selector and the bound original frame as the authority for that selected proposition's source meaning. It permits an equivalent framing verb only when the frame establishes the same act, and still names enacted/adopted rules, completed proposed discussions, and adjacent unselected acts as changes. Excerpt selection, citation scope, mismatch consistency and the existing semantic verdict remain mandatory. I found no instruction that lets the frame add a proposition or override a failed dimension.

## Language-review attention hints

`languageReviewTokens` runs only for Russian output. It collects at most 32 distinct unquoted lowercase Latin hyphen compounds, each no longer than 96 characters, after masking fenced code, inline code and closed quotation forms. These values are copied from excerpts already sent to the same configured language checker.

The checker still receives every original excerpt. `review_tokens` is explicitly described as untrusted attention-only data, and neither presence in that list nor absence from `supplied_references` decides compliance. The response schema remains the single existing `compliant` boolean. A false or malformed result follows the existing typed failure path; there is no deterministic token rejection, verdict override, new pass or retry.

The duplicated hint characters count toward the existing 24,000-character content ceiling. The maximum list and per-token length bound its added input. The language checker retains its 1,024-output-token cap, and generation/verifier token ceilings are unchanged.

## Versions, tests and limits

The retention and answer prompt-version bumps correspond to changed generation/comparison text. The benchmark expectation updates match those exported versions. The changeset describes the new behavior without claiming semantic guarantees from prompts or hints.

Independent focused validation after the final agency fixes:

```text
Test Files  4 passed (4)
Tests       576 passed (576)
```

This review does not treat stubbed semantic verdicts as evidence of live semantic reliability. The remaining limits—unknown grammar, multi-actor/object identity pairing, and unrelated omitted actions—stay with the unchanged mandatory verifier and the separately planned frozen evaluation.
