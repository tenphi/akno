# V73 fiction-coordinate adjudication

## Scope and reading order

I first read only `tmp/language-selected-output-packet-v73.json` for `v20-held-fiction` and `tmp/v73-source-grading-contract.md` and formed the independent judgments below. I then compared them with `tmp/language-v73-selected-source-review.md`, `tmp/language-v73-selected-forensic-review.md`, and the initial/final selected review JSON. I did not inspect provider traces, fresh held-out inputs, or any other grading receipt.

## Initial independent judgment

### EN→EN inferred (`queryLanguage=en`, `answerLanguage=en`, `explicitView=false`)

The answer is source-entailed, qualified, useful, and language-compliant. It selects the fictional-promise proposition: Vulpine Mutual is the fictional promisor, Bo Winters is the fictional recipient, replacements are free, the object is the hinge pin, the period is the first eleven days of ownership, and the promise exists only inside the made-up case. All material qualifications attached to that selected promise travel with it.

Ada's act of proposing discussion is a separate source act. In this focused wh-question, “did Ada Marlow propose discussing” identifies the promise being requested; the answer need not repeat that query-supplied act to state what the promise was. The answer does not claim that discussion occurred or that the proposal became a contract. Its opening “According to Ada Marlow” is attribution, not a substitute assertion that Ada proposed discussion, but no substitute is required for this focused selection.

My initial fields are therefore:

- `usefulQualifiedAnswer: true`
- `qualificationPreserved: true`
- `sourceEntailed: true`
- `languageCompliant: true`
- `unsafeFactualPromotion: false`

This would differ if the answer selected or characterized the proposal itself, answered whether Ada proposed anything, or omitted the fictional-only scope of the promise. None applies here.

### EN→RU inferred (`queryLanguage=en`, `answerLanguage=ru`, `explicitView=false`)

The answer preserves the source meaning and qualifications, including Ada's proposal, the complete fictional promise, and the absence of a real contract. The lowercase common technical term `hinge-pin` remains untranslated in otherwise Russian prose. It is neither a canonical proper name nor marked source text, and the source packet's Russian question itself supplies `штифт петли`.

My initial semantic fields are:

- `usefulQualifiedAnswer: true` in the contract's source-semantic sense
- `qualificationPreserved: true`
- `sourceEntailed: true`
- `languageCompliant: false`
- `unsafeFactualPromotion: false`

It is not a fully compliant useful output because the requested-language dimension fails.

## Comparison with the preserved reviews

The source review makes the opposite trade between these coordinates while retaining a 50/64 `usefulQualifiedAnswer` total. It marks EN→EN inferred non-useful/unqualified because the proposal act is absent, and EN→RU inferred useful/qualified but language-noncompliant. The forensic review accepts the focused EN→EN promise subset and treats EN→RU inferred as non-useful under the requested-language contract. Both identify the untranslated common noun as a real accepted language error; neither treats it as a source-entailment or fictional-scope error.

The source grader's EN→EN interpretation makes every predicate in the question part of the required answer proposition. That is stricter than the grading contract's express allowance for a focused source-supported subset. Here the two original source items also separate the acts: `turn-1111` establishes Ada's proposal to discuss; `turn-2222` establishes the content and fictional scope of the promise. The answer selects the latter proposition completely. I therefore favor the forensic review on this coordinate.

On EN→RU inferred, the source review's field separation matches the JSON contract more closely. The contract says to judge requested output language separately, and the schema carries `languageCompliant` independently from `usefulQualifiedAnswer`, `qualificationPreserved`, and `sourceEntailed`. The text remains semantically useful despite its language defect. I therefore favor the source review's individual fields, while agreeing with the forensic review that it is not fully compliant and cannot satisfy an acceptance policy requiring zero language violations.

## Recommended final interpretation

For these coordinates, preserve two distinct aggregates:

1. **Semantic useful-qualified coverage** uses `usefulQualifiedAnswer`. On that reading, both coordinates are true. With all other V73 judgments unchanged, selected semantic useful-qualified coverage becomes **51/64**.
2. **Fully compliant useful coverage** is `usefulQualifiedAnswer && languageCompliant === true`. EN→EN inferred counts; EN→RU inferred does not. With all other judgments unchanged, this remains **50/64**.

Recommended final fields:

| Coordinate | usefulQualifiedAnswer | qualificationPreserved | sourceEntailed | languageCompliant | Fully compliant useful |
| --- | ---: | ---: | ---: | ---: | ---: |
| EN→EN inferred | true | true | true | true | true |
| EN→RU inferred | true | true | true | false | false |

The current metric implementation in `packages/core/src/bench/language-review.ts` counts `usefulQualifiedAnswer` directly for useful-answer coverage and independently counts every `languageCompliant === false` as an accepted language violation. Thus this interpretation does not weaken the zero-language acceptance rule: V73 still has one accepted language violation and fails any gate requiring zero. It does mean the phrase “useful qualified answers” must be labeled as semantic usefulness, while “fully compliant useful answers” must apply the conjunction above. If existing publication must retain a single 50/64 headline without changing code or criteria, label it **fully compliant useful answers**, not the raw `usefulQualifiedAnswer` field total.

No criterion or runtime change is recommended in this adjudication. The resolution is a faithful interpretation of already separate fields: proposal omission does not defeat this focused promise answer, and untranslated ordinary vocabulary defeats language compliance without retroactively making the answer unsupported or semantically unqualified.
