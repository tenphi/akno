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
