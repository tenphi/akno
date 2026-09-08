# V51 bounded transport design review

## Disposition

The proposed fix is correct: keep the same candidate-specific literal object shapes, use the object directly for one candidate, and use `z.union` for two candidates so the array item's JSON Schema uses `anyOf`. Distinct literal `candidate_id` values keep the branches mutually exclusive, while runtime Zod parsing and the existing exact candidate/span accounting remain unchanged.

## Required construction

Build the verdict item schema as:

```ts
const itemSchema =
  verdictShapes.length === 1
    ? verdictShapes[0]!
    : z.union([verdictShapes[0]!, verdictShapes[1]!]);
const schema = z.object({ verdicts: z.array(itemSchema) });
```

This matches the actual two-candidate batch ceiling. Avoid casting an arbitrary array into `z.union`; explicitly index the one/two branches so a future batch-size change becomes a type/code review event rather than silently generating an unsupported larger union.

The direct one-candidate shape is important. Wrapping one branch in a union is unnecessary and risks another converter-specific combinator. For two candidates, `anyOf` is appropriate below the root: the endpoint root remains an object, and each object branch has a distinct required literal ID.

## Transport tests

The proposed matrix is the right minimum:

- one candidate, single-frame;
- one candidate, multi-frame;
- two candidates, both single-frame;
- two candidates, one single and one multi-frame;
- two candidates, both multi-frame.

For every case, inspect the schema after the actual `toEndpointSchema` path rather than the source Zod definition. Assert recursively:

- no `oneOf` key anywhere;
- root `type: object`, root `required: ['verdicts']`, and root `additionalProperties: false`;
- one-candidate array items are a direct object schema;
- two-candidate array items contain `anyOf` with exactly two branches;
- every object in every branch has `additionalProperties: false` and every property is required, using `strictModeViolations` as well as targeted assertions;
- each branch's `candidate_id` literal/const is the expected distinct ID;
- only multi-frame branches require `span_audit`, with their own exact `F1..Fn` enum and fixed length;
- the single-frame branch cannot accept an unexpected `span_audit` after local parsing;
- a verdict for candidate A cannot satisfy candidate B's branch, and swapping audit shapes across the two IDs fails local parsing.

### Additional transport hazard to cover

Test both compatibility dialects, especially the **second `json_schema` rung** that failed against the documented OpenAI contract. A ModelClient test that accepts only the initial llama.cpp-style `response_format.schema` request proves converter output but does not prove the OpenAI envelope actually sent after compatibility demotion.

At least one matrix case should:

1. reject the first `schema` rung with the existing recognizable `Unknown parameter: response_format.schema` response;
2. inspect the second request's `response_format.type === 'json_schema'` and nested `json_schema.strict === true`;
3. recursively reject `oneOf`, require the expected `anyOf`, root object, all-required objects, and `additionalProperties: false`;
4. return a valid constrained response and verify that no plain-JSON third request occurs.

The remaining matrix can exercise the initial schema dialect. This directly covers the provider contract at issue without changing compatibility behavior.

## Semantic and failure invariants

- Keep `JSON.parse` for the write-authorizing verdict. Missing delimiters and trailing content must remain malformed failures; do not reintroduce loose parsing as a transport workaround.
- Keep exact verdict count/IDs and exact span-audit set/uniqueness checks after parsing. `anyOf` constrains generation but does not replace caller validation.
- A semantic negative remains a candidate hold. Schema/transport/malformed output remains typed `retain_verification_failed` and accepts no candidate from that operation.
- Preserve the two-candidate first-pass batching, span-based token allowance, provider-role ceiling, and one call per batch. No failed candidate is resubmitted.
- The schema change is private transport plumbing. Public retention schemas, source authority, repair obligations, and model/gate settings remain unchanged.

## Trace diagnostics

Adding the typed failure/reason to ignored trace hooks is useful for distinguishing provider rejection, truncation, and local invalid response. Keep it content-free or already-redacted: do not copy raw provider bodies, generated verdict JSON, credentials, or source text into a new diagnostic field. The existing structured call observations should remain the accounting authority; trace detail must not become control flow.

## Minimum negative cases retained

The V50 malformed span-audit cases, semantic-negative behavior, strict terminal JSON cases, configured output-ceiling failure, repaired/admitted frame mapping, and 16+16 token-budget boundary must all continue to run against the new item-schema construction. The transport fix must change only endpoint representability, not acceptance semantics.

## Conclusion

Direct-one / `anyOf`-two is the smallest safe correction. The one additional requirement is an actual compatibility-demotion test that inspects the OpenAI `json_schema` rung, because inspecting only the initial llama.cpp schema envelope would not reproduce the contract that rejected V50.
