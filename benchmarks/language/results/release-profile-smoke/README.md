# Release profile smoke

This bounded check supplements the [fixed comparison](../fixed-comparison/README.md). It does not change
that comparison's score, grades, failed reliability gate, or seven-iteration implementation accounting.
There was one live pass, with two invented sources and four explicit-English answer requests. No model,
prompt, production guard, or quality threshold was changed.

## Live positive checks

Both isolated profiles inherited the committed answer ceiling of **2,400 tokens / 60 seconds** and
derive ceiling of **2,400 tokens / 120 seconds**, with unset reasoning effort. The default profile left
`knowledge_language` unset; the second selected `"en"`. Configured provider connections and derive/embedding
model identities were supplied; answer inherited the derive model. Transport retries were disabled to
bound the smoke. Invented folder rules and disabled summaries/facts excluded unrelated work; query
expansion, graph expansion and reranking were also disabled. These overrides are recorded in the report.

| Profile                    | Source                   | Retention                                          | Answers                                           |
| -------------------------- | ------------------------ | -------------------------------------------------- | ------------------------------------------------- |
| Default language targeting | English assistant report | Qualified report with exact original source        | Factual case color and attributed warranty report |
| English knowledge          | Russian assistant report | English qualified report with exact Russian source | Factual case color and attributed warranty report |

Both reports preserve the five-year warranty statement and its lack of independent verification. All
four answers preserve the selected source meaning; their API outcome is `partial`, with one verified
block each and no degradation. Observed aggregate model-call latency was about 5.8–15.2 seconds per
answer. These four observations establish neither a latency distribution nor a quality rate.

Wire telemetry records ordinary generation at **1,024**, report generation at **1,536**, and report
verification capped from its requested **3,124** to **2,400** tokens. The two language profiles apply the
same Markdown factual/report boundary and source verification. Indexing, restart/rebuild, replay,
answers and injected failures preserve existing source bytes and the file set. Automatic retention's
intended additions are measured separately from subsequent byte-preservation checks.

## Harness failure and offline correction

[initial-run.json](initial-run.json) remains **`passed: false`**, with 33 of 38 assertions passing.
[initial-runner.mjs](initial-runner.mjs) preserves the exact executed runner. Its phase detector inspected
only the first system message; a prepended language instruction hid several operation-stage labels.
Four failed telemetry assertions therefore misidentified calls whose actual wire ceilings and public
verification receipts are present in the report. The fifth failure exposed an unexecuted English
malformed-verifier injection: the harness replayed the valid verification response instead. That control
does not count as a successful failure check. The default profile's malformed-verifier control and both
profiles' injected generation/extraction timeouts did execute and returned typed failures.

The active runner now examines every system message and requires exactly one malformed-verifier
injection per profile. It has **not been rerun live**. The separate
[failure-controls.json](failure-controls.json) passes nine zero-egress checks: four checks exercise the
corrected phase detector, both language profiles withhold a malformed ordinary-answer verifier response,
both preserve source bytes, and only the two intended synthetic requests occur. These controls use
scripted generation/language-check prefixes and the real built verification/parser path. They cover the
shared answer-verification failure mechanism, not a retained-report-specific injection. Immediate injected
timeouts in the original run test typed failure handling, not actual deadline expiry. Replayed prefix
usage in injected results is copied metadata, not additional provider usage.

## Scope and reproduction

Run the built-package smoke only when deliberately authorizing model egress:

```bash
pnpm build
node scripts/smoke-language-release.mjs --live --output tmp/release-smoke.json
node scripts/smoke-language-failure-controls.mjs tmp/release-failure-controls.json
```

The second command requires configured derive/embedding connections and writes only to isolated,
invented knowledge bases. The third blocks external requests. Both refuse to overwrite an existing
report. See [validation.json](validation.json) for artifact hashes and the explicit disposition of each
initial assertion failure, and the [independent review](review.md) for the source and control assessment.

This smoke supplements release configuration evidence. It does not validate the 2,400-token profile
against the full quality corpus. The frozen comparison at a 1,024-token answer ceiling still has one
unsupported retained set and nine erroneous answer outputs; issues #61/#62 remain open.
