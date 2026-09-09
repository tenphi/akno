# V69 generation/verifier design review

## Review scope and conclusion

This review is source-first and read-only. It uses the frozen V68 selected trace and current caller/contracts; it does not use an independent grading receipt or fresh held-out data.

The smallest coherent correction is an internal, same-call source-first planning and audit-order change:

1. Make each private `record_readings` entry establish the proposition selected by the readable excerpt before it applies the original frame as a constraint. Preserve the source's material predicate/property in its source wording inside that private plan; translate it once, when drafting the public block. Keep frame-only neighboring propositions explicitly outside that selected meaning.
2. In the existing answer-verifier response, require excerpt selection before source-frame alignments. For `object_and_mechanism`, replace the single combined comparison detail with separate, ordered source and answer descriptions before `relation`.

This does not add a model call, retry, public field, evidence source, or acceptance route. It does not force a glossary or the word *continuity*. It makes the model expose the two meanings it is comparing before it can choose `preserved`, and makes retained-excerpt selection precede interpretation from the broader private frame.

The correction should retain all existing booleans, alignment acceptance, exact-anchor validation, citation selection, strict JSON, language checking, and the 2,400-token role ceiling. The private reading remains fallible generation work and never becomes verifier authority.

## Evidence for the mechanism correction

The selected assistant record is source-specific: it says `connector continuity test each month`. The retained record preserves that same property. V68 shows two different outcomes from the same evidence and target language:

- At [selected trace row 121](../bench-results/language-selected-v68-trace.jsonl), assistant query index 3, the private `selected_meaning` has already changed the test to `проверку целостности соединителя`. The public block repeats that wording. Row 122 correctly separates the source's electrical continuity property from the answer's broader integrity property and returns `object_and_mechanism.relation="generalized"`, both proposition/action booleans false, and excerpt selection false. The public result is withheld.
- At row 137, assistant query index 7, the private reading again changes the predicate to `проверку целостности разъёма`, and the block repeats it. Row 138 instead writes `connector integrity/continuity test`, calls the relation preserved, and returns all required booleans true. That answer is published even though it has the same material loss.

The loss therefore occurs before final prose: [the current reading contract](../packages/core/src/ops/answer-source-audit.ts) tells the model to write `selected_meaning` as a role plan in `output_language` (lines 127-146). Both failing readings perform the difficult translation there, then translate/reuse that generalized plan in the block. The verifier's current global contract already says to compare tested object and property separately and explicitly forbids slash-pair equivalence (lines 156-166). Row 138 nevertheless uses exactly such a slash pair. Adding another synonymous sentence to either global prompt is not a supported correction.

Moving the whole private plan to a presumed configured knowledge language would be unsafe. A frame can be mixed-language, and historical configuration is not authority for the current bytes. The rule should be local to each evidence entry: preserve the exact material source expression(s) visible in that record/frame, in their actual supplied language, while the public block alone follows `output_language`. This is compatible with the current language checker because `generatedProse` does not select `selected_meaning` or `clarification_or_ambiguity`; only public prose and an exact server-materialized copy are reviewed. The answer prompt must state this private-field exception explicitly because the generic language instruction otherwise says generated JSON prose uses the target language. Exact source expressions should remain quotations, which that policy already permits.

A bounded reading contract can use the existing field count and caps:

- `selected_meaning` (existing 320 characters): first identify only the excerpt-selected proposition; copy each material action, tested property, or mechanism in the supplied source wording before any target-language rendering. It may otherwise be terse. A bilingual source clarification may determine which source expression is controlling.
- Rename or redefine `clarification_or_ambiguity` (existing nullable 240 characters) as `frame_constraint_or_exclusion`: record an actual clarification/ambiguity, or a material neighboring frame proposition that is excluded because the readable excerpt did not select it. `null` remains valid when neither applies.

Renaming the second internal key would make the boundary harder to ignore, but is not essential if provider-shape churn is judged disproportionate. Its semantics and the excerpt-first order are essential. No reading content should be copied to the answer or passed to the verifier as evidence.

For the verifier, keep exact source/answer anchor IDs and the same allowed relations. Replace only the `object_and_mechanism.detail` string with two ordered fields, for example `source_specifics` and `answer_specifics`, each capped at about 80 characters, followed by `relation`. Their combined character allowance need not exceed the current 160-character `detail` cap. Positive/changed/generalized branches require both; omitted requires the source description and a null answer description; not-selected permits only the applicable source description and a null answer description. The descriptions are model comparisons, not quoted proof. They must state the tested object and property separately when either exists. A natural equivalent remains eligible for `preserved`; a generic property remains `generalized`. This makes the row-138 shortcut structurally less available without implementing a bilingual dictionary.

The relation and all three semantic booleans stay mandatory. `answerAlignmentsSupported` must continue to accept only `preserved` or `not_selected`, and the existing mismatch consistency check must remain unchanged. A bad or malformed comparison fails closed with no repair.

## Evidence for the selected-record correction

The fiction query index 7 at trace row 165 produces:

> `В вымышленном случае ... который Ada Marlow предложила обсудить, Vulpine Mutual обещает ...`

The block cites only E2. E2's readable retained excerpt selects the fictional promise and says it occurs in Ada Marlow's fictional case; it does not select the material act that Ada **proposed discussing** it. That act is the separately retained E1 record. The generator's own E1 reading correctly says E1 contains the proposal but not the promise. Its E2 reading says the private frame “clarifies” that Ada proposed discussion, then imports that frame-only action while citing only E2.

At row 166 the verifier is given only E2. Its `source_context` begins with Ada's proposal because the complete E2 private frame contains that neighboring source span. It then returns `selected_by_retained_excerpt=true`. This contradicts the frozen contracts: the frame may constrain the selected record but cannot expand selection, and the question's proposal wording cannot supply the action.

