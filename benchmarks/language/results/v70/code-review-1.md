# V70 independent code review — round 1

Reviewed the uncommitted diff against `6444de3`, the V70 plan, implementation and meaningful tests. Read-only: no provider call, private configuration/KB access, runtime edit, or GitHub mutation.

## Finding

### Medium — selected-property consistency is parser-only and absent from the provider schema

**Location:** `packages/core/src/ops/answer-source-audit.ts`, `answerAlignmentSchema`, approximately lines 174–190.

The new property subcomparison itself has sound strict `anyOf` null/relation arms, but the rule that a selected `tested_property` requires a selected `object_and_operation` is implemented with Zod `.refine(...)` on each alignment entry:

```ts
entry.tested_property.relation === 'not_selected' ||
  entry.object_and_operation.relation !== 'not_selected'
```

That refinement is enforced only after decoding. It is not represented in the JSON schema sent to Chat/Responses. The provider-visible schema independently exposes every `object_and_operation` arm and every `tested_property` arm, so it permits, for example:

```json
{
  "object_and_operation": {
    "source_anchor": null,
    "answer_anchor": null,
    "source_specifics": null,
    "answer_specifics": null,
    "relation": "not_selected"
  },
  "tested_property": {
    "source_anchor": "E1_source",
    "answer_anchor": "B1_answer",
    "source_property": "Electrical continuity",
    "answer_property": "Integrity",
    "relation": "changed"
  }
}
```

The local parser correctly rejects that pair, but an otherwise schema-valid provider response becomes `bad_response`/verification unavailable instead of a valid negative semantic verdict. This repeats the class of provider-invisible relation/null consistency that earlier revisions moved into wire unions. Current provider-schema tests inspect the two fields' arms independently and therefore do not detect the gap.

**Bounded fix:** make the operation/property pair provider-visible as an `anyOf` union of strict shapes:

1. property is all-null `not_selected`, with any valid operation arm; or
2. property is present/omitted/answer-added, with an operation arm that excludes both `not_selected` variants.

This can be a nested strict `mechanism` object or an entry-level union. Keep the same field names, enums, caps and acceptance logic. Do not use `oneOf`, `const`, or a refinement as the only enforcement. Add an actual wire-schema negative proving the inconsistent pair above is not admitted, plus valid generic-test/not-selected, preserved, omitted, answer-added and negative-property echoes for both Chat and Responses schema paths.

The separate rule that all four categories cannot be `not_selected` is also a refinement inherited from the prior three-category design. It remains parser-only. It is not necessary to redesign that broader existing rule for this bounded property change, but the newly introduced operation/property dependency should not add another provider-invisible cross-field invariant.

## Other reviewed boundaries

- `tested_property` has distinct strict arms for present comparison, omitted answer property, answer-added property, and all-null not-selected. `answerAlignmentsSupported` validates source anchors against the current evidence record and answer anchors against the current block, then rejects every generalized/changed/omitted relation. A positive property relation cannot override the existing three semantic booleans or excerpt selection.
- Splitting 50+50 operation descriptions and 30+30 property descriptions preserves the prior 160-character aggregate allowance. Null arms do not manufacture descriptions. Ordinary non-test records retain an all-null property path.
- The answer-verifier prompt clearly separates tested property from object/operation and explicitly covers omitted, added and unspecified properties. This replaces, rather than merely appends to, the former joint comparison language. The V69 continuity/integrity negative, omission, addition, semantic-negative, mixed-citation and anchor/null tests exercise the intended acceptance boundary.
- Retention now permits one compact record with short complete sentences while preserving the unchanged normalized 400-unit cap, one repair, immutable admitted siblings, and mandatory full-source verification. The generated-only guidance explicitly distinguishes lacking/receiving evidence from personally checking it. Tests include a source-faithful split-clause repair and a changed possession-to-performance semantic rejection.
- Translation guidance keeps exact supplied names, conditional antecedent/consequence, source-relative timing, processing contrast and unknown calendar status tied to selected retained content. It expressly forbids introducing absent roles, time, property or unknownness. Existing language and semantic gates remain mandatory.
- Prompt versions and benchmark expectations move coherently to answer generation/verifier 65/45 and retention extraction 51 with retention verifier unchanged at 34. The plan keeps models, 2,400-token isolated cap, one repair, no semantic retry, thresholds and fresh-held-out boundary unchanged.

## Disposition

One medium provider-contract blocker remains: encode the new selected-property/selected-operation dependency in the wire schema and test the actual emitted schema. I found no separate semantic-gate relaxation, source-authority expansion, cap change, or retention immutability defect in the reviewed diff.

I did not execute the reported 746 targeted tests or the still-running typecheck/complete-record tests; those results remain root-owned evidence.
