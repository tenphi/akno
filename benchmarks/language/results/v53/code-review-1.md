# V53 code review — round 1

## Finding

### Medium — the new “closed” uncertainty list can match a prefix followed by a positive confirmation clause

[packages/core/src/write/retain.ts:986](../../../../packages/core/src/write/retain.ts#L986)

The new regex ends with `(?![\p{L}])`, which checks only the next character. It therefore accepts the intended negative prefix even when the same sentence continues by affirming confirmation:

```text
Ada Marlow has not read the contract or independently confirmed the report and then verified it.
Ada Marlow has not read the contract or independently confirmed the report, but she later confirmed it.
```

Both return `true` from the new branch. This differs from the existing test `has not read the contract, but has confirmed...`: that test interrupts the pattern before it reaches an allowed `or confirmed the report`, so it does not exercise a suffix after a complete match.

This does not bypass the mandatory semantic verifier, but it weakens the deterministic readable-qualification floor and contradicts the helper's closed-list invariant. A generated report can pass the structural uncertainty check while its readable prose retracts that uncertainty later in the same clause/sentence, leaving detection entirely to a fallible verifier.

Require a real clause terminator after the final allowed predicate, such as end of text or `. ! ? ;`/newline, rather than merely a non-letter. If ordinary trailing punctuation or a following unrelated sentence must remain supported, include those explicitly. Add the two strings above as negative regressions and retain the existing positive two- and three-predicate lists.

## Other reviewed boundaries

I found no additional actionable issue in the bounded diff:

- Source and candidate use the same `hasReportUncertainty` helper.
- The helper remains a necessary generated-output floor; accepted candidates still go through the unchanged source-backed semantic verifier.
- Repair remains one structural pass. The new tests cover no repeated repair and semantic rejection after a successful repair.
- The Russian `установлен` addition is confined to the existing epistemic-head construction. The new attributive physical-component and cross-sentence negatives cover the V53 regression boundary, while legacy joined/short-form behavior remains unchanged.
- The answer prompt correctly gives the selected bound source frame authority over ambiguous query wording and retains ambiguity when that frame does not resolve it.
- Tentative temporal status is attached to timing/date language rather than the embedded review action, without lowering asserted proposal commitment.
- Prompt version updates and benchmark expectation are consistent with the runtime changes.

Review limitation: the helper is intentionally a finite English grammar screen, not a general contradiction parser; the semantic verifier remains mandatory after the structural floor.

## Final recheck

The terminal lookahead fixes both originally reported suffixes: arbitrary `and then` and `, but` continuations no longer match after a complete negative list. End-of-input and punctuation boundaries are appropriately bounded.

One small part of the finding remains. The new `, so|therefore` alternative checks only the conjunction, not the continuation's content. It therefore still accepts a direct positive retraction such as:

```text
Ada Marlow has not read the contract or independently confirmed the report, so she then confirmed the report.
```

The mandatory verifier may reject this, but the deterministic floor again treats contradictory readable prose as preserving uncertainty. Bind this exception to the intended negative explanatory shape (for example, `so it is not a condition she has verified`) rather than arbitrary text after `so/therefore`, or terminate the accepted negative list with punctuation and let the following sentence stand independently. Add the sentence above as a negative regression. With that remaining boundary closed, I have no further actionable finding.

## Final disposition

Clean. The explanatory continuation is now fully consumed as a bounded negative condition/term/requirement clause and is followed by a real terminator. The positive `so`/`therefore` continuations and a negative explanation followed by a comma-spliced positive retraction are covered by regressions and no longer match. The faithful V52 repair remains accepted. The round-one finding is resolved, with no remaining actionable issue in the reviewed V53 boundary.

## Morphology recheck

Clean. Removing `установлен` from the generic spaced-uncertainty stem closes the instrumental-dependent false match. The replacement recognizes only `не установленн...` adjective endings paired with agreeing case/number forms of the bounded epistemic nouns. Thus `не установленный версией компонент` and `не установленная гипотезой деталь` cannot borrow the instrumental dependents as heads, while feminine and plural epistemic adjective forms remain accepted. Legacy joined and short predicates remain on their prior path. The semantic-rejection regression confirms that passing this lexical floor still does not approve source support. No actionable finding remains.

### Reverse-predicate follow-up

Clean. The reverse-order branch is separately bounded to nominative plural, feminine singular, and neuter singular epistemic heads, with matching long-adjective nominative/instrumental endings. Its terminal lookahead prevents the observed instrumental attachment from consuming a following component: `Гипотезы не установленными компонентами ...` cannot match because a letter follows the adjective. Natural finite forms such as `гипотезы остались не установленными` and the bounded copula-omission form remain covered. This restores the lost word order without modifying legacy short/joined forms or semantic approval. No actionable finding.
