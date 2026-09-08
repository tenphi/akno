# V50 code review — round 1 final

## Delta reviewed

The initial review is preserved in `language-v50-code-review-1-initial.md`. This follow-up reviews only the retention-verifier parser change and its malformed-response regressions.

## Finding

No actionable finding.

`verifyCandidateBatch` now treats the verifier response as one atomic JSON document with `JSON.parse`, then applies the unchanged dynamic Zod schema and semantic-consistency checks. Missing root/container closers and trailing non-JSON content cannot be completed or ignored by `parseJsonLoose`. All failures enter the existing malformed-verifier path: `reportInvalidResponse`, no accepted candidates, typed `retain_verification_failed`, no repair and no second semantic call.

The extraction and bounded structural-repair parsers retain their existing loose parsing behavior; this delta is confined to the write-authorizing semantic verdict. That separation is correct: extraction content still undergoes cleaning and verification, while a verifier's incomplete decision cannot safely authorize storage.

The three new cases cover:

- a complete verdict missing only the root `}`;
- a complete verdict missing the array/root `]}` container closers;
- a complete JSON object followed by trailing garbage.

They complement the existing early truncation case and assert the same closed failure behavior. Valid complete JSON still proceeds through exact candidate/span accounting and all three semantic booleans.

## Disposition

The strict parser closes the fail-open condition without changing model calls, retry policy, semantic acceptance, repair behavior, or public schemas. The V50 implementation is clean on this reviewed boundary.
