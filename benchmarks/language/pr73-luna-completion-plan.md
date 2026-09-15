# PR 73 completion on the economical runtime

The owner has selected Luna as Akno's runtime target and approved closing issues #61/#62 as bounded
implementations after a complete frozen evaluation, with residual failures carried into #66. This is a
scope decision, not permission to report an unmet quality gate as passed or a claim that all possible
improvements on Luna have been exhausted.

## Frozen execution

- Corpus: V23, independently approved source/expectation fingerprint
  `fa6e306b8c2c0d4b001c19af8c00011710964d429e09938f5f367b06105be663`.
- Both development and held-out splits, two repetitions each: 44 case-runs, 352 answer coordinates.
  Four read-only case-runs account for 32 expected abstentions; writable useful-answer coverage has 320
  coordinates. Every coordinate is retained, including failures.
- Retention and answers: `gpt-5.6-luna`, Responses, low reasoning, 2,400 output tokens; timeouts 120 and
  60 seconds respectively; zero provider retries.
- Retrieval: populated `text-embedding-3-small` vectors at 1,536 dimensions; Luna LLM reranking with low
  reasoning, 1,600 output tokens, 30 seconds, top eight, 2,400 characters per item, irrelevant items excluded.
- English knowledge policy; English/Russian source queries and independently requested answer languages;
  inferred/explicit memory views. Expansion, graph expansion and model-generated index summaries/facts disabled.
- One process per split may run concurrently. Every case uses an isolated invented knowledge base. Runtime,
  script and corpus hashes are frozen before calls; no production edits or rebuilds occur during execution.
- Source review remains separate from runtime models, corpus authorship and implementation. The previously
  calibrated independent reviewer grades original sources and published outputs. Semantic grades do not
  receive runtime verifier decisions as authority. Actual context evidence and stored support bytes are audited.

## Triage and stopping rule

The original gate is still computed unchanged: 80% complete retention and useful retrieval, 90% useful
answers in each split/run, at most 5% availability failures, no accepted semantic/qualification/language/
promotion errors, and stable source bytes/replay. The report may fail it.

Inspect every failure for a concrete implementation defect. A reproducible defect in projection, routing,
evidence binding or validation merits a targeted repair and regression test. Permit one repair round in
this completion pass; preserve the original frozen results and label any post-repair measurement separately.
Do not introduce a new prompt, fallback model or audit pass without measured evidence that it helps. Invalid
or source-unfaithful model output despite correct inputs is recorded as a model/pipeline limitation; absence
of an identified code defect does not establish a model's absolute capability ceiling.

Close #61/#62 with a criterion-by-criterion account of implemented behavior and explicit remaining limits.
Carry all failed coordinates, false holds, missing coverage and availability outcomes into #66 as regression
inputs and a baseline for future economical-model comparisons. Do not claim this one-cycle language matrix
implements #66's longitudinal evaluation. PR #73 remains the implementation/evidence PR; closing the issues
does not merge or deploy it.
