# Language and discourse evaluation

These artifacts contain only the invented English/Russian corpus and its generated outputs. The runtime
retention and answer model is evaluated separately from an independent reviewer model. Raw reports keep
`independentlyReviewed: false` and `releaseEligible: false`; the separate computed gate binds the reports to
both reviews and is the authority for the reviewed result.

The input review was completed without outputs. Output review receives the frozen sources, their approved
expectations, saved knowledge, retrieved passages and answers, without runtime verifier verdicts or aggregate scores. It judges
useful retention, relevant qualified retrieval, qualified answers, justified abstentions, language, attribution and factual promotion.
Null answers never count as useful answers. Review is fallible model adjudication of a finite corpus.

The gate requires both complete splits with at least two runs and all eight query/answer/view combinations.
Every split and run must meet the declared coverage thresholds. No accepted language error, lost
qualification, unsafe factual promotion or source-byte change is allowed. Review receipts and reports are
bound by fingerprints; stale runtime contracts, missing judgments and duplicate combinations fail closed.

Run the production path against isolated invented knowledge bases with:

```bash
pnpm build
pnpm bench:language --live --split development --corpus v7 --runs 2 --output bench-results/language-development.json
pnpm bench:language --live --split held-out --corpus v7 --runs 2 --output bench-results/language-held-out.json
```

The frozen v7 development inputs were exposed during earlier diagnostic runs. Its held-out inputs were
reviewed before their first execution. Once inspected to tune runtime behavior, a held-out set becomes
diagnostic evidence; freezing its bytes does not make it unseen again. Preserve earlier reports instead of
overwriting them or relabeling their results.

See [the evaluation contract](../../docs/language-and-discourse.md#evaluation) for the independent review
workflow, scope and earlier baselines. Broader languages, arbitrary implicit discourse and longitudinal
memory reliability need separate evaluation.

The [v14 baseline gate](results/v14-baseline/gate.json) failed answer coverage in its first held-out run.
Its raw reports and independent input/output receipts remain alongside the gate for review and comparison.
The gate was computed with its original runtime contracts at commit `ebc5814`.
