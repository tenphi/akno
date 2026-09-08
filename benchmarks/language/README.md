# Language and discourse evaluation

These artifacts contain only the invented English/Russian corpus and its generated outputs. The runtime
retention and answer model is evaluated separately from an independent reviewer model. Raw reports keep
`independentlyReviewed: false` and `releaseEligible: false`; the separate computed gate binds the reports to
both reviews and is the authority for the reviewed result.

The [v22 gate](results/v22/gate.json) fails: development 77/80 and 72/80 useful answers, held-out
69/80 and 61/80. Its 279/320 useful answers leave 40 unjustified nulls and one unsupported translation
from service collection to data collection. Useful retention is 37/40, and all 32 read-only abstentions
are justified. No accepted qualification/language/promotion error or source-byte change was found.
The [complete evidence](results/v22) includes the initial review and corrected source-entailment judgment.
Separate selected and built-package probes scored 23/24 and 14/16.

V23 narrows additional English/Russian intent phrases to qualified reports, rejected offers and discussed
alternatives, preserves explicit independent-verification uncertainty, and clarifies both actual and
counterfactual retention. Translation checks preserve action sense and object. V15 moves the exposed v14
held-out sources into development and adds ten independently approved fresh writable sources under the
unchanged source-entailment, qualification and 90% answer gates.

The [v21 gate](results/v21/gate.json) reaches 90% useful-answer coverage in every split/run but still
fails for five omitted source-relative time qualifications. Development has 79/80 and 72/80 useful answers;
held-out has 78/80 and 79/80. All 40 writable retentions are useful, all 32 read-only abstentions justified,
and no unsupported retained content or nonnull answer was found. The [complete evidence](results/v21)
includes a superseded initial review that missed the five omissions and the corrected authoritative receipt.
The separate built-package probe passed 16/16; a selected diagnostic scored 29/32 and exposed the clock gap.

V22 preserves unknown source-relative timing through answer checks and accepts bounded possessive
speaker attribution. V14 moves exposed v13 held-out sources into development and adds ten independently
preapproved fresh writable held-out sources; the 90% answer and zero-error thresholds remain unchanged.

The [v20 broader diagnostic](results/v20/gate.json) fails the 90% target in all four split/runs:
development 60/80 and 62/80, held-out 66/80 twice. Its 254/320 useful answers leave 51 unjustified nulls
and 15 answers repeating an unsupported booking inferred from service provision. Useful retention was
33/40. All 32 read-only abstentions were justified. The [complete reports and receipts](results/v20)
preserve this failure, including the separate 14/24-useful-answer built-package probe.

V13 moves exposed v12 held-out cases into development and adds ten fresh writable held-out sources.
It keeps the 90% answer target and adds independent source-entailment judgments with zero tolerance for
unsupported retained sets or nonnull answers. Attribution and uncertainty can survive a misquotation;
those qualification dimensions do not establish content accuracy. Historical gates and reviews keep
their original schemas and policies.

The [v19 broader diagnostic](results/v19/gate.json) also fails the unchanged 90% answer target: development
72/80 and 74/80, held-out 71/80 and 62/80 independently useful answers. It records 34 unjustified nulls and
seven incomplete answers following one lost retention contrast. All 32 read-only abstentions were justified.
Complete [reports and reviews](results/v19) are preserved. A separate code audit found an asserted metadata
mismatch on a competing-hypothesis record that the blind grader accepted as a faithful outer discussion
statement; the new v12 review instructions explicitly define commitment as belonging to the embedded proposition.
V12 moves exposed v11 held-out cases into development and adds ten fresh writable held-out sources.

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
useful retention, relevant qualified retrieval, qualified answers, justified abstentions, language, attribution and factual promotion. V13 through V15 also judge retained and answered content against the original source, scored separately from qualification.
Null answers never count as useful answers. Review is fallible model adjudication of a finite corpus.

The gate requires both complete splits with at least two runs and all eight query/answer/view combinations.
Every split and run must meet the declared coverage thresholds. No accepted language error, lost
qualification, unsafe factual promotion or source-byte change is allowed. Review receipts and reports are
bound by fingerprints; stale runtime contracts, missing judgments and duplicate combinations fail closed.

Run the production path against isolated invented knowledge bases with:

```bash
pnpm build
pnpm bench:language --live --split development --corpus v15 --runs 2 --output bench-results/language-development.json
pnpm bench:language --live --split held-out --corpus v15 --runs 2 --output bench-results/language-held-out.json
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
