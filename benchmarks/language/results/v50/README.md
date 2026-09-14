# V50 completed exposed evaluation

Frozen runtime **`9bc0bcb`** follows the [validation plan](../../v50-trial-plan.md). Both declared probes finished and were independently graded by Sol. **No full V50 repeated trial was started.** Fresh V20 held-out remains unexecuted and independently approved.

| Probe | Complete useful retention | Useful retrieval rows | Useful answers |
| --- | --- | --- | --- |
| Selected six cases | 0/6 | 0/48 | 0/48 |
| Built-package four cases | 0/4 | 0/32 | 0/32 |

All ten cases failed retention verification with typed degradation, zero retained records and **80 writable null answers**. Case availability fails 10/10. Empty outputs have no accepted semantic/promotion/language errors; that vacuous safety is not useful memory. Original source bytes remained unchanged. No unchanged-runtime semantic retry was made.

Verifier calls failed rapidly without token telemetry. The saved trace instrumentation records unsuccessful calls but omits provider error text, so the exact original rejection message is unavailable. Offline reproduction through the actual serializer shows the new candidate discriminated union emits nested `oneOf`, including single-candidate batches. The [official Structured Outputs subset](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas) supports nested `anyOf`; unsupported schema features yield request errors. This schema incompatibility is the leading failure explanation, to be checked with explicit protocol controls in the next revision. It does not establish anything about the model's semantic interpretation of the new span audit.

Local validation passed **2,284 tests across 135 files**, build/typecheck, lint, knip, formatting, documentation doctor/build, smoke, installed-package smoke and repository safety. Both independent code review/fix rounds passed after correcting a terminal-truncation parser defect found in round 2. Initial/final reviews are preserved. Build/restart/socket deployment and the compiled offline schema/strict-parser/role controls passed. MacOS, Linux and documentation CI passed. The offline provider stubs failed to model unsupported schema composition; green tests did not demonstrate real endpoint acceptance.

V51 will keep distinct single-value candidate ID enums and exact source-span audits but use a direct one-candidate shape or a nested ordinary union (`anyOf`) for two candidates. It will add transport-contract checks and preserve actual error/reason diagnostics. No model, semantic prompt, pass count, retry policy, source authority or acceptance threshold change is warranted from these results. PR #70 stays open and unmerged.
