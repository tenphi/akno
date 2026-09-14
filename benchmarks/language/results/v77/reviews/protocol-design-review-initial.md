# V77 protocol design review — initial

Independent Sol static review of `tmp/v77-protocol-suite.mjs`, its V77 capture modules, and the current runtime schema. I did not execute `--prepare` or `--live`, call a provider, write a declaration, or inspect held-out data.

## Findings

I found no protocol-schema or accounting defect in the proposed ten-control suite.

One readiness artifact is not yet available: `benchmarks/language/v77-trial-plan.md` does not exist in the current worktree. The protocol runner itself binds behavior through captured `dist` schemas and, at live time, the frozen SHA and clean tracked tree, but the requested model/cap/version and matrix declaration cannot yet be cross-checked against a trial plan. This is a pre-freeze documentation prerequisite, not a defect in the runner. Prepare and independently review the plan before treating this note as semantic-probe readiness.

## Schema and fixture assessment

- The maximum two-record answer fixture starts from the independently preserved V75 natural declaration. The runner changes exactly four value occurrences—actor and qualification details for two alignments—from 160 BMP units to complete 80-unit sentences.
- The recursive wire transformation is used only as an expected-schema oracle. Deep equality with `toEndpointSchema(twoRecordCapture.schema)` proves the actual current capture has the same narrowing and no other schema drift. The current local schema also parses the replacement value, preserving local 160-unit acceptance.
- Every actor and qualification relation branch shares the narrowed `detail` schema. Existing unit coverage checks all three strict branches; the protocol capture exercises selected actor/qualification shapes alongside preserved, omitted, `not_selected`, and `absent_from_both` neighboring states. Null and anchor dependencies remain strict.
- The maximum four-branch repair capture is deep-schema-equal to the preserved V76 natural repair declaration. Recursive value-shape/length comparison, local parsing and three 400-unit materialized outputs preserve its field counts, field sizes and cap stress. The 60-unit processing-clock exclusion remains present.
- The maximum negative retention control still covers two candidates × sixteen frame spans with three typed mismatches per candidate. Its repeated filler is synthetic and can expose echo-copy behavior, but it is unchanged from the previously exercised suite and is not used as semantic competence evidence.
- Four language controls cover Chat and Responses, compliant and coherent-negative outcomes, with 32 owned hints. The runner checks both strict parsing/exact echo and the expected parsed audit status.

## Caps and execution accounting

- Each fixture records caller, role and effective caps. The live pass condition compares declared values and every observed transport callback against `min(callerCap, 2400)`.
- Captures are local stubs and execute sequentially before declaration serialization. They cannot call a provider. Runtime live calls require explicit `--live`, an existing byte-identical declaration, an exact frozen SHA, a clean tracked tree, and an absent result receipt.
- The result receipt is created before the first call, each logical check is saved as started before invocation, and each internal transport is saved at start and completion/failure. Any interrupted or failed suite is therefore preserved and cannot be silently rerun at the same destination.
- The final gate requires ten logical controls, transport success, schema validity, exact output, expected language-audit status, cap equality, and successful completion of every endpoint request. Its purpose text correctly disclaims semantic grading and universal budget proof.
- Errors are bounded and redacted. Exact returned values are retained for these invented fixtures, which is necessary for the exact-copy evidence.

## Limits and prerequisites

This design tests endpoint schema acceptance and bounded exact echo. It does not establish semantic competence, corpus usefulness, or universal fit under the unchanged caps. Before execution, the final declaration still needs its normal independent hash/schema review after `--prepare`; freeze evidence must show the source and built `dist` correspond to the same commit, and the missing V77 trial plan must declare the intended versions, models, caps, controls and exposed matrix.

## Disposition

**Protocol design approved for local declaration preparation, conditional on adding and reviewing the V77 trial plan.** No provider execution or semantic-probe approval is granted by this note.
