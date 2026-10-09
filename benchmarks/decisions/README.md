# Decisions reranking

The OpenAI Luna preset uses `mode: "decisions"` with `gpt-6-luna`. `mode: "llm"` preserves the
base-model listwise classifier; `mode: "endpoint"` preserves native cross-encoder reranking.

The runtime contract is `akno-decisions-relevance-v2`: shared bounded excerpts, one four-level score
question per opaque candidate, expected-score ordering, complete-batch validation, and a default
P(irrelevant) removal boundary of 0.8. Returned relevance means P(strong support or direct answer).
Automatic context admission requires at least 0.5 and the existing subject/temporal checks. Provider
credentials and generation transport remain independent. A four-second preset deadline bounds all
Decisions attempts and backoff; no automatic generation fallback follows a failed batch.

Run `pnpm build && node scripts/bench-decisions.mjs <output.json>` with the OpenAI provider configured.
It uses only the existing invented **development** corpus, never the historical held-out split or the
installed knowledge base. It compares three Decisions repetitions with one base-model repetition,
ten candidates, 800-character excerpts and concurrency one. The old ranking-matrix release evidence
is not reused to qualify this changed contract.

The 2026-10-09 development comparison returned 180/180 valid Decisions batches, 100% direct/support/
marginal retention, 100% instruction-negative rejection, 0.977 nDCG, 91.7% success@1 and 100% success@3.
Median/p95 latency was 214/1255 ms. Base-model generation returned 57/60 valid batches, 0.952 nDCG,
83.3% success@1 and 95% success@3 at 1991/3119 ms. Two Decisions requests exceeded two seconds
(maximum 2924 ms), which is why the preset uses four seconds. This is a 9.3x median stage gain;
there is no claim of an equivalent whole-turn gain. Candidate qualification remains more conservative:
51.1% of irrelevant excerpts were removed versus 73.7% by generation.

The bound production retrieval harness, using the configured local embedding model unchanged,
indexed 120 invented sources and tested 60 development queries through `open` and `recall`. It
retained every direct answer through candidate selection and final assembly, achieved 96.7% success@1
and 100% success@3, with no degradation or reranker fallback. Full ranked recall median/p95 was
252/382 ms. These are source-author development measurements, not independent held-out release
qualification or a population accuracy estimate. Source locator, memory isolation, abstention and
failure behavior remain covered by the ordinary runtime suite.

The [ranking receipt](results/development-gpt-6-luna-v2-2026-10-09.json) and
[retrieval receipt](results/development-retrieval-gpt-6-luna-v2-2026-10-09.json) retain exact coordinates.

A separate matched 40-candidate development comparison measured Decisions at 306/463 ms median/p95
versus the installed native reranker at 881/1448 ms (2.9x median gain). It retained all relevant evidence
and reached 0.935 nDCG versus native 0.896, but rejected only 96.7% of instruction-only negatives. That
larger window fails the perfect instruction-negative gate and is **not** the selected default. The
qualified default remains ten candidates with the existing bounded semantic-tail selector. The native
reference reports ordering only; no unverified native calibration is used to claim qualification parity.
