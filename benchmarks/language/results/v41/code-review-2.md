# V41 code review, round 2

Reviewed the revised shared agency helper and its focused retention/answer regressions. The original round-one note is preserved unchanged in `tmp/language-v41-code-review-1-original.md`; the active round-one note corrects its nonreproducing `proposal` example to the reproduced `explanation` case. I did not inspect fresh inputs or authorize live execution.

## Disposition

No actionable blocker remains in the reviewed V41 boundary.

The round-one false-hold finding is addressed in two bounded ways:

- Source activation now requires readable personal singular grammar: a first-/third-person singular pronoun, a multiword proper-name shape, or a carried personal consideration/discussion subject. A capitalized English or Russian collective noun no longer activates merely because it precedes `has not chosen` / `не выбрал`.
- When the source itself contains the same unassigned nonselection construction, that candidate construction is deferred to the mandatory semantic verifier. The exemption is limited to an unbound source passive and a bounded continuation boundary; an explicitly agent-bound source passive cannot be used to erase that agent.

The new contrasts cover the reproduced independent `explanation ... for publication` case, English and Russian collective actors, and explicit source-passive attribution. The observed source-specific case still fails deterministically: personal Ada nonselection cannot become `neither explanation selected`, and naming Ada only as the considering actor does not bind the separate passive choice predicate.

The source-present exemption intentionally compares a bounded construction rather than proving identity of the selected object, purpose, or qualification. A candidate could therefore reach verification with a changed continuation such as a different purpose. That is an acceptable limit here because both generated retention and answers always proceed through the full source/candidate action-argument and qualification comparison; the helper does not mark the proposition supported or bypass a negative verdict. Provided retention remains model-free and outside this generated-only floor.

The no-booking extraction/repair guidance remains safe: it separates independent propositions and their deciding frames while requiring all actually qualifying context, complete-original-source verification, repair obligations, and all three semantic dimensions. It adds no semantic retry or acceptance override.

The root reported the focused run pending after the final capitalized-collective adjustment. I inspected the current code and tests but did not independently run them.
