# Benchmarks and model qualification

Akno benchmarks complete user-visible paths, not just isolated model responses. A model can produce a valid
schema while silently dropping the direct answer, making recall slower without changing order, or leaking an
instruction-bearing source into its output. The gates are designed to catch those failures.

All committed benchmark corpora are invented. Live benchmark commands never open or send the configured
knowledge base unless the command explicitly says it is measuring that installation.

## Benchmark surfaces

```bash
akno bench --write
akno bench --retrieval-only
akno bench graph
akno bench entities --provider openai --model gpt-5.6-luna --reasoning none
akno bench answer --concurrency 2
akno bench auto-recall --concurrency 2
akno bench auto-recall-answer --concurrency 2
```

| Surface              | What it protects                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Default / `--write`  | Storage latency and mixed page/document retrieval; optionally persists a report                 |
| `--retrieval-only`   | Reproducible lexical, vector, graph, orphan-document, and budget behavior with no configured KB |
| `graph`              | Identity, provenance, traversal, ambiguity abstention, conflict state, and rebuild equivalence  |
| `entities`           | Contextual-identity selection and abstention against an opt-in live model                       |
| `ranking` tracks     | Graded relevance, qualification, direct-answer retention, stability, latency, and fallback      |
| `answer`             | Direct grounded answer generation plus independent support verification                         |
| `auto-recall`        | Pre-turn activation, evidence selection, reference resolution, safety, and budget fitting       |
| `auto-recall-answer` | Whether injected memory improves a host answer without causing unsupported claims               |

`--split test --runs 5` selects a frozen held-out corpus for supported model-dependent gates. Development is
one run by default so iteration remains cheap. Held-out artifacts are release evidence, never a tuning set.

## What a release result must prove

A useful pass is more than an average score. Depending on the surface, Akno also requires:

- exact corpus fingerprint validation;
- successful independent review of every source and judgment;
- repeated-run decision stability;
- no schema fallback or typed degradation;
- complete retention of direct and supporting evidence;
- rejection of irrelevant and instruction-bearing candidates;
- correct empty and abstention behavior;
- source-locator integrity and hard output budgets;
- latency within the path's declared ceiling; and
- a bound end-to-end run through production candidate generation and assembly.

Reports deliberately omit prompts, questions, evidence bodies, answers, source paths, endpoints, credentials,
and provider error text. They retain stable invented ids, aggregate judgments, model configuration, latency,
token receipts, fingerprints, checks, and blockers.

## Qualified OpenAI minimum

The guided OpenAI setup uses two models through one provider endpoint:

- `text-embedding-3-small` at 1,536 dimensions for semantic candidates; and
- `gpt-5.6-luna` with no reasoning for generative roles and prompted reranking.

This is a **single-endpoint** preset, not a single-model preset. It was selected for quality and cost only after
the ranking and production-path gates passed. The current reranking contract is
`akno-judgment-map-v9` / `tuple-judgment-map-v6`, with a ten-candidate window.

The independently reviewed `invented-ranking-v5` held-out release run covered 120 sources and 80 cases. Across
five repeats, the selected configuration produced:

| Measure                              | Result                  |
| ------------------------------------ | ----------------------- |
| nDCG@10                              | 0.992                   |
| Direct answer at rank 1              | 98%                     |
| Direct answer in top 3               | 100%                    |
| Relevant-evidence retention          | 100%                    |
| Instruction-negative rejection       | 100%                    |
| Top-three stability                  | 100%                    |
| Model fallbacks                      | 0                       |
| Warm single-flight reranking latency | 1.34 s p50 / 2.67 s p95 |

The separate bound production run embedded 120/120 chunks, retained every direct answer through the fusion
pool, judgment window, and final assembly, reached 100% success at ranks 1 and 3, and recorded no degradation
or fallback.

Primary evidence:

- [held-out matrix](https://github.com/tenphi/akno/blob/main/benchmarks/ranking/results/test-openai-luna-v9-stable-ids-corpus-v5-2026-08-25.json)
- [latency receipt](https://github.com/tenphi/akno/blob/main/benchmarks/ranking/results/test-openai-luna-v9-stable-ids-corpus-v5-latency-2026-08-25.json)
- [production-path receipt](https://github.com/tenphi/akno/blob/main/benchmarks/ranking/results/test-end-to-end-openai-luna-v9-stable-ids-corpus-v5-semantic-tail-2026-08-25.json)

These numbers qualify one frozen configuration against one invented corpus. They do not claim that every query,
endpoint load, future model revision, or private knowledge base will behave identically.

## Why old failures remain

Historical artifacts are not clutter to overwrite. They establish which prompt, schema, corpus, or selector
failed and prevent the same regression from being disguised by a newer average.

When an observed held-out failure changes the prompt or grading contract, that corpus remains frozen. The new
contract must be evaluated on fresh held-out content. Selector-only defects may be corrected from existing
measurements when doing so requires no new provider call; the artifact must record that distinction.

Detailed corpus contracts and historical evidence live beside each benchmark:

- [ranking](https://github.com/tenphi/akno/blob/main/benchmarks/ranking/README.md)
- [automatic recall](https://github.com/tenphi/akno/blob/main/benchmarks/auto-recall/README.md)
- [automatic recall plus host answer](https://github.com/tenphi/akno/blob/main/benchmarks/auto-recall-answer/README.md)

## Running a relevant gate

Choose the narrowest surface affected by a change, then run the general suite before release. Examples:

```bash
akno bench graph
akno bench answer --split test --runs 5 --output /tmp/akno-answer.json
akno bench auto-recall --split test --runs 5 --output /tmp/akno-auto-recall.json
akno bench auto-recall-answer --split test --runs 5 \
  --output /tmp/akno-auto-recall-answer.json
```

Do not repeatedly run a frozen held-out corpus while tuning. Reproduce the failure shape in new development
data, make the change there, obtain independent review for a fresh frozen corpus, and run the final gate once.
