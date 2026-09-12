# V69 publication review

## Verified

The publication's numerical claims match the preserved source-only receipts and summaries:

- adopted useful answers: 68/96 = selected 44/64 + built 24/32;
- complete retained sets: 10/12 = selected 7/8 + built 3/4;
- useful retrieval observations: 80/96 = selected 56/64 + built 24/32;
- published answers: 69/96, leaving 27 nulls;
- selected initial and final source-only receipts both retain 44/64 because the later meaning adjudication changed no label;
- no produced answer has a false source-entailment, language, qualification, or unsafe-promotion label;
- the connector-continuity to connector-integrity generalization is nevertheless identified as a material usefulness failure;
- the independent 42/64 forensic interpretation of fiction q0/q4 and the adopted 44/64 focused-answer interpretation are both disclosed, with the source-only rationale linked and preserved.

The report and decision consistently state that the repeated V21 trial was deferred and its fresh held-out inputs remain unexecuted. The frozen runtime SHA, Luna runtime versus Sol review separation, 2,400-token isolated probe ceiling versus unchanged 1,024-token service overlay, unchanged thresholds/passes, and absence of a successful replacement run are presented with appropriate limits. README-local links resolve.

## Link defects

Three relative links in `generation-design-review.md` do not resolve from `benchmarks/language/results/v69/`:

- `../bench-results/language-selected-v68-trace.jsonl`
- `../packages/core/src/ops/answer-source-audit.ts`
- `../packages/core/src/ops/answer.ts`

From the published V69 directory, these point inside `benchmarks/language/results/`, where the targets do not exist. They should be rewritten to stable repository-relative paths appropriate to the copied file (likely `../../../../bench-results/...` and `../../../../packages/core/...`) or replaced with links to preserved V69 artifacts where intended.

Apart from these three broken links, I found no count, provenance, cap, model, semantic-disclosure, or full-trial-status mismatch. The planned final local-manifest refresh is not treated as a defect.

## Resolution

The three link defects are resolved. The tracked `generation-design-review.md` now uses the correct four-level repository-root prefix for the V68 trace and both `packages/core` source files; all three targets resolve locally. The original finding above remains preserved as review history. No remaining V69 publication issue was found.
