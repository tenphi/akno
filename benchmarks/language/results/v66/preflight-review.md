# V66 frozen preflight and protocol-control audit

## Disposition

Clean for the declared purpose. The receipts bind the deployed and tested artifact to commit `13a7569f54634627c0eae91eb8f55d159c064176`, which equals the current frozen `HEAD`. They establish build/deploy provenance, local and CI check completion, schema transport, strict local parsing, and exact constant-JSON echo behavior. They do **not** establish semantic model competence, answer usefulness, or corpus-gate success.

I did not inspect or grade either active probe trace and made no provider call or file/runtime change other than this review note.

## Frozen provenance and checks

`tmp/v66-postdeploy-check.json` records the same runtime commit at its root and in each protocol receipt. The readiness builder itself asserts that exact commit, a clean worktree at receipt creation, successful CI and Documentation runs for that SHA, the 2,859-test/144-file suite markers, and build/restart/socket evidence before writing the aggregate receipt. The reported CI run `34351741028` and Documentation run `34351740963` are both recorded as successful.

The compiled-control groups consistently state zero additional model passes, unchanged source bytes where applicable, and mandatory semantic/selection checks. These are deterministic compiled-path controls. Their labels correctly avoid claiming that live models will apply the contracts reliably.

## Answer generation and verifier protocol controls

The rendering script captures the exact compiled generation and verifier Zod schemas from the real `ModelClient.chat` call boundary. Its local server first exercises copy/translation and negative language, semantic, selection, forged-copy, empty, truncated, and trailing-JSON paths against an invented isolated store. The live protocol section then makes one direct constant-JSON echo call for each captured schema.

The generation echo is schema-valid and byte-structurally exact after JSON parsing. The verifier echo deliberately exercises all three new alignment shapes in one record:

- `actor`: `not_selected` with null source and answer anchors;
- `object_and_mechanism`: `preserved` with both anchors;
- `qualification`: `omitted` with a source anchor and null answer anchor.

The verifier payload also sets `qualification_scope_preserved=false` with a matching qualification mismatch, so it is a valid negative semantic-shaped response. The control only checks transport/schema/exact echo; it neither converts that negative into acceptance nor runs it as a corpus semantic decision. `tmp/v66-protocol-controls.json` reports both logical calls completed, `ok`, schema-valid, and exact at the declared 2,400-token answer ceiling.

The separate translation-only receipt captures one generation call with `rendering_mode: translate`, reports it completed/schema-valid/exact, and carries the same runtime commit and 2,400-token ceiling. It provides transport evidence for that strict branch, not translation-quality evidence.

## Retention verifier protocol control

The prepared retention control uses `runRetain` with an invented local extraction stub solely to capture the exact compiled verifier schema and payload for a two-candidate batch: one candidate has a single frame and the other has two frames plus mandatory `span_audit`. The stub deliberately returns `bad_response` after capture, so it performs no semantic-provider call during schema construction and writes no memory.

The script then sends one constant expected verdict envelope through the configured `ModelClient` with the captured schema and captured `maxTokens` value (`3744`). The stored endpoint schema is a strict root object whose candidate variants use `anyOf`, singleton candidate-ID enums, required properties, and `additionalProperties: false`; the multi-frame branch requires both frame audits. The response completed and parsed against that exact schema. The readiness builder separately checks parsed response equality against the sent constant JSON.

The retention receipt's purpose explicitly says it is protocol-only, makes no semantic usefulness claim, and performs no memory write. Although its standalone JSON has no top-level `modelCompetenceClaimed` field, the aggregate readiness receipt records `modelCompetenceClaimed: false`; the purpose and script behavior are unambiguous.

## Calls, retries, and schema boundaries

The controls add no semantic pass or semantic retry to production. Each live protocol branch invokes `ModelClient.chat` once with an invented constant answer and the already captured production schema. The scripts contain overwrite guards and persist a `started` state before each provider control, preventing a failed started receipt from being silently replaced. They do not relax local `safeParse`, strict JSON, mandatory semantic booleans, alignment relations, excerpt selection, or retention frame accounting.

Configured provider transport behavior remains owned by `ModelClient`; these receipts do not prove the absence of an internal HTTP retry because they do not record attempt count. That limitation is distinct from the reviewed application contract: there is no second semantic decision, fallback verdict, or resubmission of a rejected candidate/block.

## Declared probe start receipt

`tmp/v66-probes-started.json` binds both starts to the same frozen commit, the V66 plan, Luna runtime model, Sol review model, one run, and the isolated 2,400-token answer ceiling. Its counts agree with the plan:

- selected: eight named V21 development cases × eight coordinates = 64 observations;
- built: four named V20 development cases × eight coordinates = 32 observations;
- total declared observations: 96.

It explicitly records `freshHeldOutExecuted: false` and `replacementRerunsAllowed: false`. The selected case list excludes the development question/rejected cases as declared; the built list supplies report/question/rejected/alternatives as declared. This receipt proves the intended invocation metadata, not completion or result quality. Completion, source-only grading, and any decision to expose V21 held-out remain separate evidence.

## Finite evidentiary limits

- Constant echoes show that the provider accepts and returns the schemas; they do not show that it can generate correct semantic audits unaided.
- Compiled stubs show deterministic gates and call counts for invented inputs; they do not predict live corpus behavior.
- Successful preflight does not authorize a replacement run or bypass the plan's stop conditions.
- No fresh V21 held-out evidence appears in the reviewed receipts. A full run still requires the declared diagnostic decision and must retain the frozen runtime, models, budgets, and gates.
