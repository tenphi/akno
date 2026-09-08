# V26 validation plan

V25's exposed-source diagnostic identified a correctly rejected extraction: a statement about what a narrow exclusion does not establish became a claim that the whole contract was silent. V26 adds a shared generation/verification rule preserving the subject and scope of negative epistemic statements. This changes first-pass generation guidance; it does not repair semantic rejection, which remains final for that operation.

Before the full trial, repeat the exposed sanding-exclusion diagnostic once on the changed runtime and preserve its report and independent judgment. The previous failed diagnostic remains in `results/v25`. No unchanged-runtime semantic rejection is retried until acceptance.

The previously approved, unexecuted v16 corpus remains unchanged: fingerprint `95905fa8b8fb21d2ab5ed48d3261a850fbbad79369bd4c43e155bf3674fd7165`. It contains ten exposed writable development sources, ten fresh writable held-out sources and one read-only case per split. All 22 inputs were independently approved before execution. Each case has eight English/Russian query/answer and explicit/inferred-view combinations and two repetitions.

Runtime remains GPT-5.6 Luna, with independent GPT-5.6 Sol source/output review and separate Sol code review. The unchanged gate requires at least 90% independently useful answers in every split/run, at least 80% useful retention/retrieval, zero accepted language/qualification/source-entailment/promotion/source-byte errors and at most 5% case availability failures. Preserve all failures and judgments. The separate built-package probe follows rebuild and service restart.
