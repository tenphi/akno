# V62 row 99 availability correction

This note preserves the earlier forensic files unchanged and corrects their causal account of selected trace row 99.

## Exact trace value

The answer verifier transport completed successfully (`ok:true`, `reason:null`) and returned a complete JSON value. For E1 it emitted:

- `actor`: `relation:"omitted"`, `answer_anchor:null`;
- `object_and_mechanism`: `relation:"preserved"`, with a non-null answer anchor;
- `qualification`: `relation:"omitted"`, **with non-null** `answer_anchor:"B1_cbfe3697c41d_2"`;
- semantic booleans: proposition `true`, action arguments `true`, qualification scope `false`;
- one qualification-scope mismatch.

## Actual schema path

`alignmentSchema` requires `relation:"omitted"` if and only if `answer_anchor` is null. The E1 qualification entry violates that refinement because it combines `omitted` with a non-null answer anchor. Consequently the enclosing `liveSchema.safeParse(strictAnswerJson(result.value))` fails. `verifyAnswerBlocks` returns `ok:false` with the invalid-structured-verdict note, and the public operation maps that verifier failure to `reason_code:"verification_unavailable"` / `answer_verification_failed`.

Thus row 99 is unavailable because of the invalid **qualification alignment coordinate pair**, not because an actor-negative alignment was inconsistent with `action_arguments_preserved:true`.

## Counterfactual distinction

The actor entry itself is schema-valid: `omitted` has a null answer anchor. Neither `semanticVerdictConsistent` nor the schema requires every negative actor alignment to force the action boolean false. If the qualification entry had been structurally valid, parsing could complete. `answerAlignmentsSupported` would then return false because the actor relation is neither `preserved` nor `not_selected`; the block would be removed through the ordinary semantic-support path and, with no surviving block, reported as `verification_rejected`.

This distinction matters for controls:

- negative but structurally valid alignment => parsed verifier result, unsupported block, ordinary rejection;
- `omitted` plus non-null answer anchor => invalid verdict schema, verifier unavailable.

The underlying draft remains independently assessable as faithful record-level wording, but that semantic judgment does not alter the production cause above.
