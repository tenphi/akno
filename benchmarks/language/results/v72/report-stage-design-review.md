# V72 selected report-stage source-first review and next-design assessment

## Scope

This review is limited to selected V72 trace rows 2, 4, 5, and 6 and the exact structured source carried in those calls. It makes no claim about the unfinished probe's answer score. I replayed both candidate objects through the frozen `tmp/core-v72` cleaner with the exact source items; no provider was called and no runtime file was changed.

## Source meaning

The source establishes:

1. Ada Marlow passes on Bo Winters's account without having read the agreement or independently checked that account.
2. Bo says the agreement permits sending Zephyr QX-100 to the workshop to measure the gap at the latch.
3. The Russian clarification binds this to measuring the latch gap rather than `меняется защёлка`, identifies the content as Bo's words in Ada's retelling, and says Ada did not personally verify it.
4. Separately, Ada has not arranged delivery of her Zephyr QX-100.

`меняется защёлка` can be read contextually as replacement or more literally as changing the latch. Both V72 candidates use `not to change the latch`. I treat that as source-supported literal wording, with a precision ambiguity: English `change` can cover adjustment more broadly than Russian `менять` in this measure-versus-replace contrast. It is not a clear unsupported assertion from this source alone, but a future translation may prefer `replace` if the complete bilingual clarification resolves that sense. This lexical question is not the cause of the observed hold.

## Exact stage evidence

Trace row 2 generates two candidates. The separate delivery denial is faithful and has `polarity: negated`. The main report candidate is:

> According to Bo Winters, the agreement permits sending Zephyr QX-100 to a workshop to measure the gap at the latch, not to change the latch. Ada Marlow is only passing on this account: she has not read the agreement or independently checked the account, and she did not herself verify this meaning.

It preserves report content, reporter/relayer roles, the workshop permission, measured object/property, contrast, unread agreement, lack of independent checking, and Ada's personal nonverification. The colon introduces an explanation under the same Ada subject; it does not move the personal limits into Bo's speech.

The sole repair at row 4 keeps the same propositions and emits:

> According to Bo Winters, the agreement permits sending Zephyr QX-100 to a workshop to measure the gap at the latch, not to change the latch. Ada Marlow is only passing on Bo Winters’s account: she has not read the agreement or independently checked the account, and she has not herself checked this meaning.

This repeats Ada's explicit subject before the colon and repeats negative `has not` for the final personal check. It remains source-faithful. `checked this meaning` is a reasonable rendering of Ada's `сама я его не проверяла`; it does not claim absence of external confirmation or conflate receipt with performance.

Frozen `cleanCandidateBatch` replay gives the same result for each exact object:

| candidate | UTF-16 units | admitted | exact hold |
| --- | ---: | ---: | --- |
| initial row 2 | 298 | 0 | `discourse_uncertain`: source report verification limit not recognized in a closed readable clause |
| repair row 4 | 307 | 0 | same |

The source side itself satisfies `hasReportUncertainty`. Both generated candidates fail it. The colon after `Ada Marlow is only passing on ...` is outside the helper's clause-start/relay forms; the initial candidate also continues the recognized pair with `and she did not herself verify`, while the repair uses a repeated negative auxiliary `and she has not herself checked` after the colon. V72's new literal `personally` addition does not apply to either actual wording.

Row 5 consequently sends only the delivery denial to the semantic verifier. It returns source-selected polarity `negated`, all three semantic dimensions true, and no mismatch. Row 6 routes that survivor to the existing Zephyr page. The main report never reaches semantic verification. This is a deterministic presentation false hold followed by a complete main-record retention loss, not a semantic negative, ownership failure, malformed response, cap failure, or provider unavailability.

## Design conclusion

This repeated family no longer supports adding another literal phrase to `hasReportUncertainty`. V69–V72 have produced several source-faithful arrangements—relay before the negative list, relay in a prior clause, a colon explanation, a shared auxiliary, a repeated auxiliary, reflexive and `personally` variants. Each regex expansion admits one surface while leaving the model free to choose another. The source/actor/object semantic distinctions remain necessary, but presentation should be made representable rather than guessed from an open prose sentence.

