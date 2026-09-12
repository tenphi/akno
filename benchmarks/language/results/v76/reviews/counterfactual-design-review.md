# V76 bounded Russian counterfactual design review

## Source-first diagnosis

The original `v20-held-counterfactual` source establishes one complete unit: Ada declined and did not purchase the optional extension; only in the false purchase world would wheel-hub repair in the fifth year be covered; the description is unrealized and is not Ada's active coverage.

Selected trace rows 422 and 453 are faithful Russian renderings of that unit:

- row 422 uses `нереализованный вариант заключался в том, что приобретение ... покрыло бы ...`; then names Ada's nonpurchase and denies active coverage;
- row 453 uses `нереализованный вариант состоял в том, чтобы приобрести ...: в таком случае ... был бы покрыт ...`; then names Ada's nonpurchase and denies active coverage.

Neither wording asserts an actual purchase or active coverage. The current helper rejects them because its complete-unit scenarios recognize locative `в нереализованном варианте приобретение ... покрыло бы`, and `состоял/заключался ... при покупке ... был бы покрыт`, but not these two syntactic arrangements. This is a local false hold before independent semantic verification.

## Recommended implementation boundary

Extending `hasCompleteRussianCounterfactualUnit`, rather than the looser nominal cue paths, is principled and bounded. Add two closed scenarios:

1. `нереализованный вариант состоял/заключался в том, что приобретение <bounded noun phrase> покрыло бы <bounded consequence>`;
2. `нереализованный вариант состоял/заключался в том, чтобы приобрести <bounded noun phrase>: в таком случае <bounded consequence> был бы покрыт <bounded tail>`.

Both must remain inside the existing complete-unit transaction:

- affirmative sentence/clause start and optional `По словам <full name>,` attribution;
- explicit `нереализованный вариант` attached to the acquisition syntax;
- bounded antecedent and consequence token counts with no finite second actor, coordinating adversative, quotation sentinel, or newline crossing;
- exact terminal punctuation after the hypothetical consequence;
- a following independently explicit nonpurchase sentence naming the actor;
- an explicit inactive-coverage consequence in that same closure;
- `hasUnretractedClauseEnd` after the complete match.

Capture the optional attribution name and, when it is present, require the same normalized full name in the nonpurchase sentence. This prevents a nearby person's denial from completing another person's counterfactual and avoids inferring gender from `Ada` or `Bo`. If the first sentence has no named attribution, a full name in the nonpurchase clause may satisfy only structural presence; identity and source support remain obligations of the mandatory source verifier. Pronoun-only closure should remain supported only in already bounded legacy shapes, not be newly broadened for these additions.

For the infinitive/colon form, admit the colon only as part of the literal closed bridge `: в таком случае`; do not generally split or ignore colons. Require the acquisition infinitive before it and passive conditional coverage after it. This preserves the counterfactual relationship without allowing an arbitrary heading or prior denial to lend scope to an independent coverage claim.

The existing object, extension identity, repair object, fifth-year scope, actor identity, and coverage semantics cannot be proved by this finite grammar. They remain mandatory independent source-verifier comparisons. Passing the presence floor must never directly accept an answer.

## Required positive controls

Use invented variants covering:

- both exact V75 arrangements, including `состоял` and `заключался`;
- `приобретение ... покрыло бы` with a repeated full actor in the closure;
- `чтобы приобрести ...: в таком случае ... был бы покрыт` with fifth-year placement before and after `был бы покрыт` where the bounded grammar intentionally supports it;
- straight/curly attribution punctuation and ordinary affirmative trailing sentences after the complete closed unit;
- mandatory semantic-negative integrations where the local floor passes but the verifier rejects a changed actor, extension, repair object, year, or active-coverage meaning.

## Required negative controls

At minimum reject:

- `реализованный` or no unrealized label;
- indicative `покрыло` / `был покрыт` without `бы`;
- the label in a quote/example/report/question/conditional or after a denied/alleged prefix;
- a period, semicolon, newline, arbitrary heading colon, or adversative between acquisition and consequence;
- `: в таком случае` without the preceding acquisition infinitive;
- another finite speaker/action inside either bounded noun phrase;
- a different named actor in the nonpurchase closure than the captured attributed actor;
- positive purchase, merely unrecorded purchase, or pronoun-only closure for the new shapes;
- missing inactive-coverage denial, denial of some unrelated coverage, or wording that says coverage was active;
- quoted nonpurchase or quoted inactive-coverage text;
- comma/semicolon/period retractions such as `но это неверно`, `однако покупка произошла`, or `на самом деле покрытие действовало`;
- over-token antecedents/consequences and an independently asserted coverage sentence after the bounded unit.

Retain the existing whole-answer quotation masking and clause-ending protections. Tests should call the helper directly and pair positive local recognition with mandatory answer-verifier negative cases; prompt-string assertions alone are insufficient.

## Simpler alternatives and disposition

A prompt-only request to prefer an already recognized template is smaller in code but has repeatedly proved unreliable and would not address faithful paraphrases already produced. A general conditional schema or deterministic renderer would be larger than the two exposed grammar gaps. Broadening `hasNominalCounterfactual` based only on `нереализованный`, `приобретение`, or `бы` would be unsafe.

**Recommendation:** approve the two closed complete-unit additions with captured-name equality and the controls above. Keep models, budgets, calls, retries, thresholds, and the independent semantic gate unchanged. The design addresses the two exposed false holds without treating the unrealized label alone as sufficient.

## Clarification after review

The negative-control reference to an independently asserted coverage sentence is a mandatory semantic-negative integration, not a requirement that this existential presence helper reject every later independent proposition. Direct helper negatives should cover immediate retractions and bridges that change the matched unit's own scope. Once a complete valid unit has ended, an additional unsupported coverage claim remains the whole-answer verifier's responsibility. This preserves the helper's bounded presence-floor role and does not conflict with the recommended safety boundary.
