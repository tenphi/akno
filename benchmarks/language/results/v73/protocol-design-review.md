# V73 mixed-repair protocol failure: independent design review

## Disposition

The started control **failed its declared exact-echo assertion and must remain recorded as failed**. It is not evidence of a malformed wire schema, transport rejection, token exhaustion, or a demonstrated runtime implementation defect.

The result is best classified as a synthetic repetition-copy limitation in the configured generative model:

- The endpoint returned `ok: true`.
- The response parsed and satisfied the exact captured mixed strict schema (`schemaValid: true`).
- It preserved both disjoint indices and both the text-only and full-candidate branches.
- Usage was 277 output tokens, well below the effective 2,400-token ceiling.
- `reported_proposition` at its 200-unit maximum and `relay_attribution` at its 78-unit maximum were copied exactly.
- Only `personal_limits` changed, from the expected 120-unit repetitive filler to a shorter 87-unit value. One repeated `Invented protocol sentence only.` clause disappeared; the returned value still satisfied its 1–120 length and terminal-punctuation schema.

JSON Schema constrains shape, types, enum IDs, lengths, patterns, and required fields. It cannot require a generated string to equal an arbitrary string carried in the prompt. Therefore this is not evidence that the provider ignored `maxLength`, chose the wrong `anyOf` arm, truncated output, or mishandled the new schema. It demonstrates that a schema-valid model response is not a byte-copy guarantee, which the runtime already assumes: reconstructed prose is locally recleaned and independently checked against the complete original source.

## Validation-design confound

The fixture's `fill` function creates fields by repeating one identical sentence fragment and slicing at the requested boundary. In `personal_limits`, deleting one repetition leaves another schema-valid, superficially equivalent filler sequence. Repetition invites ordinary model deduplication and makes exactness depend on counting indistinguishable clauses rather than transporting the schema's hardest distinctions.

The evidence does **not** show that the 120-unit boundary caused the loss: the longer 200-unit field was exact, the response was not near the token cap, and no raw partial/truncation signal exists. It also does not prove that realistic distinct text will be copied exactly. The current control mixes two questions:

1. Can the provider accept and return the mixed strict schema?
2. Will the model reproduce deliberately redundant arbitrary bytes exactly?

The result answers the first positively and the second negatively for this one fixture.

## Recommended next step before probes

Do not rerun or replace this control. Preserve `tmp/v73-report-repair-protocol-control.json`, its assertion failure, script, exact messages, response, usage, and frozen SHA.

Declare a **new, separately named protocol-only control** before executing it. It may use the same frozen runtime and captured mixed schema, but each of the three text fields should contain distinct, invented, complete sentences with unique content and reach its declared maximum length exactly. Avoid repeated clauses, repeated padding tokens, ambiguous ellipsis, or a suffix that can be dropped without visibly changing which proposition is present. The full-candidate sibling should remain unchanged so the new result still exercises the mixed `anyOf` transaction.

The new control should require, in one attempt:

- endpoint success;
- strict schema validity;
- deep exact equality with the newly declared request;
- the exact 200/78/120 normalized UTF-16 lengths and terminal punctuation;
- both candidate indices and correct branch ownership;
- recorded caller, role, and effective caps plus usage;
- clean frozen V73 provenance and a no-existing-receipt guard.

Constructing the distinct strings should be deterministic and locally asserted before any provider call. A helper can concatenate unique invented clauses and a unique grammatical final clause sized to the remaining units; it should not generate by repeating and slicing the same sentence. Keep all content within the repository's invented vocabulary.

If this distinct maximum-length control passes, it resolves the **fixture confound** and supplies useful protocol evidence that the provider can carry the actual mixed schema and boundary-sized distinct fields. It does not convert the original failed receipt into a pass and does not prove universal copying or model semantic competence. The readiness record should list both outcomes and explain why the newly declared control supersedes only the validation design, not its history.

