# Semantic merge discovery benchmark

This benchmark tests whether Akno can discover duplicate or near-purpose pages without treating every similar
page as mergeable. The dangerous counterexamples are related scopes, repeated templates, and pages that mention
the same words while representing different entities.

The benchmark has two stages:

1. Embeddings provide a permissive candidate prefilter. The report also searches for an embedding-only
   threshold to demonstrate whether similarity could safely decide on its own.
2. The production merge classifier judges every pair that passes the fixed prefilter. Passing requires 100%
   precision, no false positives, at least 75% recall, and complete rejection of every hard-negative category.

The tracked corpus is wholly invented and the command never opens the configured knowledge base. Model calls
receive only the compact invented pages in the selected split.

## Development run

Use development while changing discovery or classifier behavior:

```bash
akno bench merge \
  --split development \
  --embedding-provider openai --embedding-model text-embedding-3-small \
  --provider openai --model gpt-5.6-luna --reasoning none \
  --output ./merge-development.json
```

A passing development result proves only that the current design works on tuning-visible examples. It cannot
authorize semantic candidates in autonomous maintenance.

## Frozen held-out release gate

The held-out split cannot run until a separate reviewer approves its model-output-free packet:

```bash
akno bench merge review --output /tmp/akno-merge-discovery-review.json
```

The reviewer checks every source and declared pair without inspecting scores or model decisions, marks every
entry, completes the independence attestations, and returns the packet. Only then run the gate:

```bash
akno bench merge \
  --split test --runs 5 \
  --input /tmp/akno-merge-discovery-review.json \
  --embedding-provider openai --embedding-model text-embedding-3-small \
  --provider openai --model gpt-5.6-luna --reasoning none \
  --output ./merge-held-out.json
```

Release eligibility additionally requires all five runs to pass, every case decision to remain stable, and the
exact result to be persisted. The artifact contains only ids, scores, decisions, metrics, model receipts, and a
content-free review receipt; it does not copy the review packet's page text.

The recorded development evidence under `results/` shows why the classifier is necessary. Semantic discovery
remains research-only until a reviewed held-out artifact satisfies every release gate.
