# PR 73 acceptance work for issues 61 and 62

The owner-approved [Luna completion plan](pr73-luna-completion-plan.md) now governs issue closure. It retains
the original gate as a reported measurement while allowing bounded implementation closure with documented
limits and follow-up in #66. The original acceptance work plan below records the stricter earlier scope.

Continue the existing PR through the remaining language/discourse acceptance work. Preserve the completed
`pr73-live` focused run unchanged; its 82/84 result is not the broader gate.

## Remaining evidence and implementation work

| Requirement                                                               | Existing evidence                                                           | Remaining work                                                                                                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Owner-controlled English knowledge policy and independent answer language | Configuration, model-client, retention and production integration tests     | Include policy discovery and unset/upgrade behavior in final acceptance mapping                                                           |
| Exact original source quotations and source identity                      | Deterministic retention tests; focused run lacked stored spans              | Inspect persisted support evidence, hashes and source matches before/after rebuild/replay                                                 |
| Complete qualified retained meaning across English/Russian/mixed input    | Historical fixed comparison has omissions and accepted semantic errors      | Diagnose exposed cases, then run the complete matrix twice with source-based independent grading                                          |
| Correct inferred and explicit views                                       | Focused run passed; existing 44-query corpus had eight inference mismatches | General bounded cue corrections plus positive/negative regressions; repeat complete query matrix                                          |
| Useful auto-recall with preserved scope                                   | Focused structural-index run activated 0/42 times                           | Use a populated vector index and the explicitly configured reranker; capture actual context evidence                                      |
| Ordinary prose scope, stale projections, graph and maintenance exclusions | Production scanner, index and maintenance tests; focused live examples      | Map every issue-62 criterion to tested behavior and add any missing live controls                                                         |
| Source stability, exact-candidate behavior, replay and typed failures     | Existing deterministic production tests and focused file snapshots          | Repeat against the final built revision and preserve failure controls separately                                                          |
| Generalization beyond exposed diagnostics                                 | Existing held-out corpora are now exposed                                   | Freeze new held-out sources and expectations before final execution; do not tune against their outputs and continue calling them held-out |

## Measurement rules

Use the user-authorized OpenAI provider. Generation remains `gpt-5.6-luna`. Record the complete resolved
model profile, prompt/projection versions, corpus and built-package hashes before every live run. Diagnostic
changes to configuration must be explicit, and scores from different profiles are not a causal comparison.
Never change a frozen run, selectively retry its failed coordinates, or treat transport success as useful output.

The configured full-retrieval benchmark enables the provided reranker rather than overriding it to disabled.
Its reports carry that profile in the review fingerprint. Index summaries/facts stay disabled in the language
matrix; separate ordinary-prose controls exercise fact, graph and maintenance eligibility. Provider receipts and
completed case artifacts are saved incrementally. Capture published evidence and original persisted support
quotes; no credential, endpoint or real knowledge-base content belongs in the artifacts.

The existing broad gate remains authoritative: at least two complete repetitions; at least 80% complete
retention and useful qualified retrieval, and 90% useful qualified answers in each split/repetition; at most
5% availability failures; zero accepted source, qualification, language or factual-promotion errors; unchanged
source bytes and correct replay. Pooled scores cannot rescue a failing split/repetition. Ordinary factual and
qualified-inspection controls must both remain useful. The auto-recall supplement requires at least 80%
activation on declared answerable positive controls and zero unsafe injection on negative controls.

Independent review must be genuinely separate from runtime generation/verification, corpus authorship and
runtime tuning. Model access currently exposes Luna and `gpt-5.4-nano`; the earlier Sol reviewer is unavailable.
Before using Nano as a reviewer, test a frozen set of positive and deliberately wrong source interpretations.
Publish its initial grades and calibration failures. A failed calibration cannot establish the full gate.
The implementing assistant additionally inspects every published answer; that inspection is labeled separately.
A fresh held-out evaluation starts only after exposed-case fixes and the evaluator profile have been frozen.

Neither issue is complete while a required criterion or gate remains unmet. Update the PR's acceptance mapping
and closing references only when the final evidence supports completion.
