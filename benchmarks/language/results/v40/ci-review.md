# V40 CI mixed-retrieval failure review

## Diagnosis

This is most likely a CI performance flake in the graph benchmark wrapper. The original report did not expose the nested mixed-retrieval metrics, so that run alone cannot prove which nested metric failed.

The failed GitHub run completed 2,079 of 2,080 tests successfully. In `packages/core/src/bench/graph.test.ts`, all 25 graph cases passed and every graph quality metric remained unchanged: expected outcomes, identity, abstention, provenance, path recall, false-positive rate, and maintenance recall were all at their exact targets. The only visible changed value was the aggregate `mixedRetrievalPassed:false`, which added only `mixed_retrieval_regression` to `blockers`. Because V40's original graph report carried only that aggregate, a hidden mixed-retrieval correctness or execution failure cannot be excluded from the old log.

`runGraphBench({iterations:3})` invokes `runMixedRetrievalBench({iterations:3})` with its production default 20 ms p50 latency budget. The dedicated `mixed-retrieval.test.ts` uses a 1000 ms budget while asserting all retrieval correctness metrics. The full CI run lasted about 150 seconds and executed many expensive suites concurrently, so a three-sample 20 ms p50 is sensitive to worker scheduling. The same graph wrapper passes locally. Those facts make latency the leading explanation, while the missing nested report prevents certainty for this run.

## Reviewed diagnostic correction

The uncommitted `graph.ts`/`graph.test.ts` correction is sound:

- `GraphBenchReport` now carries the complete `mixedRetrieval` report, making the exact failed metric visible in future CI and persisted artifacts.
- The test requires every nested non-millisecond metric to pass, including the count-unit execution-failure result. It therefore cannot silently classify a retrieval or exception failure as timing noise.
- It requires a millisecond metric to be present, binds the aggregate metric to the nested report, binds the production blocker to that result, rejects every unrelated graph blocker, and verifies aggregate `passed` consistency.
- The production benchmark still uses the unchanged 20 ms budget.

This is stronger than merely allowing any false nested verdict. The dedicated mixed-retrieval test continues to exercise correctness under a test-safe latency allowance, while graph artifacts retain the real 20 ms result, exact nested evidence, and blocker. No runtime retrieval behavior, language gate, or benchmark threshold changes.

I did not rerun CI or modify source files.