The schema order contributes to this failure. [The verification schema](../packages/core/src/ops/answer.ts) currently emits `source_alignments` and all semantic comparison fields before `excerpt_selection` (lines 91-115), even though the verifier prompt says excerpt selection happens first. Constrained decoding therefore commits to frame-informed source contexts and alignments before recording the excerpt-only result.

Move `excerpt_selection` immediately after `block_id`, before `source_alignments`, comparison, mismatches, and booleans. The prompt should require this sequence:

1. Using only the collectively cited readable excerpts, identify whether every material answer clause is selected.
2. Only after that decision, use each cited original frame to constrain the selected proposition's referent, roles, and qualifications.
3. Keep `source_context` limited to that record's excerpt-selected contribution. A frame-only neighboring act must not appear there as selected support.

This is attention ordering, not deterministic proof; the final boolean and exact-citation checks remain fallible. It is still a stronger and more relevant correction than another example sentence because it aligns the wire order with the already declared authority order.

The fiction behavior must remain scoped:

- A focused answer describing only the fictional promise may cite E2 alone. It need not repeat Ada's proposal merely because the query mentions it.
- Neutral wording such as “in Ada Marlow's fictional case” may remain supported by E2's readable record and source attribution. It must not be rewritten as the distinct action “Ada proposed discussing”.
- If a block states that proposal action, it must cite E1 as a contributing record as well as E2 for the promise.
- E1 alone cannot answer what the fictional promise contains.

Do not mechanically add E1 based on the query or on E2's private frame. Citation membership must follow the block's actual material clauses.

## Dataflow and compatibility

The generation call remains:

`readable excerpt -> excerpt-selected private reading -> frame constraint/exclusion -> output-language block + evidence_ids`

The verifier call remains independent:

`readable cited excerpts -> excerpt_selection -> exact original/answer anchors -> per-record alignments -> comparison/mismatches/three booleans`

No generated reading is forwarded as source truth. No original frame becomes public. The query continues to select relevance for ordinary composition; complete-record verification keeps its existing query omission. Unframed/ordinary evidence remains on the legacy path because neither `record_readings` nor source alignments are present.

The reading-field behavior can remain within the existing generation budget because it reuses the two current fields and caps. Splitting the verifier's one 160-character mechanism detail into two approximately 80-character descriptions keeps its bounded prose allowance roughly flat. The JSON schema changes internally and therefore require answer generation/verifier prompt-version bumps, schema snapshots/provider echo controls for one- and two-record branches, and strict malformed/truncated-response tests. Existing caller/provider ceilings remain authoritative.

The exact-source wording in a private reading must not be added to `generatedProse` or `additionalLanguageProse`; otherwise a valid Russian answer with an English source expression would be withheld as mixed-language output. Conversely, the final block and server-materialized copy/translation must continue through the existing language check. Tests should establish this routing rather than treating a stubbed semantic verdict as proof that a translation is faithful.

## Meaningful tests

Use only invented Ada Marlow / Zephyr QX-100 material.

1. **Mechanism generation wiring.** A Russian-target framed record with an English `connector continuity test` yields a private reading that retains the exact source predicate and a Russian block that expresses electrical continuity. Assert that private reading text is not rendered publicly and does not enter language-check prose. A target-language block containing English ordinary technical prose must still fail language policy.
2. **Mechanism verifier negative enforcement.** With exact source and answer anchors, feed a strict verdict whose separate descriptions identify source continuity and answer generic integrity, `relation="generalized"`, matching false semantic dimensions and mismatches; assert the block is withheld. Missing, reversed, combined, trailing, or malformed source/answer fields fail closed without retry.
3. **Mechanism semantic contrasts.** Source continuity -> natural target continuity can pass; source generic integrity -> target integrity can pass; source unspecified connector test -> added continuity must fail; source continuity -> generic integrity must fail. These are semantic-verifier integration controls, not claims of model reliability.
4. **Selection ordering.** Assert the emitted verifier schema/property order places `excerpt_selection` before frame alignments and preserves all existing relation/boolean requirements. Exercise one and two cited frames under the actual compiled schema.
5. **Fiction contribution matrix.** E2-only promise without proposal passes; E2-only text adding “Ada proposed discussing” is withheld; the same complete clause with E1+E2 can pass when both visibly contribute; E1-only proposal cannot answer the promise. A query mentioning “proposed” must not itself change any result.
6. **Neutral attribution contrast.** E2-only “in Ada Marlow's fictional case” stays eligible, while “Ada created/recorded/proposed discussing the case” requires visible support for that action.
7. **Frame isolation.** Put a proposal only in E2's private frame and an unrelated promise in its readable excerpt. Verify that the frame can qualify fiction/referents but cannot make the proposal excerpt-selected. Repeat with the proposal in a separately cited E1 positive.
8. **Budgets and transport.** Cover maximum existing reading lengths, two framed citations, strict `anyOf` branches for preserved/generalized/omitted/not-selected, terminal truncation, and explicit lower caller caps. Do not increase the 2,400 ceiling or retry invalid semantics.

## Limits

These changes improve the order and auditability of fallible judgments; they do not create deterministic bilingual equivalence. A model may still mistranslate a source predicate or misclassify a natural equivalent. Existing language, source, excerpt-selection, three-dimension semantic, citation, and qualification gates therefore remain necessary.

A local lexical floor for `continuity`, a source-language dictionary, automatic citation expansion, or forced proposal repetition would overfit the exposed examples and introduce new false holds. A second verifier attempt would change the declared reliability contract. None is warranted by this evidence.
