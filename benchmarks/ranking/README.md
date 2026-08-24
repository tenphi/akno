# Ranking benchmark artifacts

`akno bench ranking --matrix --output <path>` writes a versioned JSON report here. The report is safe to
review and check in because the benchmark corpus is entirely invented and the artifact stores only metrics,
configuration identifiers, and stable candidate ids for top-three rankings. It does not store candidate text,
raw prompts or responses, knowledge-base content, endpoint URLs, or credentials.

Development artifacts tune candidate count, reasoning effort, and latency. They cannot authorize the
single-endpoint preset: the mechanical release gate also requires an independently reviewed corpus and an
explicit five-run `--split test` artifact. Never use the held-out split while changing the prompt or thresholds.

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
JSON Schema definitions. The checked-in
`development-openai-luna-v6-targeted-2026-08-24.json` artifact records 300/300 valid responses, zero fallbacks,
0.958 mean nDCG, 100% median top-three overlap, and 3.39-second p95. Provider usage averaged 958 input and 157
output tokens per query. This is repeated development evidence, not a full comparison matrix or held-out
release artifact. Do not treat the v4/v3 files as release evidence for this changed contract.

After the matrix selects a configuration, attach production-pipeline evidence over a temporary, entirely
invented knowledge base:

```bash
akno bench ranking --track end-to-end \
  --matrix-artifact benchmarks/ranking/results/development-openai-luna.json \
  --output benchmarks/ranking/results/development-end-to-end-openai-luna.json
```

The end-to-end artifact stores embedded/total chunk counts, candidate-window and final-ranked metrics, typed
degradation counts, latency, and stable failed-case ids. It stores no query or source text and never opens the
configured knowledge base. When embedding is unavailable or incomplete, it fails before recall rather than
publishing lexical fallback scores under the selected embedding model's name.

Artifacts are written through a uniquely named temporary file and renamed only after the JSON is complete.
