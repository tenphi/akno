# V74 protocol failure and differential-diagnostic design review

## Observed evidence

I independently inspected the preserved declaration, `tmp/v74-protocol-results.json`, the exact endpoint schemas, and the frozen provider adapter. I did not call a provider, inspect credentials/KB/fresh held-out data, edit runtime, or start corpus probes.

The suite ran all ten declared logical controls once and is correctly preserved as failed:

- Seven controls passed exact schema-valid echo: rendering copy, two-record answer verification, structured answer-clock translation, and all four maximum-language Chat/Responses controls.
- `positive-retention-verifier`, `maximum-frame-negative-retention-verifier`, and `four-branch-retention-repair` each made one endpoint request and returned `request_failed`, with no output or usage.
- The final suite result is `passed:false`.

The receipt intentionally lacks the redacted provider error text. No conclusion about the provider's exact rejection message can be reconstructed from `request_failed`, endpoint count, or absent usage. This is request/schema compatibility evidence, not model behavior or output-budget evidence. No corpus probe may treat these three controls as passed.

## Static schema comparison

The strongest shared static discriminator is the JSON Schema `pattern` content:

- Every passing answer and language schema contains **no** `pattern` keyword.
- Both failing retention schemas contain ten occurrences of the exact pattern `[\\p{L}\\p{N}]` and no lookahead.
- The failing four-branch repair schema contains three existing report patterns `^[^\\r\\n\\u0000]*[.!]$` and seven new clock patterns `^(?=[\\s\\S]*[\\p{L}\\p{N}])[^\\r\\n\\u0000]*[.!]$`.

Therefore Unicode property escapes are the only pattern feature common to all three failed requests. Lookahead is a clock-only additional suspect and cannot explain the two retention failures. Schema size, `anyOf`, strict objects, nullable branches, numeric enums, long expected output, and Responses transport all occur in passing controls elsewhere, so none alone explains the common failure.

The `/u` JavaScript regex flag is not serialized into the endpoint schema. The wire carries only the pattern string. A differential should test the literal wire features (`\\p{...}` and `(?=...)`), not describe an invisible language flag as though the provider received it.

This comparison supports a hypothesis, not a causal finding. The endpoint may reject a pattern dialect, a combination of pattern and schema complexity, or another undisclosed request detail.

## Bounded differential protocol diagnostic

Declare a new, separately reviewed protocol-only diagnostic. Do not rerun or overwrite any of the three failed full fixtures. Use invented ASCII values, the same frozen SHA/model/Responses endpoint, a small fixed caller cap, exact expected bytes, one endpoint request per logical diagnostic, and a new receipt path with start-before-call persistence.

The smallest useful set is four independent calls:

1. **Simple-pattern baseline.** A strict one-field object with a bounded string and `pattern: "^[A-Za-z0-9 .!-]+$"`. This asks whether ordinary `pattern` metadata is accepted at all.
2. **Unicode-property differential.** The same strict object and expected ASCII value, changing only the pattern to `"[\\p{L}\\p{N}]"`. A baseline pass plus this request failure isolates the Unicode property escape in a minimal schema.
3. **ASCII-lookahead differential.** The same strict object/value with `"^(?=[\\s\\S]*[A-Za-z0-9])[^\\r\\n\\u0000]*[.!]$"`. This tests lookahead without Unicode properties.
4. **Production-shape sanitized retention control.** Clone the already-declared positive-retention schema and expected value, changing only every `[\\p{L}\\p{N}]` pattern to a simple ASCII alphanumeric pattern that its invented exact excerpts satisfy. This distinguishes “minimal pattern accepted” from “pattern rejected only in the production nested/union shape” without replaying the failed unchanged fixture.

If clock-specific compatibility remains unresolved after those four, declare a second amendment rather than anticipating every combination. Its one necessary call would clone the four-branch schema/expected response while replacing each new clock pattern with the already-existing no-lookahead complete-sentence pattern. Do not bundle this fifth call into the initial diagnostic unless the first four cannot distinguish the features: the Unicode-property differential and sanitized retention shape should first establish the common failure mechanism.

Each diagnostic result is meaningful independently:

| Baseline | Unicode | Lookahead | Sanitized production | Supported interpretation |
| --- | --- | --- | --- | --- |
| pass | fail | pass | pass | Unicode property escape incompatibility is strongly isolated. |
| pass | pass | fail | pass | Lookahead is independently unsupported; it still does not explain retention failures. Reinspect exact retention request differences. |
| pass | fail | fail | pass | Both advanced pattern forms are unsupported; common retention cause remains Unicode. |
| pass | pass | pass | fail | Nested production-shape interaction, not either minimal pattern feature alone. |
| fail | any | any | fail | `pattern` itself or another request-level constraint is incompatible; no finer feature claim is justified. |

Any request failure stays failed. Do not use a successful sanitized schema as a replacement pass for the original production schema, and do not start corpus probes on diagnostic evidence alone.

## Likely implementation boundary after diagnosis

If the Unicode/property or lookahead hypothesis is confirmed, the smallest safe runtime correction is to keep provider-visible schemas within the supported subset and retain the stronger checks locally after strict JSON parsing:

- For negative evidence excerpts, expose only the existing nonempty/max-80 string shape on the wire; continue checking exact candidate/source membership and the JS Unicode letter/number requirement in `consistent`.
- For clock repair sentences, expose nonempty/max-length strings on the wire; keep CR/LF/NUL, terminal punctuation, and letter/number validation in the local transaction parser before materialization.

Removing an unsupported wire regex must not remove its local invariant. The local validator must distinguish a schema-valid provider response that fails the stronger sentence/excerpt rule and classify it as an invalid response/repair, never a semantic negative or accepted candidate. Add deterministic controls for punctuation-only, whitespace-only, CR/LF/NUL, missing terminal mark, surrogate/non-Latin letters, and over-cap values.

This design avoids changing calls, caps, models, retry behavior, semantic gates, source authority, or public schemas. It also avoids guessing that ASCII-only wire patterns are semantically sufficient for multilingual content.

## Accounting and disposition

The original ten-control suite remains a seven-pass/three-fail result. The four proposed calls are a new differential diagnostic with their own declaration, hash, receipt and review; they are neither retries nor replacements. The runner should record the redacted typed reason, endpoint count and usage exactly as returned, without attempting to recover or publish missing provider detail.

**Disposition: hold corpus probes.** A bounded four-call differential declaration is justified. Review its exact schemas/expected bytes and once-only guards before provider execution, then decide whether a runtime schema-adapter correction and a new revision are required.
