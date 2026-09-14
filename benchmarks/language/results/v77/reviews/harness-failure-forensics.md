# V77 exposed-diagnostic harness failure forensics

Independent Sol infrastructure review on frozen runtime `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8`. I inspected both completed reports and traces, the V77 capture hooks, benchmark query path and frozen model configuration. I made no provider call, runtime edit, benchmark rerun, or semantic judgment of absent answer cells.

## Outcome

Both once-only exposed diagnostics are terminal infrastructure failures and must remain preserved:

- built: 4/4 cases have `error:evaluation_operation_failed`, `queries:[]`, `retention:null`, `bytesStable:null`;
- selected: 8/8 cases have the same shape;
- both reports therefore show 100% case availability failure with zero answer denominators. Their zero counts for source errors, language errors, promotion and byte changes are **not passing observations**.

The built trace has 112 rows and the selected trace 211 rows. They contain successful retention, retention-verifier and ownership operations, including transport/language-check calls. They contain no answer or answer-verifier operation and no query-expansion lifecycle row.

## Exact cause

Both capture hooks replace `ModelClient.prototype.chat` and execute this assertion as their first statement:

```js
assert.equal(this.modelId, 'gpt-5.6-luna',
  'Frozen diagnostic model policy changed before provider call');
```

The benchmark intentionally configures different roles:

- retention and answer: `gpt-5.6-luna`;
- query expansion: `llama-3.2-3b-instruct`;
- embedding: `text-embedding-qwen3-embedding-0.6b`.

After retention/rebuild/ownership, each case's first query calls `memory.recall({ expand:true })`. Recall invokes the configured expansion `ModelClient.chat`. The unconditional capture assertion sees `llama-3.2-3b-instruct` and throws before assigning a call ID or appending `model-call-start`. The benchmark-wide case `catch` then replaces all already-computed partial state with its generic `evaluation_operation_failed` object. This explains all observed facts:

1. successful retention/ownership trace rows exist;
2. no expansion or answer trace row follows;
3. every report case loses retention, bytes and query results despite earlier successful calls;
4. the failure repeats identically across both source and built imports of the hook.

## Zero-egress reproduction

`tmp/v77-harness-assertion-reproduction.log` calls the patched `chat` with an invented fake client whose model ID is `llama-3.2-3b-instruct`. It returns:

- `AssertionError`;
- the exact `Frozen diagnostic model policy changed before provider call` message;
- `traceExists:false`.

The assertion runs before the original client or transport, so this reproduction makes zero provider requests. The absent trace file independently confirms the throw precedes capture lifecycle instrumentation.

## Evidence limits

The raw retention/verifier/ownership calls are useful debugging evidence, but the reports deliberately discarded their case-level outputs. They cannot establish complete retained sets, durable write success, replay success, retrieval, answers, source-byte stability, or semantic availability. No missing answer cell may be graded as a justified abstention or semantic failure. Neither failed probe may be rerun or replaced under the same V77 diagnostic identity.

This is not a runtime semantic defect. The frozen runtime reached the configured expansion call; the external capture harness rejected the correct non-Luna role before transport.

## Safe next path

Do not edit or rerun V77 selected/built diagnostics. Preserve their reports, traces, start/launch receipts, this reproduction and the failed full-gate disposition.

A new **full-only** capture may fix instrumentation without changing runtime behavior:

1. Determine the operation kind before enforcing model policy.
2. Require `gpt-5.6-luna` only for the semantic operations the capture identifies as retention, retain verifier, ownership, answer and answer verifier.
3. Admit and trace the separately configured expansion role as `operation:null` (or a new explicitly validated expansion kind if the trace schema is revised coherently). Bind its exact expected model ID in the new full manifest/config receipt rather than treating Luna as universal.
4. Keep transport lifecycle capture for expansion so every call has balanced start/terminal evidence.
5. Reject an unexpected model on a recognized semantic operation before transport.

Before any provider run, deterministic zero-egress controls must prove:

- Luna recognized operations pass into a stubbed original call and are traced;
- the configured llama expansion passes into a stubbed original call and is traced with a balanced lifecycle;
- a wrong model for a recognized semantic operation throws before the stub transport;
- an expansion failure is recorded rather than disappearing before `model-call-start`;
- report/case validation treats a thrown operation as a failure and never as an empty semantic result;
- the new capture is hash-bound to frozen source/dist, model policy, input fingerprints and run manifest.

## Conditional terminal V22 measurement

A single newly declared full V22 measurement is a defensible next action only as a **new terminal measurement**, not a replacement or continuation of the failed V77 diagnostics. Conditions:

- retain frozen V77 runtime code and unchanged thresholds/models/caps/passes/retries;
- use the independently authored/reviewed V22 corpus, with the quarantined V21 held-out split excluded;
- run the full 11-case development and 11-case held-out matrices at the already declared run count, grading every split/run independently;
- preserve every started cell and forbid replacement runs;
- complete two independent reviews of the corrected capture, full harness, manifest and zero-egress controls before launch;
- state explicitly that V77 diagnostic semantics were never measured and therefore supplied no positive launch evidence;
- require the ordinary full acceptance criteria without pooling or relaxing a failed split/run.

If those conditions are not met, hold rather than infer a semantic result from the partial traces. The user's iteration limit changes scheduling, not evidence standards.

## Disposition

The failure cause is confirmed as the unconditional model-ID assertion in both V77 capture hooks. Preserve both probes as failed infrastructure evidence. A separately named, independently reviewed full-only V22 run with role-scoped instrumentation is the smallest safe path that obtains a terminal measurement without replacing the failed diagnostics.