The smallest coherent next design is a **repair-only structured text representation** for a candidate already held specifically by the report-uncertainty presentation guard:

- Keep the same one repair call and candidate index. Never alter or merge an admitted sibling.
- For only that repair target, require strict model-owned prose segments such as `reported_proposition`, `relay_attribution`, and `personal_limits`. Do not accept a parallel free `text` field for that branch.
- Each segment is final retained prose. The server adds only fixed spaces (or a single sentence separator after validating terminal punctuation), then assigns the exact concatenation to candidate `text` before the existing 400-UTF-16-unit check and all current local/semantic checks.
- `reported_proposition` must carry the actual report content and inner source. `relay_attribution` must carry the outer relayer when the source requires it. `personal_limits` must be a short complete sentence with its own explicit actor and the source-supported negative predicates/objects. The segment names are presentation instructions, not evidence.
- Preserve attribution metadata, support, discourse frame, subject/page, polarity, and the original candidate's repair obligations. Full original-source semantic verification remains mandatory and can reject changed reporter, actor, predicate, object, polarity, or qualification.
- Do not deterministically synthesize `Ada`, `Bo`, `not read`, `not checked`, or any semantic text. Do not use the delivery sibling as report authority. Do not retry a semantic rejection.

A two-segment version (`reported_content`, `personal_limits`) is cheaper, but it still allows outer relay attribution to disappear into either segment. Three short fields better reflect the three independently load-bearing scopes exposed by this source. Their combined character maxima plus the two joining separators should remain at or below the existing 400-unit candidate cap. This changes a private repair schema only; persisted/public memory format remains the materialized prose record.

## Budget and transport bounds

The structured repair adds schema keys and punctuation but no free-text allowance beyond the existing 400-unit candidate text cap and no call. Partitioning might use conservative maxima whose sum plus separators is exactly 400, while retaining nonempty minimums. The dynamic repair response already contains the complete candidate object, so provider-schema size will rise; both Chat and Responses schemas need strict-mode inspection and one frozen exact-echo control. Actual output sufficiency under the configured role ceiling remains an empirical control/probe question, not a consequence of character arithmetic.

If that schema overhead proves disproportionate, the narrower alternative is to change the repair contract to require the personal limits as one independent complete sentence and reject colon/semicolon attachment deterministically. That is less structural and can still miss other grammatical surfaces, but it is preferable to another positive regex enumeration.

## Minimum controls

1. Exact row-2 and row-4 source/candidates: initial held, structured repair materializes a faithful three-sentence record, then reaches a positive semantic verdict.
2. Preserve the exact delivery denial as an immutable admitted sibling; repair cannot replace, merge, or mutate it.
3. Missing, empty, extra, reordered-ID, foreign-index, legacy free-text, over-partition, aggregate-over-400, truncation, and trailing-JSON responses fail closed with no fallback or second repair.
4. Wrong inner reporter, outer relayer, person, report object, device, measured property, workshop permission, or change/replacement contrast reaches the mandatory semantic verifier and is rejected.
5. Positive `read/checked/verified`, missing negation, nonverification of a device rather than the report/meaning, and received-no-confirmation substituted for personal checking are rejected.
6. Quoted/example/question/conditional/negated-meta segments, a following retraction, and a new competing subject cannot satisfy the personal-limit obligation.
7. Exact names come only from supplied source attribution/frame data. Generic assistant handling remains distinct; no inferred gender or short-name alias is added by the schema.
8. Complete source text and all original frame spans remain in the semantic verifier call. A model-positive structured repair with a deliberately wrong proposition must still be held.
9. Matching source/candidate polarity is required but cannot override any negative semantic dimension.
10. Chat and Responses emit strict required objects with `additionalProperties: false`, no unsupported `oneOf`/`const`, the same call count, and disclosed effective token ceilings.

## Recommendation

Defer implementation until the complete V72 evidence is preserved, as planned. For the next declared revision, prefer the repair-only structured sentence representation over expanding the report regex with `colon + repeated has not + herself`. It addresses the recurring root cause while retaining the current actor, object, negation, quotation, clause-origin, cap, immutable-sibling, polarity, and full-source semantic protections.

## Refinement: text-only repair delta with cloned candidate fields

