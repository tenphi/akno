# V51 code review — round 1

## Finding

No actionable correctness finding in the reviewed V51 implementation.

## Schema construction

- A one-candidate batch uses its strict object shape directly. A two-candidate batch uses an explicit two-branch `z.union`, which `toEndpointSchema` serializes as `anyOf` below the root object.
- Each branch requires a single-value `candidate_id` enum. Those enums are distinct, so the branches remain mutually exclusive without introducing a new `const` encoding.
- `z.strictObject` makes the local contract match the wire contract: a single-frame verdict cannot smuggle in `span_audit`, while a multi-frame verdict must contain its candidate-specific audit.
- The existing post-parse verdict count/ID checks, exact span set/uniqueness refinement, strict terminal `JSON.parse`, three semantic dimensions, and reason consistency remain unchanged. Constrained decoding still does not replace caller validation.
- The implementation remains safe under the current two-candidate batch invariant. The explicit `[0]`/`[1]` construction ensures a future batch-size change requires a corresponding code change rather than silently producing a different combinator.

## Transport tests

The 16 cases cover chat and Responses transports across all five single/multi-frame configurations and three malformed branch outputs.

- Chat tests force the initial llama-style schema rung to fail, then inspect the actual OpenAI `json_schema` second request. Responses tests inspect `text.format` directly.
- Recursive checks reject `oneOf` anywhere and require every object to have all properties listed in `required` and `additionalProperties: false`.
- Tests assert a direct object for one candidate and two `anyOf` branches for two candidates, including each branch's singleton candidate enum and candidate-specific span requirements.
- Swapped audits with differing frame cardinality, an unexpected audit on the single-frame branch, and a foreign candidate ID all fail locally with `retain_verification_failed`.
- A successful second chat rung sends no third plain-JSON request. Call counts therefore cover compatibility transport without introducing another logical model operation.

One finite limitation is intentional: two candidates with equal frame counts use the same local `F1..Fn` coordinate vocabulary inside their separate verdict branches. The schema cannot judge whether interpretation prose semantically describes the right candidate; that remains the model's required source comparison. Candidate nesting, literal IDs, and the full semantic verdict keep the structural pairing unambiguous.

## Post-freeze protocol-only control

A post-freeze control is appropriate before any semantic benchmark retry, but it should prove transport rather than claim semantic quality:

1. Use an isolated temporary knowledge base and invented structured source designed to yield two distinct candidates, with at least one candidate requiring a two-span frame.
2. Run one ordinary retention operation through the frozen deployed package/provider. Do not loop or alter the prompt to obtain a desired semantic result.
3. Preserve the trace/call receipt showing that extraction produced the intended batch shape and that the verifier transport completed with non-null usage and no schema/provider failure. A semantic hold is acceptable evidence of protocol success; only `retain_verification_failed`/transport failure defeats the control.
4. Verify temporary source-byte behavior and discard the temporary workspace afterward. Keep this result separate from language benchmark scoring and do not count it as a retry of V50.

If extraction does not produce the intended two-candidate shape on that one attempt, the control is inconclusive rather than failed or repeatable until convenient. The existing actual-ModelClient stub tests still prove all five deterministic shapes; the deployed control's purpose is only to show that the configured live endpoint accepts the corrected wire schema.

## Disposition

The direct-single/`anyOf`-two fix removes the unsupported `oneOf` transport while preserving all V50 semantic, frame-accounting, batching, budget, provider-ceiling, strict-JSON, and no-retry invariants. Clean for freeze on the reviewed boundary.
