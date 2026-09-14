# V77 conditional full-trial harness review, corrected round

Status: **HOLD — the original harness findings are resolved, but the corrected capture still admits an unclassified Luna call and the trace validator treats it as valid.** This is not launch approval.

Scope: static re-review of the corrected full-only capture and mocked controls, launch integrity, start/split runners, trace validation, postrun validation, terminal-measurement decision, failed-diagnostic provenance and amended full plan. I did not call a provider or benchmark, change runtime or harness files, grade V77 outputs, or read/display V22 held-out prose. I inspected V22 only through its fingerprint, IDs, split/admission/query shape and reviewer attestations.

The original review is preserved in `tmp/language-v77-full-harness-review-initial.md`. Its findings and their current dispositions are recorded below.

## Remaining finding

### P1 — an unknown Luna operation is sent to transport and accepted as a valid null-operation lifecycle

`tmp/capture-language-full-v77.mjs:10` maps five semantic system prompts to operation names and maps everything else to `null`. Lines 17–18 recognize the three expansion prompts for model selection, but they do not require either a recognized semantic operation or a recognized expansion prompt. Consequently this call is admitted to the wrapped transport:

```js
await luna.chat([
  { role: 'system', content: 'Invented unclassified operation' },
  { role: 'user', content: 'Invented control' },
]);
```

It has `kind === null`, `expansion === false`, and the model assertion succeeds because the receiver is Luna. No semantic decision row is recorded. `tmp/v77-full-trace-integrity.mjs:32-34,43` permits `operation:null` with either declared model and explicitly does not require a result record for a null operation, so the balanced start/finish lifecycle passes validation.

The mocked test does not cover this path. `tmp/test-v77-full-capture.mjs:24` combines an unknown operation with an unknown model, so the model assertion rejects it. The receipt's “unknown model rejected” claim is correct, but it does not establish that an unknown operation on Luna is rejected. The prior exposed V75/V76 traces show that null operations correspond to expansion in the known benchmark call graph, but that observation does not make an unclassified Luna call visible or fail closed in this new terminal harness.

The smallest correction is:

- before transport, require `expansion || kind !== null`;
- in trace validation, require `operation === null` to have the frozen expansion model and every non-null operation to have Luna;
- add a zero-egress control proving an unknown system prompt on Luna throws after `model-call-start`, before the stub transport, and invalidates the complete trace until the policy-failure rows are excluded; and
- retain the existing three actual `expandQuery` controls, five semantic controls and wrong-role model controls.

This does not require recognizing more prompts or changing runtime. It makes the declared finite call graph enforceable and prevents a future or overlooked chat path from consuming provider work without an operation-specific trace record. Regenerate the capture-control receipt and launch manifest after the correction, then obtain the separate hash-bound preflight review required by the decision.

## Resolved original findings

### Global Luna assertion: resolved

The new `tmp/capture-language-full-v77.mjs` writes `model-call-start` before enforcing model policy, recognizes the exact lookup/question/explore prompts used by `expandQuery`, requires `llama-3.2-3b-instruct` for those calls and Luna for the recognized semantic calls, and records a balanced throw lifecycle when policy or transport fails. `tmp/test-v77-full-capture.mjs` exercises the real `expandQuery` entry for all three modes and the five semantic operation prefixes with a stubbed transport and zero network egress. A thrown expansion preserves exception identity and produces start/transport-start/transport-throw/model-call-throw in order.

The failed exposed diagnostics remain accurately classified as infrastructure failures: `tmp/v77-completed-probe-provenance.json` records 96 planned observations, zero observed query coordinates, twelve case failures, unknown retention/source-byte outcomes and no positive semantic-readiness evidence. `tmp/v77-full-trial-decision.json` forbids replacement diagnostic runs.

### Model-role binding: resolved

`tmp/v77-full-launch-integrity.mjs` compares live derive, answer, embedding and expansion IDs with the hash-bound completed selected report, requires derive and answer to be enabled Luna roles at 2,400 tokens, and separately fixes expansion to Llama and embedding to Qwen. The report's answer/retention ceilings are exactly `{answer:2400, retention:2400}`. Source and dist digests, frozen revision, clean tracked state, readiness and protocol receipts are checked before marker creation and before each split.

### Language ceiling: resolved

`tmp/v77-full-trace-integrity.mjs:32` requires every language transport start to carry `callerMaxTokens === 1024`. The mocked control proves 1,024 is accepted and 1,023 is rejected. This is correctly limited to language transports; derive/answer role ceilings remain configuration/report invariants.

### Complete input-review metadata: resolved

Launch integrity verifies `schemaVersion: language-input-review-v1`, reviewer kind and ID, and all four independence/authoring/tuning/output attestations, as well as the exact 22 IDs, all approvals and corpus fingerprint. Source and dist exports reproduce the fingerprint. No held-out prose needs to be displayed for these checks.

### Postrun provenance: resolved

`tmp/validate-v77-full.mjs` rehashes every `manifest.files` entry and the separately bound input-review file. It verifies the global marker's manifest/approval hashes, deep equality of each split receipt with the launch manifest, parseable timestamps ordered at or after the global start, exact split/run/case/coordinate matrices and complete balanced trace lifecycles. Development and held-out remain separate isolated two-run measurements.

## Other verified properties and limits

- `tmp/start-v77-full.mjs` calls the no-write integrity check before creating the one global marker and refuses any existing marker, split receipt, report or trace. Each split runner repeats integrity before writing its receipt and before invoking the benchmark.
- The runners select the complete V22 development and held-out splits, two runs each, with no case filter: 320 writable and 32 read-only coordinates. V21 held-out is not a selectable fallback in these scripts.
- The launch manifest binds the corrected capture, trace validator, launch/start/split/post validators, readiness, protocol, completion contract, decision evidence and no-egress controls. The current decision requires two independent harness reviews plus a later hash-bound preflight.
- The original benchmark report threshold remains 90% useful answers. The separate predeclared completion target is 80% per split/run. Both use the same future independently graded observations; retention and retrieval remain 80%, accepted source/qualification/language/promotion/source-byte errors remain zero, and availability remains at most 5%. With eleven cases per split/run, that availability condition permits no case failure.
- Runtime reports and private verifier booleans cannot establish usefulness. The postrun structural validator appropriately checks provenance and matrix completeness rather than attempting semantic grading. A later completion receipt must consume one independent source-only grade for both the original and completion comparisons, without pooling cells or treating writable nulls as useful.
- Protocol and mocked-capture controls establish transport/schema/harness compatibility only. They do not establish semantic readiness. The full result remains terminal for PR70 under the decision: publish it and leave the PR open/unmerged without issue edits, whether the completion gate passes or fails.

## Disposition

The corrected harness resolves the five findings in the initial review and accurately preserves the failed diagnostics. Matrix selection, frozen-runtime binding, input authority, role/cap checks, lifecycle accounting, postrun provenance and the terminal decision are otherwise coherent.

Do not approve or launch the terminal V22 measurement from this snapshot. Close the remaining null-operation gap, regenerate its zero-egress receipt and manifest, then perform the separately required final preflight. No runtime or corpus change is implicated.
