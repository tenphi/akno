# Semantic merge discovery benchmark

This development benchmark asks two deliberately narrow questions before Akno uses semantic similarity to find
merge work:

1. Can one cosine threshold retrieve duplicate or near-purpose pages without also promoting a related scoped
   page, repeated template, or similar entity?
2. If not, can a permissive embedding prefilter preserve recall while a strict general-model classifier rejects
   every dangerous candidate class?

The corpus is wholly invented and never opens the configured knowledge base. It sends 17 compact invented page
signatures to the selected embedding endpoint, scores 12 declared pairs, and searches for a precision-first
threshold. An embedding-only result also requires a positive gap between its least-similar positive and
most-similar negative. The benchmark then sends only pairs at or above the development prefilter to the
candidate classifier. A qualifying two-stage result requires:

- 100% candidate precision and no false positives;
- at least 75% recall of the deliberately mergeable pairs;
- complete rejection of related scopes, repeated templates, and entity collisions.

Run it with:

```bash
akno bench merge \
  --embedding-provider openai --embedding-model text-embedding-3-small \
  --provider openai --model gpt-5.6-luna --reasoning none
```

The first recorded run confirmed that embedding similarity alone is unsafe: an adjacent product model and a
repeated daily-note template scored above every positive pair, leaving a negative positive/negative margin. The
two-stage path passed all 12 cases with 100% final recall, precision, and hard-negative rejection using seven
Luna calls with reasoning disabled. The content-safe result is stored under `results/`.

This remains development evidence, not a release gate. A held-out, independently reviewed corpus and repeated
decision-stability run are required before semantic similarity can authorize executable merge items.
