# V73 report text-only repair implementation review

## Scope and conclusion

I reviewed the V72 report-stage design and the current cleaner in `packages/core/src/write/retain.ts`. A private guard-origin tag is not sufficient eligibility evidence in the current control flow: the report-uncertainty check returns immediately, before speaker visibility, personal-action and proposal agency checks, time checks, canonical discourse checks, schema validation, and relation processing. The minimal sound design is to defer that one report check inside the canonical cleaner, let every other applicable candidate check run in its existing order, and expose text-only eligibility only after the candidate has passed those checks and strict raw-relation eligibility.

This should remain one validation path. A second cleaner mode that skips the report guard would create a second definition of admissibility and would need permanent parity tests. It is avoidable.

## Eligibility proof

During candidate cleaning, compute whether the source requires readable report uncertainty and whether the candidate text fails that presentation requirement, but do not return at that point. Continue through the existing outer-speaker, personal-action, proposal-agency, temporal, canonical discourse, fiction, and `ProvidedRetainCandidateSchema` checks. If any of those checks fails, return that ordinary failure and do not mark the position text-only eligible. If all pass, emit the report hold and a private typed eligibility entry keyed by the original extraction position.

Eligibility should require all of the following:

- generated candidate input;
- the exact report-uncertainty predicate is the deferred failure;
- all other applicable per-candidate checks, including `ProvidedRetainCandidateSchema`, passed;
- `record.relations` is an actual array whose length is exactly zero;
- the position and frame-completed original candidate are retained privately for reconstruction.

The raw-relation condition must be explicit. The current `candidateValue` passed to `ProvidedRetainCandidateSchema` sets `relations: []` unconditionally; the raw `record.relations` is cleaned later. Consequently, successful candidate-schema parsing does not prove that the model supplied an empty or even well-formed relation value. Missing, non-array, malformed, or nonempty raw relations should use the existing full-candidate repair branch. Treating missing relations as empty would widen the special branch beyond the declared typed shape.

The cleaner can return a private map such as `textOnlyReportRepairs: Map<number, CompletedCandidate>`. Its presence is the branch discriminator; public `reason_code` and reason prose remain diagnostic only. The stored value should be the exact frame-completed input object that passed the other checks, rather than the raw extraction object.

## Reconstruction and final authority

The repair response for an eligible index should contain only the index and three required strings. Strict parsing must reject a free `text`, candidate metadata, spans, relations, or extra fields. The server normalizes and validates each segment, joins them with exactly one ASCII space between adjacent segments, and replaces only `text` on a structured clone of the frame-completed original. Every other field, including support, discourse frame, attribution, discourse, epistemic state, polarity, time, destination, subject, and the empty relation array, remains byte/deep-equal at the object level.

The reconstructed candidate returns to its original vector position. The entire vector then goes through `completeGeneratedFrames` only if a regression proves that it is idempotent for the cloned proof fields, followed by the same canonical cleaner. The existing immutable-sibling comparison and lost-position check remain mandatory. No successful segment parse directly admits knowledge, and there is no fallback call if the reconstructed candidate fails.

The whole-vector reclean is essential for two interactions:

- Changing text changes the candidate ID and dedupe key. A repair could collide with an admitted sibling or another repair even though its original draft did not. The canonical reclean, original-position accounting, and immutable-sibling equality must reject that transaction rather than silently dropping or replacing a record.
- Relations can create dependency and target-order effects. Excluding every nonempty or malformed raw relation from text-only repair keeps those effects in the existing full-candidate path. The final vector pass still protects against an unexpected collision changing a sibling or its target identity.

Repair obligations should continue to bind semantic verification to the original candidate and complete original source. For the text-only branch, the obligation should be the pre-repair frame-completed candidate, since that is the object whose nontext semantics were certified and cloned. Language checking must receive either the three generated strings or their exact materialized concatenation in the same repair call; the absence of a `candidate.text` response field must not bypass requested-language validation.

## Guard priority

Deferring the report guard changes which public reason is observed for a report candidate that also has a later defect: the later concrete defect will be returned instead of the earlier broad `discourse_uncertain` report reason. That change is necessary if the returned report hold is to certify that no other applicable per-candidate issue was found.

Single-defect behavior remains compatible: candidates failing only the report presentation check still receive the same public reason code and prose, and all candidates without that issue follow the existing order. Tests should explicitly cover a report candidate with each later defect and assert that it is not text-only eligible. If preserving the old first reason for multi-defect candidates is a compatibility requirement, the cleaner may retain a private `otherIssue` while publishing the report reason, but that adds dual result state and is less clear than reporting the actionable non-report failure. It should not be implemented as a second skip-guard cleaner pass.

Vector-level relation validation occurs after the per-candidate loop. Because text-only eligibility requires a literal empty raw relation array, no relation can add a later issue to an eligible target. Dedupe remains a vector concern handled by the mandatory reclean rather than claimed as part of the initial sole-issue proof.

## Segment bounds

Use three nonempty, model-owned, terminally punctuated sentences and join them with two single spaces. A practical fixed partition is:

| Segment | Maximum UTF-16 units |
| --- | ---: |
| `reported_proposition` | 200 |
| `relay_attribution` | 78 |
| `personal_limits` | 120 |

The segment maxima total 398; the two separators produce an exact maximum of 400 normalized UTF-16 units. This gives the report proposition the largest share for product, permission, measured object/property, and corrective contrast; 78 units accommodates both invented names in a short relay sentence; 120 units accommodates multiple personal negative predicates and objects, including Russian wording. The limits apply after the same whitespace normalization used by the candidate cleaner. Do not truncate, borrow unused capacity dynamically, synthesize punctuation, or drop a qualification to fit. If a source-supported report cannot fit these fixed bounds, the model may omit the repair and the candidate remains held.

The exact longest invented EN and RU report controls should be measured before freezing these numbers. `200/68/130` is also arithmetically safe, but 68 leaves little margin for an explicit outer relayer plus inner reporter in Russian. The `200/78/120` split better balances the two shorter scopes while retaining the same total cap.

## Minimum implementation controls

1. A V72-shaped report candidate with valid empty raw relations and no other defect receives the segmented branch; its admitted denial sibling stays deep-equal.
2. The same candidate with missing, non-array, malformed, or nonempty raw relations uses the full-candidate branch.
3. Each later local defect independently prevents text-only eligibility, including missing outer speaker, personal actor loss, proposal actor loss, invalid time, canonical/modal conflict, fiction conflict, and final schema failure.
4. Missing/empty/extra segment fields, extra candidate fields, duplicate or foreign indices, over-budget segments, combined overflow, internal newline/NUL, or absent terminal punctuation fail closed.
5. Materialized text is rechecked for statement shape, report uncertainty, language, complete local validation, dedupe/vector interactions, and full original-source semantic fidelity.
6. A text collision with an admitted sibling or another repair cannot silently remove either original position.
7. `completeGeneratedFrames` is either skipped for the reconstructed already-completed object or proven idempotent over every cloned nontext/proof field.
8. Chat and Responses strict schemas accept the mixed segmented/full repair transaction without widening either branch, adding a call, or changing the 400-unit persisted-text limit.

Implementation should begin only after the complete V72 evidence is preserved, as planned.
