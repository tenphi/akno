# Auto-recall benchmark

This benchmark exercises `context({ profile: "auto_recall" })` through the production index, retrieval,
activation, conditional qualification, and evidence-budget path. It creates and removes a temporary knowledge
base containing only invented sources; it never opens the configured knowledge base.

Development is the tuning split:

```bash
akno bench auto-recall --split development --concurrency 2
```

The held-out split is explicit, fingerprint-frozen, and repeated five times by default:

```bash
akno bench auto-recall --split test --runs 5 --concurrency 2 \
  --output benchmarks/auto-recall/results/test.json
```

The gate requires perfect activation precision/recall, source precision/recall, expected activation and
qualification decisions, locator validity, evidence isolation, and budget compliance; zero irrelevant
injection and degradation; a qualifier activation rate at or below 75%; 100% decision stability and minimum
per-run pass rate; and aggregate p95 latency at or below 10 seconds. Provider-reported token use is stored when
available and remains explicitly unreported for native rerank endpoints.

Artifacts are content-safe: invented case/source ids, typed outcomes, scores, counts, model identities, timings,
and aggregate token receipts only. They contain no prompts, conversation turns, evidence, slugs, paths,
endpoints, credentials, provider errors, or configured knowledge-base content.

The current frozen local-stack artifact passes every technical gate across 60 case executions. Independent
corpus review remains its only release blocker.
