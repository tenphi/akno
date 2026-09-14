# V76 independent Sol code review — round 1 initial

## Scope

I reviewed the complete current diff over `2bc8a18`, both approved design notes, the V76 trial plan, and the focused deterministic/integration tests. I did not edit runtime/tests, call providers, inspect fresh held-out data, or modify GitHub.

Evidence observed: 943 focused tests pass. The typecheck command was started; its final exit remains a freeze gate rather than evidence established by this review.

## Findings

**No actionable correctness defect found.**

### Counterfactual grammar

The two additions are confined to a separate complete-unit recognizer. They require an affirmative bounded unrealized-variant introduction, one of the two intended acquisition/consequence shapes, sentence closure, an explicit full-name nonpurchase statement, an inactive-coverage closure, and an unretracted ending. Whole quotations are masked before matching. When `По словам <name>` is present, normalized full-name equality with the actual-world actor is mandatory; pronouns do not borrow identity and no gender is inferred from names.

The direct form excludes the coverage verb from the bounded acquisition noun phrase, and the infinitive form admits a colon only through literal `: в таком случае`. Existing token bounds and clause endings remain. Without an attribution, accepting a structurally present full-name actor is appropriately only a presence floor: actor, extension, repair object, year, and coverage agreement still go through the mandatory answer semantic verifier.

Tests cover exact exposed forms, optional attribution, name mismatch, quotes, questions/conditions, altered modality, missing actual-world closures, punctuation/retractions, overlong phrases, and positive local recognition paired with semantic-negative changed-year and independent-added-coverage cases. The latter correctly treats an unsupported later proposition as a verifier concern rather than turning the existential helper into a whole-discourse parser.

### Source-clock readability and repair

`sourceClockRepairWitness` now derives `deictic`, `period`, and `direction` only from the same preexisting complete exact source definition that supplies the indexed dimensions. It still rejects multiple witnesses and cross-item assembly. The candidate-side exclusion checker activates only when that unique owned witness has `with_exclusion:true`.

Accepted English/Russian forms bind processing as the excluded reference to the witness's exact period/deictic label. Other quotations are masked; only an isolated matching clock label may remain quoted. Patterns start at a closed affirmative clause boundary and `hasUnretractedClauseEnd` requires an immediate terminal boundary while rejecting the recognized correction continuations. Wrong periods, chronology-only mentions, generic clock anaphora, conditional/example/question prefixes, quoted claims, and immediate retractions remain false.

Generated candidates alone acquire the new obligation. Caller-provided cleaning remains unchanged. A candidate already containing the contrast passes without repair; otherwise the existing sole text repair is used only when the other specialized-repair invariants hold. The server-owned witness selects the three/four-field branch. After strict parsing, duplicate/index checks, and fixed per-field/400-unit caps, the same deterministic exclusion check runs before language transport. The fully composed candidate is then cleaned again and sent to the mandatory original-source verifier. Invalid exclusion text produces no partial candidate and no verifier call.

Tests meaningfully cover source activation/no-activation, same-clock matching, generated-versus-provided behavior, valid repair, semantic-negative final rejection, irrelevant repair content, immutable original obligation, strict branch caps, and mixed structural defects.

### Compatibility and provenance

No public schema, model, budget, call count, retry, threshold, source mutation, or provided-attestation behavior changes. Answer and retention version bumps conservatively identify changed local generation/verification behavior. The changeset and trial plan accurately preserve V75's useful-clock interpretation while describing V76 as making the explicit source contrast readable for selection.

## Residual bounded limitations

Both helpers intentionally recognize finite grammar. Faithful unfamiliar wording can still be held and structurally plausible wording can still pass the local floor; the independent semantic verifier remains the authority. `hasUnretractedClauseEnd` checks immediate corrections rather than all later discourse, which is consistent with its presence-floor role and is covered by a semantic-negative independent-claim test.

## Disposition

Round 1 is **clean**. Final typecheck/full gates, the second independent review, frozen build/deployment, and declared provider transport controls remain required before any semantic probe.
