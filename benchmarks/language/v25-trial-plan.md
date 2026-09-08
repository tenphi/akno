# V25 validation plan

Runtime remains GPT-5.6 Luna. Independent source and output review uses GPT-5.6 Sol, with no corpus authorship or runtime tuning by the grader. The runtime receives several separate model code-review rounds before freezing.

The exposed v15 failures drive these changes: preserve process meaning during English normalization, require separate retained proposition/action/qualification verdicts, keep the structured outer recorder and inner reporters, and share source-clock qualification checks. Answer validation binds attribution to the required source and rejects unsupported claims about omissions from a complete original source. No semantic rejection is retried until acceptance.

Before executing any fresh held-out source, run a diagnostic on the exposed v15 nested report, exclusion and undated proposal. Preserve that diagnostic and independent judgments even if it fails. It is development evidence and cannot replace the full repeated trial.

The fresh v16 corpus fingerprint is `95905fa8b8fb21d2ab5ed48d3261a850fbbad79369bd4c43e155bf3674fd7165`. It contains ten exposed writable development sources from v15, ten fresh writable held-out sources, and one read-only case per split. All 22 inputs were independently approved before execution. Each case has eight English/Russian query/answer and explicit/inferred-view combinations, with two repetitions.

The unchanged gate requires at least 90% independently useful answers in every split/run, at least 80% useful retention and qualified retrieval, zero accepted language/qualification/source-entailment/promotion/source-byte errors, and no more than 5% case availability failures. Failed runs, probes and judgments remain visible. Any output-driven change requires a new runtime revision; fresh held-out outputs cannot be reused as unexposed evidence after tuning against them.
