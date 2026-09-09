# V73 conditional design review: exact antecedent-span roles for an independent denial

## Scope and conclusion

This review uses only the exposed V72 built rejected case, its preserved forensic/design notes, and current exact-span code. It makes no claim about the running V73 probes and is not authorization to change V73.

The smallest safe correction is a **private, repair-only frame-role envelope** for the already typed missing-subject-identifier failure. It should let a repair identify one exact source occurrence as `subject_antecedent` while keeping the denial's exact sentence as the only `deciding_proposition` span. Local discourse checks evaluate only deciding spans; identity checks may also inspect the antecedent span. The complete original source and both roles still go to the mandatory verifier.

The public retained-candidate schema, persisted prose, output caps, model count, one-repair limit, and semantic gates can remain unchanged.

## Why the existing repair fails

The source independently states:

> `No pickup of the device has been booked.`

The prior item names the device as Zephyr QX-100 but discusses a rejected laboratory offer. V72 correctly held the initial candidate because its declared/readable Zephyr identity was absent from its deciding frame. The repair then supplied both the full no-pickup/rejected-shipment item and the earlier offer sentence as ordinary support/frame spans. That made the neighboring rejection look like governing discourse for the asserted denial. `leadingIndependentDenial` also requires a singleton support/frame, so it could not distinguish the added identity context. The faithful repair was held before semantics.

The issue is not lack of source context. It is loss of the **role** of each exact span.

## Private repair representation

For a repair target whose private typed issue is exactly `missing_subject_identifier`, build a server-owned span catalog scoped to that candidate index. Each entry has an opaque ID, item ID, exact quote, identifier, and occurrence coordinates. The model may return:

```json
{
  "candidate_index": 1,
  "candidate": { "...": "existing full candidate shape" },
  "frame_roles": {
    "deciding_proposition_span_ids": ["D1"],
    "subject_antecedent_span_id": "A1"
  }
}
```

This envelope is private to the repair transaction. `D1` and `A1` are server-assigned and candidate-local. The response cannot supply quotes, item IDs, coordinates, identifier strings, or new span IDs inside `frame_roles`.

For the exposed shape:

- `D1` resolves to the exact sentence `No pickup of the device has been booked.`
- `A1` resolves to the exact `Zephyr QX-100` occurrence in the earlier source item, preferably the minimal identifier occurrence rather than the whole rejected-offer sentence.

The candidate's readable text must still explicitly say both the no-pickup proposition and Zephyr QX-100. The private antecedent role does not authorize the server to insert either into prose.

## Deterministic validation

Activate this branch only when the original position has the private missing-identifier issue and no other earlier local issue. Never infer eligibility from the public `validation_failed` reason or its prose. A mixed/multiple issue uses the existing full-candidate repair and gains no scope exemption.

Before reconstruction, require:

1. exact original candidate index, unique within the transaction;
2. one nonempty bounded deciding-ID set and exactly one antecedent ID;
3. every ID belongs to that target's server catalog and no ID appears in both roles;
4. each resolved quote remains byte-exact within the declared source item and occurrence;
5. the selected antecedent is the same normalized identifier claimed by repaired `subject` and readable prose;
6. the repaired proposition is an asserted/active, self-attested, negated independent booking/pickup/collection denial under the existing closed grammar;
7. deciding spans contain that exact denial and no quoted, conditional, questioned, retracted, hypothetical, fictional, proposed, or rejected scope governing it;
8. the antecedent span is used only for identity; its neighboring source sentence is not copied into deciding scope; and
9. all non-role candidate fields still pass the ordinary full schema and all current source-span checks.

The server should reconstruct a normal frame from the exact deciding quote plus the minimal exact antecedent occurrence. Proposition support remains the deciding denial; the antecedent can be frame-only context. This satisfies the current invariant that every support span is covered by the frame without falsely calling the identifier token proposition support. Subject/frame identity can inspect both roles, while `UNSAFE_DISCOURSE`, `leadingIndependentDenial`, and commitment checks inspect only the deciding role.

If the implementation cannot preserve role separation through cleaning, it must hold. It must not append a full antecedent sentence and then merely mask its rejection tokens.

## Authority and laundering protections

An exact occurrence proves only that source bytes contain an identifier. It does not prove that `the device` denotes it. The model's selection is a proposal, not authority. The mandatory retention verifier receives:

- the complete original source;
- the repaired candidate and original repair obligation;
- the exact deciding and antecedent spans with their server-owned roles; and
- any other candidates as related context, never evidence.

It must independently reject wrong coreference, changed actor/object/booking status, omitted negation, retraction, or an antecedent belonging to another proposition. All three semantic booleans and source-selected polarity remain mandatory. A positive local role validation cannot write a record, and a negative semantic verdict cannot be repaired or retried.

Do not choose an antecedent because it is the only global identifier, appears in a title, is lexically close, or belongs to an admitted sibling. Do not derive actor Ada from the antecedent; actor and self-attestation remain supported by the denial item's speaker/source. Do not treat an identifier inside quoted/example/conditional text as a live antecedent without semantic confirmation.

## Schema, cap, and pass impact

The public candidate schema need not change. The existing repair response gains a strict target-specific private branch or fields. Use server-assigned enums and `anyOf`, avoiding `const`/`oneOf`, with `additionalProperties: false`. The small ID payload should fit inside the current repair output allowance better than repeating source quotes. It adds no model call, retry, or semantic pass.

The persisted candidate can retain ordinary exact support/frame arrays after server reconstruction; the role annotation itself need not be public or user-visible. If future verification/replay needs the distinction, store it only in the internal receipt/proof record, not in Markdown or the public operation result.

## Required controls

1. Exact V72 shape: independent denial `D1`, minimal Zephyr antecedent `A1`, neighboring rejected offer present in complete source; candidate reaches both positive and negative semantic verdict controls.
2. Wrong product among two identifiers; antecedent attached to another device; ambiguous repeated identifier; title/header-only and quoted-only occurrence.
3. Antecedent full sentence contains rejection/hypothesis/question, proving only the minimal selected occurrence is identity context and cannot govern the denial.
4. Deciding span includes `The offered shipment was rejected`, proving it remains held; role labels cannot launder mixed scope.
5. `The denial was rejected`, `Ada rejected the no-pickup claim`, quoted denial, conditional denial, question, later retraction, and positive booked pickup all remain held.
6. Changed Ada actor, pickup/collection object, Zephyr identifier, negation, booking predicate, attribution, polarity, support bytes, item ID, or original position.
7. Foreign, duplicate, stale, cross-target, missing, or extra role IDs; same ID in both roles; multiple antecedents; unexpected quote fields; truncated/trailing JSON.
8. Mixed repair transaction with another ordinary failure retains strict branch ownership and immutable admitted siblings.
9. Exact caller-provided/provided-candidate paths remain unchanged and never receive the repair-only role mechanism.
10. Chat and Responses wire schemas preserve strict required fields, enums, `anyOf`, existing caller/role caps, and one repair call. Deterministic controls claim plumbing only, not model coreference competence.

## Recommendation

Keep this as a conditional post-V73 scope. If retained-set completeness warrants it, implement a candidate-local `deciding_proposition`/`subject_antecedent` repair envelope rather than widening the rejection exception. Use the minimal exact identifier occurrence for identity, keep the denial sentence as the sole deciding support, and require the unchanged full-source semantic verifier to decide coreference. This preserves the independent no-pickup fact without importing the neighboring rejected offer's modality or allowing source laundering.
