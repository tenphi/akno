# V77 independent Sol code review — round 2 initial

Read-only review of the current working diff against `1d63519`. I inspected the three V77 design
reviews, both round-1 receipts, runtime integration and tests. I ran focused deterministic helper
reproductions only; I made no runtime edit, provider call, or held-out-data access.

## Findings

### High — the new purchase-relative counterfactual arm absorbs uncertainty and clause prefixes into the actor name

`packages/core/src/memory/counterfactual-wording.ts:51-67`

The new arm is intended to require an affirmative clause-head named actor. Its `name` expression,
however, accepts two to four capitalized tokens and excludes only a short prefix list at the first
token. A leading discourse word can therefore become the first token of a fabricated three-word
"name" and leave `Ada Marlow` immediately before `описала`.

Using the exact faithful V76 unit from the new positive test, each of these returns `true`:

```text
Perhaps Ada Marlow описала ...
Maybe Ada Marlow описала ...
Suppose Ada Marlow описала ...
When Ada Marlow описала ...
Reportedly Ada Marlow описала ...
Возможно Ada Marlow описала ...
Предположительно Ada Marlow описала ...
```

This admits uncertain, conditional, temporal, or reported outer scope through a helper whose new
authority is specifically a complete affirmative unit. It is an introduced boundary escape. The
mandatory semantic verifier remains required after local admission, but it does not make the local
claim that this is an affirmative complete-unit presentation true.

Required correction: reject a closed set of EN/RU uncertainty, reporting and subordinating tokens at
the actor start before allowing the bounded proper-name grammar. Add the exact examples above plus
`While/Although` and `Пока/Хотя` controls. Preserve direct names and ordinary unrelated affirmative
sentences after a completed unit. A shared bounded actor-start prefix definition for both new helpers
would reduce drift; it must remain a finite syntactic floor rather than an arbitrary adverb parser.

### High — the fictional-case introduction has the same remaining prefix escape after the round-1 fix

`packages/core/src/write/fictional-case-identity.ts:10-14`

Round 1 excluded `If`, `Perhaps` and several close variants, but the same multi-token `name` capture
still treats each of these as a direct affirmative introduction and returns `qx-100`:

```text
Reportedly Ada Marlow proposes discussing an invented case about Zephyr QX-100.
Allegedly Ada Marlow proposes discussing an invented case about Zephyr QX-100.
When Ada Marlow proposes discussing an invented case about Zephyr QX-100.
While Ada Marlow proposes discussing an invented case about Zephyr QX-100.
Although Ada Marlow proposes discussing an invented case about Zephyr QX-100.
Вероятно Ada Marlow proposes discussing an invented case about Zephyr QX-100.
Предположительно Ada Marlow proposes discussing an invented case about Zephyr QX-100.
Хотя/Пока Ada Marlow proposes discussing an invented case about Zephyr QX-100.
```

The design authorizes a generated-only repair obligation only from a unique affirmative named-case
introduction. Reported uncertainty and subordinate/conditional introductions were explicitly outside
that witness. A falsely activated witness can force a full repair and hold an otherwise independently
valid generated candidate, even though it cannot itself publish or choose a page.

Required correction: close the actor-start prefix set for the bounded EN/RU forms and add direct
helper negatives for every supported prefix class. Keep the exact-source-span, order, uniqueness,
candidate-owned support/frame, quotation and following-retraction checks unchanged.

## Reviewed scope without another concrete blocker so far

- Actor and qualification `detail` retain local `.max(160)` while provider-visible schemas expose
  `maxLength:80`. The Unicode arithmetic is sound, strict relation/null branches remain unchanged,
  and tests distinguish local acceptance from wire constraints.
- The purchase-relative counterfactual arm otherwise keeps a two-sentence unit, bounded lowercase
  acquisition/repair spans, gender-agreeing adjacent pronoun and nonpurchase, exact no-current-coverage
  closure, quote masking and immediate retraction handling. Full source verification remains mandatory.
- The fictional identity witness derives only one alphanumeric identifier from exact, ordered source
  spans in this candidate's own support/frame. It neither changes candidate bytes nor assigns a page.
  Missing identity enters the existing one full-repair transaction; provided candidates skip the
  generated-only floor.
- Null subjects, text-only or subject-only identifier presence, source-order reversal, ambiguous
  introductions, quoted spans, immutable siblings, original repair indices, 400-unit prose limits and
  semantic-negative outcomes have meaningful direct or integration coverage.

## Initial disposition

**Hold round 2** on the two related actor-prefix boundary escapes. The wire/local diagnostic fix and
the remaining identity/repair integration are clean within the reviewed boundary. Recheck the final
shared prefix correction and focused suite before closure.

## Finding extension after the first finite-list correction

The first shared `AFFIRMATIVE_NAMED_ACTOR` revision excluded the initially reproduced tokens at every
name position but still allowed the same structural escape for `Probably`, `Presumably`, `Likely`,
`Conceivably`, `Purportedly`, and `Supposedly`. Each prefix plus the two-part `Ada Marlow` was consumed
as a three-part actor in both new grammars. This confirmed that extending only a token blacklist was
not a complete correction. I recommended a structural arity bound and, where structured source
metadata exists, exact speaker binding. The final disposition below is recorded separately after
that second fix.
