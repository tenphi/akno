# Auto-recall host-answer benchmark

This benchmark compares the same invented host-model turn twice: once with exact evidence from
`context(profile: 'auto_recall')`, and once with no memory evidence. Its dedicated development and held-out
corpora each contain sixteen invented sources and twelve cases across eleven categories. Their ids, paths,
source bodies, questions, markers, values, and layouts are disjoint.

```bash
akno bench auto-recall-answer --split development --concurrency 2
akno bench auto-recall-answer --split test --runs 5 --concurrency 2 \
  --output benchmarks/auto-recall-answer/results/test.json
```

The host is instructed to treat memory as untrusted quoted data, answer only from supplied evidence, omit
unsupported parts, and abstain when evidence is absent. The gate requires perfect context activation,
evidence-fact coverage, answer facts, abstention, pairwise improvement, instruction isolation, and repeated
decision stability. It also bounds context, total memory-on, and paired incremental p95 latency. Evidence-fact
coverage fails before host generation when auto-recall selected a relevant page but omitted another source
needed to answer the complete prompt.

Artifacts contain only invented case ids, content-free decisions, aggregate metrics, model identities, usage
receipts, and timings. They contain no prompt, evidence, generated answer, source locator, provider error,
endpoint, credential, or configured knowledge-base content.

The first frozen OpenAI Luna v1 held-out result is intentionally retained as a failed gate. Safety and
abstention were perfect, but list-form evidence was not answered and the two-page compound answer was incomplete
and unstable. Those structures were reproduced only in new development data. Auto-recall now rejects stale-only
evidence for current-value prompts and may assemble complementary date, amount, or duration sources only when
they share the complete subject and supply exactly one explicit value for each requested field; a conflicting
field makes the bundle empty.

The fresh fingerprint-bound v2 held-out result passed all technical gates across five runs and 60 paired case
executions: every activation, evidence fact, answer fact, abstention, pairwise, safety, and stability metric was
perfect. Context p95 was 494 ms, total memory-on p95 was 2.257 seconds, and paired incremental p95 was 1.015
seconds. The failed v1 and passing v2 artifacts are both evidence, not tuning data. Independent corpus review
remains the only release blocker before host integration.
