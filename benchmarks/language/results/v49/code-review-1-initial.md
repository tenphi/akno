# V49 code review — round 1 (initial)

## Findings

### 1. High: the new bounded inference families can cross an unpunctuated coordination boundary

`packages/core/src/memory/intent.ts` uses word-count gaps in both `boundedDiscoursePhrase` and the first branch of `ENGLISH_TENTATIVE_ASSISTANT_REPORT`. Those gaps exclude punctuation, but they treat conjunctions as ordinary words. This joins a qualified noun in one conjunct to an unrelated reporting predicate in the next and changes the inferred view from the safe factual default.

Minimal reproductions:

```ts
inferMemoryView(
  'What tentative display check failed and did the assistant suggest may be included?',
)
// reports; the tentative check belongs to the first conjunct

inferMemoryView(
  'Какое предварительное сообщение появилось и Ada Marlow пересказала рассказ?',
)
// reports; the qualified message and retelling predicate belong to different conjuncts
```

The existing comma and `while` negatives do not cover this path. Stop the bounded gap at coordination/subordination tokens (`and/or/but/while/although/...`, `и/или/но/а/пока/...`) as well as punctuation, or build these new families from a clause-local helper that does so. Add the two contrastive cases above plus positives where `and` coordinates complements inside a single governed report only if that grammar is intentionally supported.

### 2. Medium: the direct English assistant pattern does not enforce its documented modal/proposition bound

The comment says “Suggesting a possible claim is a report; suggesting an action alone is not,” but this branch accepts any continuation after `that`:

```ts
/(?:the )?assistant (?:tentatively|provisionally)
  (?:suggests?|suggested|indicates?|indicated) that\b/
```

Consequently, these infer `reports`:

```ts
inferMemoryView('What action did the assistant tentatively suggest that Ada perform?')
inferMemoryView('The assistant provisionally indicated that device for replacement.')
```

The first is a tentative proposed action and should not be routed as a source report merely because English uses a `that` complement; the second is malformed/elliptical and provides no possible-claim construction at all. The other branch requires `may|might|could`, so the two branches implement different contracts.

Require a bounded modal (`may|might|could`) or an explicitly epistemic head inside the finite `that` clause before selecting reports. Keep plain tentative action suggestions on the existing planning/discussion/factual path. Add one positive possible-claim case and negatives for an action complement and a non-finite/malformed object.

## Other reviewed boundaries

- The new source-clock form is appropriately source-bound: `запись с неизвестной календарной датой` passes, while repair-date, meeting-date, and device-date attachments remain rejected. The punctuation/end lookahead keeps a following genitive modifier from silently changing the date's owner.
- Clarification now precedes conflict abstention in the answer prompt, and the shared semantic contract still makes the supplied source/frame the only authority. It does not create a synonym table or permit similarity-based alias inference.
- `PROPOSITION_SCOPE_CONTRACT` is semantically consistent with the existing actor, fiction, hypothetical, and neutral-provenance rules. It repeats some answer-prompt material, but I found no contradictory instruction. The material-act clause correctly prevents hypothetical status from erasing an actual proposal actor.
- The new coverage-role text is narrow and leaves the existing three required semantic dimensions, excerpt selection, no-retry behavior, and fail-closed parsing unchanged.

## Disposition

The clock and semantic-contract changes are bounded. The two inference findings should be fixed before freezing because both can deterministically hide factual/planning evidence behind an incorrectly inferred reports view.
