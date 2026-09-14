# V73 retention-verifier evidence design review

## Source-first finding

The first built report is a **false semantic hold caused by the verifier treating its own comparison rewrite as candidate evidence**.

The complete original source in `tmp/language-built-output-packet-v73.json`, case `v19-held-report`, establishes:

- Ada Marlow has not read the service terms and has no independent confirmation of the report;
- no collection of her device has been booked, as a separate direct denial;
- Bo Winters told Ada that the Zephyr QX-100 terms permit sending the device to a service bench to measure return-spring tension;
- the Russian clarification restricts that report to tension measurement rather than spring replacement and says it is Bo's wording in Ada's retelling, not a condition Ada verified.

Trace row 2 extracts two records. The no-collection denial is faithful. The report candidate is also faithful: it names Ada as outer relayer and Bo as inner reporter; preserves permission, service-bench destination, return-spring tension measurement and replacement exclusion; and preserves Ada's unread, independently unconfirmed and not-personally-verified limits. Its declared polarity is affirmed, which is correct for the positive act of reporting Bo's permission claim despite the negative personal limits.

The extraction language check in row 1 sees that exact report candidate and returns compliant. The candidate contains no CJK text.

Trace row 3 then produces a retain-verifier verdict whose frame audit, source meaning, action arguments, qualification scope, source-selected polarity and two non-proposition booleans all support the candidate. The sole negative is:

```text
candidate_meaning: ... independently confirmed the報告.
mismatch detail: The candidate contains the stray non-English word "報告" ...
proposition_supported: false
```

`報告` occurs in neither the immutable candidate text nor any original source item. It was introduced by the verifier inside `comparison.candidate_meaning`, then cited by the verifier as if it had been present in the candidate. The runtime accepts that response shape because `semanticVerdictConsistent` checks only the one-to-one correspondence between false booleans and mismatch dimensions. Comparison and mismatch prose are length-bounded but are not tied to candidate/source bytes. The false proposition verdict therefore withholds the report, leaving only the unrelated no-collection record in the packet and making all eight focused report answers null.

This is not a language-check failure, extraction-language defect, source-polarity mismatch, frame omission or malformed response. It is a validly shaped but ungrounded negative semantic verdict. The verifier remains authoritative about semantic judgment; its self-generated narrative is not authoritative evidence about what bytes the candidate contains.

## Smallest coherent correction

A further prose instruction is insufficient. The existing shared contract already says that comparison notes are not evidence, that `candidate_meaning` must retain actual added specifications, and that a mismatch must name a concrete conflicting candidate clause. Row 3 violates all three while remaining schema-valid.

The smallest general correction is a **private, candidate-specific exact-witness requirement inside the existing retention-verifier response**. It should apply to negative findings and to the source-selected governing predicate. It adds no public field, model pass, retry or semantic repair.

### 1. Bind the governing predicate before polarity

For each candidate verdict, require a `selected_predicate_witness` before the free comparison:

```text
source: { frame_id, exact_excerpt }
candidate: { exact_excerpt } or { metadata_field }
```

- `frame_id` must be a candidate-owned single-value/finite enum from that candidate's exact frame.
- The server must verify that `source.exact_excerpt` is a nonempty exact substring of that frame and that the candidate text excerpt is a nonempty exact substring of that candidate's current immutable `text`.
- A metadata witness is allowed only for a closed server-owned path such as `kind`, `discourse.commitment`, `discourse.disposition`, `epistemic.basis`, `polarity`, `time`, or `relations`; it identifies the submitted value and cannot carry model-written replacement text.
- The source excerpt identifies the actual governing proposition before `source_selected_polarity`. It does not prove the polarity or semantics by itself; the model still judges those from the complete source and frame.

For the exposed report, the source witness would point to the source permission/report predicate and the candidate witness to the candidate's corresponding `terms permit ... measure ...` clause. Neither can contain `報告`.

### 2. Require exact witnesses for every mismatch

Replace the current unconstrained mismatch record with strict, kind-specific private branches. Keep its dimension and kind, but require byte witnesses according to the asserted difference:

- `unsupported_content`: a candidate text witness is required; a source witness is nullable because absence from the complete source has no positive source substring.
- `omitted_scope`: a source witness is required and the candidate witness is null.
- `changed_value`, `changed_action_or_role`, `changed_qualification`, and `changed_repair_proposition`: both source and candidate witnesses are required.
- When the claimed difference is metadata-only, the candidate side uses one closed metadata-field pointer instead of pretending the value appears in prose.

Each text witness should carry its owning frame/candidate coordinate plus a short exact excerpt. Validate ownership and substring equality after strict JSON parsing and before `semanticVerdictConsistent`. A stale frame, sibling candidate, invented substring, empty excerpt, wrong metadata path, missing required side or non-null forbidden side makes the verifier response invalid. Preserve the current atomic fail-closed behavior: an invalid negative does **not** become an acceptance and does not trigger another call.

