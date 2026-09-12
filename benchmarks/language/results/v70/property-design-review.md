# V70 tested-property design review

## Evidence and conclusion

V69 selected trace rows 139–140 show a material property loss that the current joint audit does not enforce. The source says `connector continuity test`; the Russian answer says `проверка целостности разъёма` (connector integrity check). Continuity is a specified electrical property. Integrity is broader and may instead describe physical soundness.

The verifier already notices the difference:

- `source_specifics`: monthly servicing may include a connector continuity test;
- `answer_specifics`: monthly servicing may include a connector integrity check;
- `comparison.source_meaning`: connector continuity test;
- `comparison.candidate_meaning`: connector integrity check.

It nevertheless returns `object_and_mechanism.relation:"preserved"`, all semantic booleans true, and no mismatch. The existing prompt already says to compare a tested object and tested property separately and even uses generic integrity versus a specified electrical property as its contrast. More prompt emphasis would repeat an obligation the model demonstrably read but did not convert into a decisive field. A bounded provider-visible schema split is justified.

## Smallest enforceable shape

Keep the current per-evidence `actor`, `qualification`, selection, source context, exact anchors, and three semantic booleans. Replace the joint `object_and_mechanism` payload with two required sibling decisions:

1. `object_and_operation`: action/test/measurement, tested or acted-on object, purpose, degree and manner except the specifically tested/measured property.
2. `tested_property`: only the source-specified property measured, tested, checked, or inspected, compared with the actual answer property.

This is one verifier response in the existing call. It is not a new semantic dimension or acceptance bypass. Both relations participate in `answerAlignmentsSupported`; `generalized`, `changed`, or `omitted` in either rejects the block. A negative tested-property relation must also require `action_arguments_preserved:false` and a matching mismatch, just as the current contract requires for an object/mechanism loss.

Use strict provider-visible `z.union`/`anyOf` branches rather than `.refine`, `oneOf`, or `const`. A suitable `tested_property` union is:

- **present counterpart:** source anchor non-null, answer anchor non-null, source property text non-null, answer property text non-null, relation `preserved | generalized | changed`;
- **omitted counterpart:** source anchor and source property non-null, answer anchor and answer property null, relation `omitted`;
- **answer-added property:** source anchor and source property null, answer anchor and answer property non-null, relation `changed`;
- **not applicable/not selected:** both anchors and both property texts null, relation `not_selected`.

The added-property arm matters for an unspecified source test rendered as a temperature, voltage, continuity, or integrity test. Treating that case as `not_selected` would let unsupported specificity escape.

`not_selected` is valid only when this evidence's selected contribution contains no tested/measured property and the answer does not add one, or when the whole test/measurement proposition is not selected in this block. It is not valid merely because the broad object/operation is easy to compare. This remains a fallible semantic judgment, but requiring a separate structured decision prevents the observed joint-field collapse. Deterministic code should validate shape, ID ownership, null consistency, and reject negative relations; it should not try to recognize property vocabulary.

## Description budget

Preserve the existing 160-character aggregate mechanism-description allowance by reallocating it, rather than adding another 160 characters:

- `object_and_operation.source_specifics`: at most 50 characters;
- `object_and_operation.answer_specifics`: at most 50 characters;
- `tested_property.source_property`: at most 30 characters;
- `tested_property.answer_property`: at most 30 characters.

Null branches consume none of that prose allowance. The exact values can be adjusted slightly if invented transport fixtures expose a legitimate truncation, but the total must stay 160 and each cap must be visible in the wire schema. `source_context` remains unchanged and cannot substitute for either comparison.

The property strings are private audit summaries, not source authority. The corresponding source/answer anchors must belong to the current evidence ID and current block respectively. A sentence anchor may legitimately be shared with `object_and_operation`; the ID locates the bytes and does not prove the property relation.

## Acceptance and multi-record behavior

For every cited framed evidence entry:

- keep the existing rule that at least one category is selected;
- require all four categories—actor, object/operation, tested property, qualification—to have `preserved` or `not_selected` relations before publication;
- validate source anchors against only that evidence's immutable source-anchor set and answer anchors against only the current block;
- do not let a sibling record's property satisfy this record's selected contribution unless the source explicitly binds both records to the same event under the existing same-event rule;
- do not let a preserved tested object imply a preserved tested property;
- do not let `object_and_operation:not_selected` hide a selected `tested_property`, or the reverse. If a property is selected, its containing test/measurement operation must also be selected. This cross-field consistency can be expressed as provider-visible union variants around the pair if practical; otherwise enforce it deterministically after strict parsing and fail closed.

Ordinary plans, denials, attribution records, fictional promises, and other records with no test/measurement property use `tested_property:not_selected` with all-null property fields. They remain useful and incur no invented property. A source that says only `inspect the connector` has no specified tested property; a faithful `inspect the connector` answer also uses not-selected. If the answer changes it to `check connector continuity`, use the answer-added `changed` arm.

## Prompt contract

Shorten the current repeated tested-property prose after introducing the field:

- first decide whether the selected source contribution specifies a tested/measured property;
- transcribe that property in source wording and the actual answer property independently;
- continuity versus integrity is changed or generalized unless the source itself establishes equivalence;
- natural translation may be preserved, but neither the query nor outside technical knowledge establishes equivalence;
- an unspecified source remains unspecified.

This replaces the existing instruction that tries to embed both decisions inside `object_and_mechanism`; it should not be appended as another parallel paragraph.

## Required controls

1. Exact V69 structural contrast with invented content: source `connector continuity test`, answer `проверка целостности разъёма`; property `changed` or `generalized`, `action_arguments_preserved:false`, matching mismatch, block withheld.
2. Faithful translation: source continuity and Russian `проверка непрерывности цепи/соединения`; property preserved and the existing three booleans still required.
3. Omission: source specifies continuity, answer says only `connector test`; source property non-null, answer null, relation omitted, rejected.
4. Unsupported addition: source says generic connector test, answer says continuity test; source null, answer non-null, relation changed, rejected.
5. Non-mechanism record: a simple booking denial uses all-null property/not-selected and remains eligible.
6. Mixed citations: one evidence record specifies a property and another contributes an independent qualification; the first must compare the property, while the second may use not-selected. The second cannot repair the first's property loss.
7. Foreign/stale/null controls for every union arm, including a source anchor owned by another evidence ID, an answer anchor from another block, non-null text in a not-selected arm, and null answer property with a present answer anchor.
8. Semantic consistency controls: a negative property relation paired with all-positive booleans is rejected; a positive property relation does not override a false legacy semantic boolean or excerpt-selection failure.
9. Actual ModelClient Chat and Responses schema-capture tests: root object, all required fields, `additionalProperties:false`, `anyOf` only, no `oneOf`/`const`, and valid preserved/omitted/added/not-selected echoes.
10. Worst declared two-record response fits the unchanged 2,400-token role ceiling with complete JSON. Preserve caller/provider caps; a deterministic echo proves transport and parsing only, not semantic competence.

## Limits

The structured split cannot prove that the model chose the correct technical equivalence. It makes the required judgment explicit and independently rejectable, which the current joint field does not. Exact anchors establish ownership and byte location, not semantics. The existing excerpt selection, three semantic booleans, mismatch consistency, source authority, language check, and no-retry policy remain unchanged.
