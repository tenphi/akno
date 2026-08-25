# Ranking benchmark artifacts

`akno bench ranking --matrix --output <path>` writes a versioned JSON report here. The report is safe to
review and check in because the benchmark corpus is entirely invented and the artifact stores only metrics,
configuration identifiers, and stable candidate ids for top-three rankings. It does not store candidate text,
raw prompts or responses, knowledge-base content, endpoint URLs, or credentials.

Development artifacts tune candidate count, reasoning effort, and latency. They cannot authorize the
single-endpoint preset: the mechanical release gate also requires an independently reviewed corpus and an
explicit five-run `--split test` artifact. Never use the held-out split while changing the prompt or thresholds.

Export the corpus-only independent-review handoff separately from benchmark outputs:

```bash
akno bench ranking review --output /tmp/akno-ranking-review.json
```

The reviewer must work outside corpus authorship and runtime prompt/threshold tuning, without consulting matrix
outputs. They mark all 120 sources and all 80 cases, resolve every issue, and complete the packet's global and
independence attestations. Attach the returned approved packet with:

```bash
akno bench ranking review --input /tmp/akno-ranking-review.json \
  --matrix-artifact benchmarks/ranking/results/development-openai-luna.json
```

Only a content-free receipt is copied into the matrix. It is bound to the whole-corpus SHA-256, so changing any
source, query, intent, pool order, or grade invalidates it. Akno validates completeness and identity; human or
model independence is established by the separate handoff and review history, not authenticated by the CLI.
Do not check a working packet into `results/`—it deliberately contains the held-out corpus and judgments.

After resolving `changes_requested`, preserve exact earlier decisions without trusting approximate similarity:

```bash
akno bench ranking review --input /tmp/akno-ranking-review.json \
  --output /tmp/akno-ranking-review-v3.json
```

The rebase carries only byte-equivalent `pass` entries. It resets changed entries and all global attestations,
and keeps applicable issue descriptions until the reviewer removes them after verification.

The CLI will not run any ranking `--split test` or `--split all` command without that completed packet. A fresh
held-out matrix takes it directly and carries the receipt into its result:

```bash
akno bench ranking --matrix --split test --input /tmp/akno-ranking-review.json \
  --runs 5 --output benchmarks/ranking/results/test-openai-luna.json
```

Development runs reject `--input`, preventing the reviewed packet from becoming an accidental tuning input.
Latency and end-to-end tracks accept only the resulting reviewed matrix.

Example:

```bash
akno bench ranking --matrix --runs 5 --concurrency 4 \
  --output benchmarks/ranking/results/development-openai-luna.json
```

To repeat one already-chosen development shape without paying for the whole comparison matrix:

```bash
akno bench ranking --matrix --variant llm-none-c10 --runs 5 --concurrency 4 \
  --output benchmarks/ranking/results/development-openai-luna-targeted.json
```

A targeted artifact records the same per-run quality, stability, latency, physical request, and token receipts,
but it deliberately has no selection and cannot satisfy the release gate.

The checked-in development and held-out artifacts for the historical
`akno-listwise-v4` / `compact-entries-v3` contract are:

- `development-openai-luna-v4-2026-08-22.json`
- `test-openai-luna-v4-2026-08-22.json`

The held-out artifact is immutable release evidence. Do not replace it with another run merely because a
stochastic response missed a gate; a later contract needs a new version and a new pre-declared evaluation.

The runtime now uses `akno-judgment-map-v6` / `tuple-judgment-map-v5`. The fixed-id map remains structurally
complete, but each value is the compact `[grade, rank]` pair and repeated pair schemas are sent once through
JSON Schema definitions. The checked-in artifacts for this contract are:

- `development-openai-luna-v6-targeted-2026-08-24.json`
- `development-openai-luna-v6-2026-08-24.json`
- `development-openai-luna-v6-latency-2026-08-24.json`

The full development matrix selects `llm-none-c10`. Across five runs it records 300/300 valid responses, zero
fallbacks, 0.957 mean nDCG, 100% median top-three overlap, and 3.63-second concurrency-four p95. Provider usage
averaged 958 input and 157 output tokens per query. Increasing the window to 20 or 40 candidates reduced quality
and stability while increasing latency and tokens; `low` reasoning was only 88% valid, reached 0.894 nDCG, and
took 10.15 seconds at p95.

The bound latency track then separated fresh-client negotiation from normal service calls. Warm single-flight
p50/p95 was 2.34/3.12 seconds across 59 calls; warm four-way load was 2.26/4.12 seconds. Both profiles were 100%
valid with exactly one endpoint request per warm call. Cold calls took 3.36/2.79 seconds and three physical
requests while each fresh client learned two compatibility differences. The 4-second warm single-flight UX
gate passes; loaded latency remains capacity evidence rather than the single-owner interaction SLO. These are
development artifacts, not held-out release evidence. Do not treat the v4/v3 files as release evidence for
this changed contract.

An independent review subsequently returned `changes_requested` for `invented-ranking-v2`: one negative claim
was true in the invented corpus, and three meeting-location pools contained date evidence that also stated the
location while carrying grade 0. A second review of the corrected v3 corpus found that three of those candidates
were not merely supporting evidence: each explicitly answered the location query and required direct grade 3.
The final distinction between direct, supporting, and marginal cross-fact evidence is regression-tested in
`invented-ranking-v4`. Exact rebasing carries 120 source and 77 unchanged case approvals into the v4 packet,
leaving only the three corrected cases pending. Every older matrix, latency receipt, held-out result, and review
packet is historical evidence whose fingerprint intentionally fails attachment to v4. Approve v4 before paying
for another development matrix or touching the held-out split.

To reproduce and attach the selected configuration's latency profiles:

```bash
akno bench ranking --track latency \
  --matrix-artifact benchmarks/ranking/results/development-openai-luna.json \
  --concurrency 4 --output benchmarks/ranking/results/development-openai-luna-latency.json
```

The command takes provider, model, reasoning, candidate count, excerpt limit, prompt, and schema exclusively
from the matrix. It rejects configuration overrides, measures one cold plus 59 warm calls per development
profile, and atomically attaches only an exact-match result. Artifact refresh preserves the stored threshold;
changing the SLO requires a new latency schema and new pre-declared evidence.

After the matrix selects a configuration, attach production-pipeline evidence over a temporary, entirely
invented knowledge base:

```bash
akno bench ranking --track end-to-end \
  --matrix-artifact benchmarks/ranking/results/development-openai-luna.json \
  --output benchmarks/ranking/results/development-end-to-end-openai-luna.json
```

The end-to-end artifact stores embedded/total chunk counts, candidate-window and final-ranked metrics, typed
degradation counts, latency, and stable failed-case ids. Schema v2 records every grade-3 answer accepted for a
case and uses the best returned rank, so overlapping direct evidence is not treated as a retrieval miss. It
stores no query or source text and never opens the configured knowledge base. When embedding is unavailable or
incomplete, it fails before recall rather than publishing lexical fallback scores under the selected embedding
model's name.

Artifacts are written through a uniquely named temporary file and renamed only after the JSON is complete.
