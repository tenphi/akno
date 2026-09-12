# V77 bounded third nominal counterfactual design review

This is a read-only design assessment of the source-faithful V76 selected counterfactual coordinate 5.
I did not edit runtime code, call a provider, or inspect fresh held-out material.

## Observed gap

The withheld draft is a complete and source-faithful counterfactual unit:

> Ada Marlow описала нереализованный вариант, при котором при покупке дополнительного расширения
> ремонта ремонт ступицы колеса в пятом году покрывался бы. Она не приобрела это расширение, поэтому
> такое покрытие не являлось её действующим покрытием.

It supplies all four material parts:

1. an explicitly unrealized variant;
2. a purchase antecedent introduced by `при котором при покупке`;
3. an irrealis covered-repair consequence ending `покрывался бы`;
4. an adjacent actual-world closure in which the same actor did not purchase the extension and the
   coverage was not current.

Frozen V76 `hasNominalCounterfactual` returns false. The older short relative form accepts
`нереализованный вариант, при котором <noun phrase> покрывало бы…`, but deliberately excludes `при`
from that noun phrase. The complete-unit forms accept `при покупке` only after
`вариант состоял/заключался в том, что`, not after a named actor's `описала … вариант, при котором`.
The block is consequently rejected by the local discourse floor without reaching the semantic
verifier.

## Recommended bounded implementation

Add one separate complete-unit recognizer inside `counterfactual-wording.ts`; do not loosen the old
short `shapes` expression. The new arm should recognize only this structure:

```text
<named actor> described an unrealized variant,
in which upon purchase of <bounded acquisition object>
<bounded repair consequence> would be covered.
<gender-agreeing adjacent pronoun> did not purchase <bounded referent>,
therefore <that coverage> was not the actor's current coverage.
```

For the Russian wire form, bind these closed elements:

- affirmative sentence start `(?:^|[.!])` followed immediately by a bounded proper name and
  `описал` or `описала`;
- literal `нереализованный вариант, при котором при покупке`;
- bounded, punctuation-free acquisition and consequence spans using the existing excluded finite-verb
  word grammar;
- irrealis `покрывался/покрывалась/покрывалось/покрывались бы` at the end of the first sentence;
- an immediately adjacent second sentence, with no newline or semicolon bridge, whose `Он`/`Она` and
  `приобрёл`/`приобрела` agree with the first predicate;
- a closed nonpurchase object such as `его`, `это продление`, or `это расширение`;
- literal `поэтому` and a bounded current-coverage denial, including the observed
  `такое покрытие не являлось его/её действующим покрытием` plus already supported no-current-coverage
  closures;
- `hasUnretractedClauseEnd` after the complete unit.

Mask quotations before matching exactly as the shared helper already does. Keep the new recognizer a
presence floor only. It establishes that a complete counterfactual presentation is readable; the
existing full-source verifier remains responsible for the actual actor identity, purchased object,
repair object, fifth-year restriction, polarity and every qualification.

The direct named-actor plus immediately adjacent gender-agreeing pronoun is a justified bounded
anaphor here. Accepting an arbitrary `она/он` elsewhere, a named nonpurchaser different from the first
actor, or a closure after another clause would be unsafe.

## Why not broaden the existing relative phrase

Simply allowing `при` inside the old `nounPhrase` would make the first sentence sufficient. It could
then borrow an unrealized label without proving actual nonpurchase or no-current-coverage scope, and
could consume unrelated prepositional material. The source-faithful observed form warrants a complete
two-sentence arm, not a generic preposition allowance.

A generation-only instruction to prefer `если бы` is lower risk but has already failed to prevent
natural nominal outputs. It would leave this valid phrasing unavailable. The closed recognizer is the
smallest deterministic correction supported by the exposed evidence.

## Meaningful controls

Positive helper and answer-integration controls should include:

- the exact V76 invented draft;
- a masculine actor/pronoun counterpart;
- the four agreeing `покрывал… бы` endings only where the consequence noun agrees;
- `его`, `это продление`, and `это расширение` nonpurchase references;
- an unrelated affirmative sentence after the completed unit, which must not retract it;
- an end-to-end case where the exact form reaches the existing verifier and is published only after a
  positive semantic verdict.

Negative helper controls should independently change or break:

- `нереализованный` to `реализованный`;
- `покрывался бы` to indicative `покрывался` or present `покрывается`;
- `при покупке` to a report or assertion about purchase;
- `не приобрела` to `приобрела` or an unrelated negative action;
- first-actor/closure gender, or insert a different named nonpurchaser;
- the current-coverage denial to `покрытия вообще нет`;
- either sentence, `поэтому`, or the adjacency between them;
- the period bridge to a semicolon, colon, comma, question mark, or newline;
- affirmative scope with `Неверно, что`, `Якобы`, `Пример:`, `Если`, a question, or a quoted full unit
  in every supported quote family;
- immediate retractions such as `Но это неверно`, `А это неверно`, and their case/newline variants;
- an extra finite actor/predicate inside the acquisition or consequence span.

Semantic-negative integration controls should deliberately admit the bounded form locally and then
require the unchanged verifier to hold changed actor, extension, component, year, actual-purchase,
current-coverage, and retraction variants. Include the existing one structural-repair path to show
that admission does not add a semantic retry or weaken full-source verification.

## Limits

This arm intentionally does not cover arbitrary Russian counterfactual paraphrases, free pronoun
resolution, omitted actual-world closures, or nominal forms split across paragraphs. Those continue
to rely on the existing explicit `если бы`/counterfactual forms or remain held. No schema, model,
token cap, public API, pass count, retry, metadata, or source-selection change is needed.