This would reject the exact row-3 response because its alleged offending excerpt `報告` is absent from the immutable candidate. If the model instead selects a real candidate clause and still assigns it the wrong meaning, the verdict can remain a false hold. Exact witnesses prevent comparison prose from being the sole evidence; they cannot mechanically decide natural-language equivalence.

### 3. Preserve the existing response budget

Do not add the witnesses on top of the current maximum free prose. Reallocate the existing 240-character mismatch-detail allowance, for example:

- source exact excerpt: at most 80 UTF-16 units;
- candidate exact excerpt: at most 80 UTF-16 units;
- relational explanation: at most 80 UTF-16 units.

Null sides do not lend their capacity to another field. Keep at most three mismatch records. The selected-predicate excerpts can use the same bounded witness shape and a short fixed cap; reduce free comparison allowance if necessary rather than raising the derive role or per-call maximum. Exact excerpts may be shorter than a whole proposition because the complete source, candidate and frame remain in the input.

JSON key overhead increases slightly even when semantic prose does not. Provider-shape controls must therefore capture the actual one- and two-candidate schemas at the unchanged role ceiling. If the strict shape cannot complete reliably under that ceiling, the design should be reduced before corpus execution rather than raising the cap.

## Why anchor IDs alone are insufficient

Server-generated segment IDs are useful for ownership, and the existing answer verifier demonstrates that pattern. A broad sentence anchor alone would not prevent this failure: the model could cite the report's final candidate sentence while still claiming that the sentence contains `報告`. The response needs a short exact excerpt that is validated against the selected immutable segment. The segment/frame ID binds ownership; the excerpt demonstrates which actual bytes the negative judgment concerns.

Requiring only an exact source quote is also insufficient for unsupported additions, because source absence cannot be quoted. Those findings must at least prove that the alleged added wording exists in the candidate. Conversely, an omission must identify the required source wording and use a null candidate witness rather than selecting nearby surviving text.

## Cases the contract must preserve

- **Wrong actor:** exact source and candidate actor/action excerpts; negative `action_arguments_preserved` remains final.
- **Wrong property or mechanism:** exact source property/mechanism and candidate replacement excerpts; the verifier still judges whether the change is material.
- **Wrong polarity:** source governing-predicate witness precedes `source_selected_polarity`; candidate text or closed polarity metadata is tied to the current candidate. The existing enum equality remains independently mandatory.
- **Unsupported addition:** candidate excerpt required, source null allowed; complete-source absence remains a model judgment.
- **Omitted qualification:** source excerpt required, candidate null; a neighboring candidate phrase cannot stand in for missing scope.
- **Positive reports with negative limits:** the selected predicate witness identifies the positive reporting/permission predicate, while separate mismatch witnesses can address genuinely lost personal limits.
- **Fictional/counterfactual positive predicates:** nonoccurrence language in the source does not change the witnessed embedded predicate's affirmative polarity; commitment remains a separate qualification.
- **Rejected positive actions:** the witnessed offered/proposed action remains affirmed and rejected disposition remains metadata.
- **Open questions:** witness the existence/content of the question, not an unresolved answer.
- **Caller-provided exact attestations:** preserve the existing bypass contract; do not add a verifier call to paths that currently do not call `verifyCandidateBatch`.

## Meaningful controls

1. Replay the exact V73 report candidate with a verdict that alleges `報告`; invented candidate excerpt must make the response invalid and retain no permission to write.
2. Use the same source/candidate with exact, owned witnesses and an all-true verdict; it reaches normal acceptance in the stubbed enforcement test.
3. Wrong actor, changed technical property, changed polarity, omitted personal limit, unsupported added action and changed repair proposition each use the appropriate strict witness branch and remain held.
4. Source-absence and candidate-omission branches require opposite null patterns. A source witness cannot be borrowed from a sibling frame or candidate.
5. Reject stale IDs, foreign frame IDs, non-substring excerpts, ambiguous ownership, empty strings, over-cap strings, unapproved metadata paths, duplicate mismatch dimensions and a false dimension without exactly one valid finding.
6. Preserve all-positive semantic verdicts, reason-code consistency, exact verdict-set validation, repair obligations and relation-dependent holds.
7. Capture Chat Completions and Responses endpoint schemas for singleton and two-candidate batches. Require strict objects, provider-supported `anyOf`, singleton enums rather than `const`, candidate-owned witness enums/coordinates and the intended witness → comparison → polarity → booleans field order.
8. Exercise the unchanged output ceiling with maximum allowed findings and frame audits. A malformed, truncated or witness-invalid response is one typed unavailable verification outcome with no retry.

## Recommendation

Implement only the private exact-witness contract for candidates already entering the existing retention verifier. Keep the complete original source and exact frames authoritative; use witnesses to bind the model's negative judgment to immutable bytes, not to prove semantic equivalence. Preserve atomic failure, all three booleans, mismatch consistency, source-polarity equality, repair obligations, current batching, current caps and the absence of semantic retry.

This design would have made the V73 row-3 reason visibly and mechanically ungrounded. It may improve model attention, but it does not guarantee that every grounded semantic judgment is correct. Independent exposed evaluation remains necessary.
