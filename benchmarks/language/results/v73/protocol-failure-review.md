# V73 mixed-repair protocol failure review

## Finding

The fifth protocol control failed its declared exact-copy criterion. It must remain recorded as failed and cannot be counted among the passing actual-provider controls.

The receipt does not show schema transport failure, truncation, or corruption of the mixed union:

- the provider call completed with `ok: true`;
- the returned object passes the exact captured Zod schema;
- the report-text branch retains the correct index and all three required fields;
- the full-candidate branch is deep-equal to its expected object (JSON member order differs but object equality does not);
- `reported_proposition` and `relay_attribution` are copied exactly at 200 and 78 UTF-16 units;
- only `personal_limits` differs, returning 87 rather than 120 units after removing one occurrence of an identical 33-unit sentence;
- usage is 277 output tokens under an effective 2,400-token ceiling, so the omission is not consistent with output truncation.

The call therefore establishes that the mixed schema is accepted and can return both strict branches, but it does not establish exact maximum-bound echo for the chosen payload.

## Fixture versus runtime interpretation

The failure is best classified as a **control-fixture confound exposing an exact-copy competence failure**, rather than evidence of a runtime repair implementation defect or a transport/schema defect. The fixture's `fill` helper creates each maximum string by repeating the identical sentence and slicing it. In `personal_limits`, the expected value contains three indistinguishable complete copies followed by the same partial prefix. Dropping one copy preserves grammaticality, schema validity, apparent protocol meaning, and the remaining repetitive pattern. A language model can compress that redundancy despite the exact-copy instruction.

That does not make the original result a pass: exact equality was the declared observable, and the model failed it. It does mean the fixture is poorly identified for the intended question. The V73 runtime branch will ask for three independently meaningful, nonrepetitive sentences, not repeated filler. This control mixes two questions: whether the strict mixed schema transports maximum-size distinct fields, and whether the model duplicates semantically redundant prose exactly. The second is not the claimed repair transport property.

The schema itself did not cause a lossy transform. The accepted 200- and 78-unit strings and the schema-valid 87-unit field show that the omission happened in model output before local parsing. Nothing in the receipt supports blaming the 400-unit reconstruction limit, the text-only clone, the cleaner, or the semantic verifier; none of those runtime stages are exercised by this protocol echo.

## Sound next action

A separately declared and independently reviewed **corrected validation control** is justified before any semantic probe starts. It is a fixture correction, not an unchanged semantic rerun, provided it keeps all material conditions fixed:

1. Preserve the failed receipt and script unchanged under their current names.
2. Add a new control filename and an amendment that states the initial repeated-filler confound before execution.
3. Use the same frozen runtime, model, mixed schema, two indices/branches, exact 200/78/120 post-normalization maxima, 2,400-token role ceiling, one call, strict-schema check, and deep exact-equality requirement.
4. Replace only the three repeated filler values with three distinct, internally nonrepetitive invented sentences. Each should carry unique beginning, middle, and final markers so omission, substitution, cross-field copying, or suffix loss is observable. Keep terminal punctuation and exact maximum lengths without padding by duplicate clauses.
5. Do not accept semantic equivalence, shorter schema-valid text, a relaxed length, or a second attempt at either the original or corrected input. The corrected control passes only on one exact response.
6. Independently inspect and preserve its receipt before deciding whether to start exposed probes.

The nonrepetitive payload should resemble the actual transport burden without becoming a semantic-quality test. It can use invented protocol prose and distinct neutral markers; it should not contain real data or rely on a model to infer content. Deterministic construction should assert each field's normalized UTF-16 length and pairwise distinctness before the call.

## Revision decision

V73 need not be abandoned solely because this pre-probe fixture was confounded. No semantic output has been generated, the runtime remains frozen, and a predeclared corrected transport control can answer the intended question without consuming benchmark inputs or changing runtime behavior. The initial failure must remain part of the evidence and the published account must say that the original repeated-filler exact echo failed.

Do not start V73 probes unless the one-shot corrected nonrepetitive maximum-bound control passes exact equality and the existing four controls remain preserved. If the corrected control also returns a schema-valid but nonexact object, defer the revision: that would show the current model/control arrangement cannot establish reliable exact transport for the new private response shape under the declared ceiling. The response should not then be rescued by retries, ad hoc shortening, looser equality, or semantic probe outcomes.
