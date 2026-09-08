# Language and discourse evaluation

These artifacts contain only the invented English/Russian corpus and its generated outputs. The runtime
retention and answer model is evaluated separately from an independent reviewer model. Raw reports keep
`independentlyReviewed: false` and `releaseEligible: false`; the separate computed gate binds the reports to
both reviews and is the authority for the reviewed result.

The [v18 broader diagnostic](results/v18/gate.json) fails its predeclared 90% answer target. It preserves
264/320 useful answers, 55 unjustified nulls, one incomplete answer, one saved-report qualification omission
and one case with model availability degradation. Complete reports and independent receipts remain in
[results/v18](results/v18). Its corpus contains twice the earlier writable scenario count. V11 uses the exposed
v10 held-out scenarios for development and introduces ten fresh sources of the same kinds.

The [v17 gate](results/v17/gate.json) passes for the v9 corpus and frozen runtime at `bb78edf`, using
GPT-5.6 Luna for retention/answers and GPT-5.6 Sol for independent review. Useful retention was 19/20,
qualified retrieval 80/80, and useful qualified answers 143/160 across the two repetitions per split.
Every split/run met its thresholds. No accepted language/qualification/promotion errors or source-byte
changes were found. The complete reports and review receipts are in [results/v17](results/v17).
Seventeen unjustified null answers and one incomplete retention remain recorded coverage losses;
all 16 read-only abstentions were justified. The built-package probe is separate deployment evidence.

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
pnpm bench:language --live --split development --corpus v11 --runs 2 --output bench-results/language-development.json
pnpm bench:language --live --split held-out --corpus v11 --runs 2 --output bench-results/language-held-out.json
```

The v10 development split contains all ten writable scenarios from the now-exposed v9 corpus. Its ten fresh
held-out scenarios include multi-turn frames and new source wording. Both splits have one read-only case.
V10 requires at least 90% useful qualified answers in each split/run, with language/scenario breakdowns;
historical corpora retain their originally declared 80% answer threshold. Inputs require independent approval
before their first execution. Once inspected to tune runtime behavior, a held-out set becomes
diagnostic evidence; freezing its bytes does not make it unseen again. Preserve earlier reports instead of
overwriting them or relabeling their results.

See [the evaluation contract](../../docs/language-and-discourse.md#evaluation) for the independent review
workflow, scope and earlier baselines. Broader languages, arbitrary implicit discourse and longitudinal
memory reliability need separate evaluation.

The [v14 baseline gate](results/v14-baseline/gate.json) failed answer coverage in its first held-out run.
Its raw reports and independent input/output receipts remain alongside the gate for review and comparison.
The gate was computed with its original runtime contracts at commit `ebc5814`.

The [v16 diagnostic gate](results/v16/gate.json), computed at `ac562f8`, failed both held-out answer thresholds
and found one readable-time qualification omission. Its complete reports and reviews are preserved;
the separate built-package probe in that folder is deployment evidence only.