The proposed refinement is sound, but the current cleaner does not expose a sufficiently specific typed discriminator to activate it safely. `cleanCandidateBatchWithPositions` emits only public `reason_code` and explanatory `reason` for most holds. The report-uncertainty guard emits `discourse_uncertain`, which is also used by invalid discourse, incomplete frames, attribution failures, polarity/agency floors, and other guards. The prose reason is diagnostic output and must not select a schema branch. `missingIdentifiers` is the one existing private typed diagnosis; report uncertainty needs an analogous private issue kind emitted directly at the guard, for example `report_uncertainty_unreadable` keyed by original candidate index.

Eligibility should be deliberately narrow:

- The original extraction candidate parsed far enough to reach that exact guard, is generated, and has exactly one private validation issue: `report_uncertainty_unreadable`.
- If the position has any additional issue, or the typed issue is absent/ambiguous, use the existing full-candidate repair branch. A text-only repair cannot safely fix malformed spans, metadata, discourse, polarity, attribution, subject identity, or time fields.
- Mixed transactions can use a target-specific strict union: eligible indices accept only `{ candidate_index, reported_proposition, relay_attribution, personal_limits }`; other failed indices accept the existing full candidate. Index literals must remain mutually exclusive, and the transaction must still contain unique original indices. Use the already supported direct-object/`anyOf` transport pattern rather than `oneOf`.

For an eligible response, the server should retrieve the exact original candidate by `candidate_index`, clone every non-text field and proof field unchanged, validate and normalize the three segments, join them by one fixed documented separator, and replace only `text`. The response schema must reject `candidate`, `text`, metadata, support/frame, subject/page, relations, polarity, or other extra fields. This makes the immutability claim enforceable rather than prompt-based.

The reconstructed vector must then follow the current ordering visible in `runRetain`: place the reconstructed candidate at its original position, apply the same generated-frame processing policy, run `cleanCandidateBatchWithPositions` across the **full vector**, compare admitted siblings by original position and deep equality, record the original repair obligation, and only then run mandatory semantic verification against the complete original source. No segment-level success may admit a candidate directly. Because the original candidate has already passed span parsing and frame completion before reaching the report guard, the preferred implementation is to preserve its completed proof fields exactly; if `completeGeneratedFrames` is retained on the reconstructed vector for uniformity, a regression must prove it makes no change to those cloned fields.

The language boundary also needs explicit coverage. The current repair call's generated prose is normally discoverable through `candidate.text`. A segmented branch has no such field. Its three segments, or their exact server-materialized concatenation, must be supplied to the existing ModelClient language check through the same call. Otherwise the new branch could bypass the target-language check before local reconstruction. This is still one call and one language verdict.

Multiple issues deserve closed behavior rather than best-effort repair. A candidate with report uncertainty plus any other typed/local issue uses the full-candidate branch; if the model returns the text-only shape for it, parsing fails. After a text-only repair, any newly exposed or repeated issue in the full-vector cleaner simply holds the candidate. There is no fallback to full repair and no second call. Likewise, a text-only response that fixes the surface form but changes meaning is held by the unchanged semantic verifier.

Additional controls for this refinement:

1. Exact V72 report target gets the text-only branch; the denial sibling stays byte/deep-equal and cannot appear in the repair response.
2. Another `discourse_uncertain` cause gets the full-candidate branch, proving no reason-string classification.
3. A target with both the typed report issue and another issue is ineligible for text-only repair.
4. Attempts to return changed attribution, discourse, epistemic state, polarity, support/frame, subject/page, relations, or proof fields fail strict parsing.
5. The materialized text is checked for language, four-word/statement/400-unit constraints, report uncertainty, all other local floors, vector interactions, and full original-source semantics in that order; each negative is exercised independently.
6. Mixed text-only/full repair schemas work in both Chat and Responses transport, reject foreign/duplicate indices and unexpected fields, and preserve the current call count and effective token ceilings.

This refinement is preferable to asking the model to repeat the full candidate for the observed presentation-only failure. It reduces output and prevents unrelated metadata/proof mutation. It is not implementable safely by reusing the current broad `discourse_uncertain` code alone; the private guard-origin tag is the necessary enabling change.