If the distinct control fails exactness, hold probe launch. A second failure on distinct content would be stronger evidence that exact echo is not a stable preflight property for this model/schema, requiring a revised control strategy or runtime design review rather than repeated attempts.

## Relationship to runtime safety and trial rules

No runtime change is justified from this receipt alone. In production the repair model writes new source-based sentences; it is not asked to copy maximum-length filler. The server does not trust those strings: it normalizes and validates the strict transaction, clones nontext fields, recleans the full vector, checks language, protects admitted siblings, and requires full-source semantic verification. An omitted material personal limit should fail those existing checks.

The original V73 plan required the additional mixed repair echo to pass before probes. That condition is currently unmet. Because no corpus probe has started, the plan can be amended transparently to add the distinct maximum-length control and an adjudication rule, with the original failed control preserved. This is a new protocol validation for a corrected fixture, not a semantic retry or an unchanged-runtime corpus replacement. Models, gates, pass count, repair count, and acceptance thresholds remain unchanged.

The other four successful controls remain valid evidence for their own schemas. They do not cancel this failed mixed-repair exactness result, and this result does not invalidate their receipts.

## Recommendation

Hold V73 corpus probes until the distinct maximum-length fixture is declared, reviewed, executed once, and reflected alongside the failed repetitive fixture in the final readiness receipt. If it passes, proceeding is defensible with an explicit limitation: strict transport is demonstrated, while exact generative copying and semantic competence remain fallible and are enforced by the unchanged downstream gates.

## Supplemental control-accounting correction

Independent inspection confirms that `tmp/v73-protocol-controls.json` was produced by mistakenly invoking `tmp/postdeploy-v73-alignment.mjs --live-protocol`. Its two successful calls exercise a simpler one-frame free-text answer generation and verifier shape. The receipt lacks per-call usage/caller-cap fields, and its verifier is not the declared `captureTwoFrameSchema` case. These two results are valid preserved **extra, unplanned controls**, but they do not fulfill either member of the V73 plan's declared rendering pair.

The intended wrapper is `tmp/postdeploy-v73-rendering.mjs --live-protocol`. Its live section captures:

1. the copy-generation response with the production `additionalLanguageProse` behavior; and
2. the actual two-frame/two-record verifier schema from `captureTwoFrameSchema`, including the declared larger alignment shape.

That live section has not run on V73. Its original destination is also `tmp/v73-protocol-controls.json`, which is now occupied by the mistaken alignment receipt and correctly protected by a no-overwrite assertion. Changing only the intended rendering wrapper's destination to a new explicit file such as `tmp/v73-declared-protocol-controls.json` is the right preservation step. Do not delete, rename, edit, or reinterpret the existing alignment receipt.

The corrected accounting before any corpus probe is therefore:

- declared translation echo: completed/passed once;
- declared retention echo: completed/passed once;
- declared rendering generation echo: **not run**;
- declared two-record verifier echo: **not run**;
- additional mixed repair echo with repetitive filler: completed, schema-valid, exactness **failed**;
- mistaken alignment generation/verifier echoes: completed/passed, extra and unplanned;
- proposed distinct maximum-length mixed repair echo: declared but not yet run.

Running the intended rendering pair once under the new destination is not a retry: those schemas/messages have not been sent in V73. Running the separately declared distinct repair fixture once is also not a retry of the failed input; it is the reviewed correction for the repetition confound. Both must retain frozen-SHA, no-existing-receipt, exact schema/value, cap, usage, and one-attempt evidence. The readiness writer should enumerate provider calls and receipt paths individually rather than summarize “four controls passed,” because V73 will contain extra calls and one preserved failure.

Probe launch remains on hold until (a) the intended rendering pair passes once, (b) the distinct repair fixture passes once, and (c) the final readiness receipt lists the original failure and accidental extras without counting either as declared fulfillment. No model, cap, semantic gate, retry policy, or runtime behavior changes are warranted by this instrumentation correction.
