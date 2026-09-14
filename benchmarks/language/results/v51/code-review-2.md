# V51 retention-schema code review round 2

## Scope

Reviewed only the V51 `packages/core/src/write/retain.ts` diff against frozen V50 and the new `packages/core/src/write/retention-schema-transport.test.ts`. I did not inspect corpus outputs, make provider calls, edit implementation/tracked files, or broaden the semantic design.

## Result

No code-review findings in the requested scope.

The change removes the V50 transport regression without weakening the semantic or exact-set boundary:

- A one-candidate batch sends the candidate's strict object directly as `verdicts.items`, so it emits neither a redundant union nor `oneOf`.
- A two-candidate batch uses an ordinary Zod union, which emits `anyOf` with exactly two branches.
- Each branch uses a required single-value `candidate_id` enum. This restores the previously accepted ID representation and avoids the V50 `const` discriminator encoding.
- `z.strictObject` makes the runtime candidate branch agree with its emitted `additionalProperties:false` contract. This matters when an endpoint falls back to unconstrained JSON: a single-span verdict carrying an unexpected `span_audit` cannot be silently stripped and accepted through the wrong shape.
- Candidate IDs remain mutually exclusive because `candidateId` includes the original candidate index (`retain.ts:1831-1837`). Therefore two union branches cannot both validate the same verdict, even when their remaining fields are structurally identical.
- The existing post-parse count, unique-map-size, and expected-ID checks remain unchanged. Candidate-local audit schemas still enforce exact span count, local ID membership, uniqueness, nonempty bounded interpretations, and relationship labels. Strict complete-JSON parsing and batch-wide fail-closed behavior also remain unchanged.
- Batch construction still yields only one or two candidates, so indexing `verdictShapes[0]` and `[1]` is bounded by the existing nonempty verification loop rather than a new unchecked public input path.

## Transport-test assessment

The new matrix exercises both supported strict-schema envelopes through the actual `ModelClient` and `runRetain` paths:

- Chat Completions rejects the first llama-style `response_format.schema` request with the existing recognized compatibility error, then inspects the learned second `json_schema` rung used by extraction and verification.
- Responses inspects `text.format` directly.
- Both assert a root object, strict mode, all object properties required, `additionalProperties:false` recursively, and absence of `oneOf` anywhere.
- Singleton cases `[1]` and `[2]` assert a direct object and single-value candidate enum.
- Two-candidate cases `[1,1]`, `[1,2]`, and `[2,3]` assert two `anyOf` branches in candidate order, candidate-specific ID enums, and candidate-specific presence and exact lengths of `span_audit`.
- Negative cases reject audits swapped between different frame sizes, an audit added to a single-span branch, and a foreign candidate ID. Each malformed logical batch yields zero retained candidates and typed `retain_verification_failed` degradation.
- `logicalCalls === 2` verifies one extraction plus one semantic verification. Endpoint-call counts separately account for the single mechanical Chat Completions schema-dialect demotion, so the test does not disguise a semantic retry.

I independently ran the new transport test together with the existing frame-audit and retain-language suites: 197 tests passed across 3 files.

## Residual limits

The local transport test validates exact serialization, compatibility-rung wiring, and runtime enforcement; its stub does not compile the schema with the configured provider. The planned post-freeze protocol controls using the compiled builder schema and constant invented JSON echoes are the appropriate check for that remaining integration boundary. They should remain transport controls rather than semantic grading or write tests.

The current fix deliberately changes no retention meaning, prompt threshold, repair policy, batch size, or retry policy. Fresh model evaluation remains necessary for source-span interpretation quality and availability after transport succeeds.
