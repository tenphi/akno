# V77 fictional-case identity attachment — bounded design review

Independent Sol review, read-only. I inspected the existing extraction contract, generated-candidate identifier guard, source-identifier advisory payload, repair path, and V76 fiction source/candidate. I made no runtime edit or provider call.

## Problem boundary

The generation contract already requires a fictional record introduced in an earlier source item to carry its named subject into readable text and subject metadata, with the exact introducing span in its discourse frame. Repeating that instruction cannot close the observed failure.

The current local floor derives `missing` only from alphanumeric identifiers already present in `record.subject`. V76's promise candidate omitted `Zephyr QX-100` from both its subject and readable prose, so the guard had no identifier to test. Its support directly said `In the invented case`, and its frame also contained the earlier `fictional case about Zephyr QX-100` introduction, but that attachment was never converted into a rejection obligation.

## Recommended minimum

Add a **generated-only, rejection-only fictional-case attachment witness** before the existing subject-identifier check. It should return at most one source-attached alphanumeric identifier for this candidate, or no witness.

The witness may activate only when all of these conditions hold:

1. One exact span in this candidate's validated discourse frame contains a complete affirmative fictional-case introduction with one identifier-shaped token containing letters and digits.
2. A different exact span in this candidate's **own support** begins a direct same-case anaphoric scope for the selected proposition.
3. The introduction precedes the anaphoric support in supplied source-item order.
4. Exactly one introduction/identifier pair satisfies those constraints for that anaphor. Any competing identity, repeated different case introduction, omitted span, or unresolved ordering returns no witness.
5. The candidate's own frame contains both exact spans; a sibling candidate's support/frame cannot supply either half.

Initial closed forms can be deliberately finite:

- English introduction: a clause-start affirmative subject followed by `proposes/proposed/suggests/suggested discussing/to discuss` and `a/the fictional/invented/made-up case/example/scenario about/concerning <identifier>`; optionally a direct declarative `This/The fictional ... case ... is about <identifier>` if separately needed and tested.
- Russian introduction: a clause-start affirmative subject followed by `предлагает/предложил(а)` plus `обсудить` and `вымышленный/придуманный случай/пример/сценарий про/о <identifier>`; optionally a closed declarative equivalent.
- English own-support anaphor: clause-start `In this/the/that same invented/fictional/made-up case/example/scenario, ...` or the exact source form `In the invented case, ...`.
- Russian own-support anaphor: clause-start `В этом/том же вымышленном/придуманном случае/примере/сценарии ...`.

Do not accept a generic occurrence of `fictional`, `case`, `in it`, or a nearby identifier. Whole quoted clauses must be masked. Conditional, example, question, denial, contrast, and retraction prefixes must fail. `another/a different/другом/ином case` is not a same-case anaphor.

When the one witnessed identifier is absent from either normalized candidate prose or normalized `record.subject`, add it to the existing `missingIdentifiers` entry for that original index and emit the existing typed validation failure. Merge and deduplicate it with identifiers found by the current subject-driven floor. That routes the candidate through the existing full presemantic repair and `source_identifier_context`; it does not alter the candidate deterministically.

The advisory context should retain its current limits: at most four identifiers, four complete source spans, and 1,200 units. Its occurrence/span counts remain search context only. The repair model must choose the exact introducing and anaphoric spans that establish this candidate's attachment, put the identifier in both readable text and subject, and keep the selected fictional promise's own actor, recipient, object, duration, and hypothetical scope. Full-vector cleaning and mandatory original-source verification then judge the repair.

## Why this is safe enough

This is a presence obligation, not an ownership or semantic inference. It cannot write a page, mark a candidate correct, or establish that a promise is real. It merely catches a generated candidate that discarded the sole source identity explicitly attached through a closed fictional-case anaphor.

The witness is narrower than scanning every frame identifier:

- only one identifier from a complete introduction is eligible;
- the candidate's own support must explicitly enter the same fictional case;
- both spans must be exact, candidate-owned, ordered, and unambiguous;
- no sibling, query, page title, model summary, or paragraph-wide context contributes authority;
- unknown or ambiguous shapes retain current behavior.

This also avoids changing placement authority. Ownership still receives only a repaired self-contained candidate and allowed page profiles, and it must independently resolve the destination. If the repair cannot preserve the attachment and all roles within the 400-unit cap, the candidate remains held.

## Rejected alternatives

### More prompt text

The contract already states the obligation. Additional repetition does not close the deterministic escape where both prose and subject omit the identifier.

### Deterministically add the identifier or page

The server should not synthesize candidate prose, subject, or destination from the witness. Even a structurally unique anaphor can carry qualifiers or role relationships that require model interpretation. The existing one-repair call plus full semantic verification is the appropriate boundary.

### Pass source frames directly to ownership

That would allow hidden source context to compensate for a non-self-contained retained proposition and risks making advisory source/sibling material into page authority. Repair the readable proposition first; keep ownership unchanged.

## Required controls

### Positive recognition and repair

1. English two-item source: `Ada Marlow proposes discussing an invented case about Zephyr QX-100.` followed by own support `In the invented case, Vulpine Mutual promises ...`; omission from both candidate text and subject produces one missing identifier and the bounded advisory context.
2. Equivalent Russian introduction and same-case anaphor.
3. Identifier present only in prose or only in subject still triggers repair; presence in both passes this floor.
4. Existing subject-driven missing-identifier behavior remains and deduplicates the same identifier.
5. A successful repair preserves original index, exact introducing/support frame, hypothetical commitment, promisor, recipient, object, duration, and source polarity; admitted siblings remain byte-identical. A semantic-negative repair with changed roles or fictional scope remains rejected.

### Ambiguity and ownership negatives

6. Two eligible introductions with different identifiers before one `in the invented case` anaphor produce no deterministic witness.
7. An introduction about one case followed by `in another/a different invented case` does not link.
8. The identifier exists only in a sibling's support/frame, a query, proposed page, or ordinary context: no witness.
9. The introduction follows the anaphoric proposition in source order: no witness.
10. The direct support has no fictional-case anaphor (`in it`, `the promise`, generic `in a case`): no witness.

### Clause and source boundaries

11. Quoted introduction or quoted anaphoric proposition, hypothetical `if/suppose`, `for example`, question, explicit denial (`Ada did not propose...`), reported uncertainty, or immediate retraction does not activate.
12. A semicolon/new sentence does not permit splicing a negated/question prefix into an affirmative-looking introduction.
13. A source span over the per-span/budget limit, omitted exact span, duplicate item ambiguity, or more than the bounded advisory identifiers fails closed without clipping.
14. Ordinary fictional records with no named alphanumeric subject, and all provided candidates, retain current behavior.

## Implementation boundary

Keep the helper private to retention cleaning unless direct deterministic tests need a narrow export. Derive the witness only after support/frame exact-source validation and before the current generated subject-identifier block. Merge its result into `missingIdentifiers` and reuse the existing full repair branch, diagnostics, caps, immutable-survivor logic, final language check, and mandatory source verifier. No new schema, pass, retry, page inference, or public field is needed.

## Disposition

The bounded witness above is the smallest coherent structural fix. It closes the V76 text-and-subject omission while preserving ambiguity holds, ownership independence, source-frame authority, repair immutability, and mandatory semantics.
