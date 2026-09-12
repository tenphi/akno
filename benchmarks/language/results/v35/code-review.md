# V35 code review — round 1

Reviewer: GPT-5.6 Sol, separate read-only code reviewer. Scope: bounded reporting grammar, neutral hypothesis-generation guidance, unspecified-denial retention guidance, prompt versions, and focused regressions.

## Finding

### Medium — apostrophe-only possessives bypass the new attributed-report ownership exclusion

In `packages/core/src/ops/answer.ts`, the new attributed-report branch ends the source label with:

```ts
${source}(?![’']s\b)
```

This blocks `report attributed to Ada Marlow’s device`, but it does not block the common apostrophe-only possessive used for a name ending in `s`. With the repository's invented shared name, `The unverified report attributed to Bo Winters’ device ...` can satisfy `hasBoundReporter(..., "Bo Winters")`, even though Bo is the possessor of the device rather than the report's attributed speaker. A straight-apostrophe variant (`Bo Winters' device`) has the same problem.

The exclusion should reject an immediate possessive apostrophe after the source label, whether or not it is followed by `s`, or otherwise distinguish both possessive styles. Add paired curly/straight apostrophe-only regressions using `Bo Winters`; keep a positive `report attributed to Bo Winters concerns ...` case.

## Other reviewed changes

The relay additions are otherwise bounded to a named source plus a report/assertion noun, owned proper-name report/assertion, or finite `that` clause. They do not bypass the unchanged semantic verifier. Adding direct `asserted/asserts`, possessive `assertion`, and `report ... attributed to SOURCE` is consistent with the reporting-source contract.

Neutral record provenance for hypothesis content affects generation only and avoids inventing discussion/recording acts from question wording. The retention instruction preserves an authored unspecified-object denial and permits the denying speaker as its subject without coercing a neighboring product into the proposition. Neither change alters typed admission, semantic verdicts, calls, retries, or qualification rules. Prompt-version increments and the benchmark snapshot are consistent.

## Round 2 final disposition

The apostrophe-only ownership bypass is fixed. The attributed-report branch now rejects any immediate straight or curly apostrophe after the required source label, covering `Bo Winters’ device`, `Bo Winters' device`, and ordinary `Ada Marlow’s device` while continuing to accept `report attributed to Bo Winters concerns ...`. This suffix check does not alter the exact source name, require transliteration, or interfere with a nonpossessive named attribution followed by whitespace or punctuation.

The parameterized regression now uses the selected speaker consistently in typed metadata, readable evidence, question, and expected construction. Both apostrophe styles have negative coverage and the nonpossessive form has a paired positive.

The V35 validation plan accurately describes the grammar boundary, neutral hypothesis provenance, and unspecified-denial formulation as generation/admission guidance. It preserves full semantic verification, V34 language hints and text-last ordering, unchanged model calls/retries/dimensions/ceilings/models/gates, the frozen v18 fingerprint, and the fact that no fresh v18 held-out input has executed.

**Final result: clean; no actionable findings remain in the reviewed V35 boundary.**
