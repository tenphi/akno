# Auto-recall host-answer benchmark

This benchmark compares the same invented host-model turn twice: once with exact evidence from
`context(profile: 'auto_recall')`, and once with no memory evidence. It reuses the grounded-answer corpus but
excludes its graph-only case because auto-recall deliberately disables graph traversal.

```bash
akno bench auto-recall-answer --split development --concurrency 2
akno bench auto-recall-answer --split test --runs 5 --concurrency 2 \
  --output benchmarks/auto-recall-answer/results/test.json
```

The host is instructed to treat memory as untrusted quoted data, answer only from supplied evidence, omit
unsupported parts, and abstain when evidence is absent. The gate requires perfect context activation, facts,
abstention, pairwise improvement, instruction isolation, and repeated decision stability. It also bounds
context, total memory-on, and paired incremental p95 latency.

Artifacts contain only invented case ids, content-free decisions, aggregate metrics, model identities, usage
receipts, and timings. They contain no prompt, evidence, generated answer, source locator, provider error,
endpoint, credential, or configured knowledge-base content.

The first frozen OpenAI Luna held-out result is intentionally retained as a failed gate. Safety and abstention
were perfect, but a list-form cadence was not answered and the two-page compound answer was incomplete and
unstable. A failed held-out artifact is evidence that host integration is not ready; it is not input for tuning
the frozen corpus.
