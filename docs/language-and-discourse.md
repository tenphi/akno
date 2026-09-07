# Knowledge language and discourse

Akno separates source language, generated knowledge language, and answer language. Set
`knowledge_language: "en"` in machine configuration to generate English knowledge from English, Russian,
or mixed sources. The default `null` preserves previous generation behavior. The setting is never inferred
from the latest source, query, operating-system locale, or provider response.

```jsonc
{ "knowledge_language": "en" }
```

English is the initial supported knowledge target. `answer({ answer_language: "ru", ... })`, or
`akno answer ... --language ru`, independently requests a Russian answer. Without an override, the knowledge
language applies; if both are unset, generation retains its legacy prompt behavior. Hosts discover the effective
policy in `context.knowledge_language` and remain responsible for their own final conversation responses.

## Generated prose and exact content

The shared model client applies the policy to retained prose, semantic labels, summaries, observation patterns,
reflection principles, curation bodies, and new titles. Exact original support/discourse-frame quotations,
names, identifiers, code, paths, existing title references, and destination headings keep their original form.
Source image extraction/transcription explicitly preserves the source language.
Changing the setting does not translate existing pages, rename identities or folders, or enqueue bulk translation.

Generation receives an explicit language instruction. A separate bounded call checks generated prose fields
without translating them. A mismatch returns `language_mismatch`; an invalid/unavailable check or oversized
output returns `language_check_failed`. Neither exposes fallback generated prose for a write. The check permits
at most 24,000 generated characters, shares an explicit caller latency deadline, and adds one model request
when prose is generated. Classifier-only JSON needs no language call. Receipts aggregate both calls' usage.
This verdict is fallible and verifies neither truth nor translation entailment; retention and answers retain
their separate semantic verifier.

Provided retention remains exact and model-free. With English configured, callers must attest supplied prose
with `retention.knowledge_language: "en"`. Missing attestation returns `language_policy_required`; a different
declared language returns `language_mismatch`, without a write or replay receipt. The caller owns that attestation
and the supplied semantics. Akno does not guess language from names or short strings, translate the candidate,
or imply semantic verification. Exact `write` operations and authored text remain under caller control.

New retain receipts record `knowledge_language`. An existing source revision replays its recorded policy and
outcome before checking current configuration, with no additional translation or write.

## Ordinary Markdown

A versioned deterministic scanner qualifies ordinary Markdown without adding markers or changing its bytes.
It reads the complete current file before selecting an excerpt. Returned lines carry `prose`: a view,
qualification status, reason, exact file hash, and bounded original-language context frame. This describes how
a statement is expressed, not whether it is true, and grants no managed-item authorship or retain receipt.

The first scope recognizes English/Russian hypothetical and tentative wording, ATX/setext headings, nested
headings, block quotations, speaker turns and role headings, plans, questions, rejection, fenced examples,
source fences, and an explicit following qualification referring back across a paragraph break. Conditional
and speaker scope continues across blank lines until the next heading. Sibling headings end their enclosing
scope; nested headings retain it.

| Reading                                                        | Factual use                                  | Inspection                                                    |
| -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Ordinary assertion                                             | Eligible evidence, without a truth guarantee | Original text                                                 |
| Report, scenario, tentative passage, plan, question, rejection | Embedded proposition excluded                | Explicit view or `all`, with deciding context                 |
| Frame over 12 lines or 2,400 characters                        | Ineligible, including answer view `all`      | Original text, `unresolved`, and `prose_discourse_unresolved` |

Fact extraction never receives disqualified lines. Structural indexing removes old derived facts and timeline
events on those lines before deferred model work. Factual graph edges require an eligible passage projection.
Recall, context and answers retain qualification and count frames against evidence budgets. Answers must
preserve nonfactual status and citation context. CLI excerpts show qualification labels and scope line references;
`--json` exposes the exact frame.

Whole-page summaries are suppressed when ordinary prose includes a nonfactual passage. Whole-page curation,
splitting, extraction and merging are held for those inputs; curation reports `prose_discourse_held`. Such pages
are also excluded as neighboring synthesis evidence. Observe and reflection consume the eligible fact graph.
These conservative choices keep summaries and rewrites from removing deciding context while a richer
passage-aware synthesis contract is absent. Exact user edits and source inspection remain available.

Reads recompute scope from current bytes, including editor changes that precede watcher indexing. Projection
upgrades and rebuilds leave source bytes unchanged. Missing/stale index qualification reports
`partial_memory_index`; oversized frames stay inspectable with typed degradation. No semantic classifier model
is required. The scanner does not understand arbitrary implicit discourse, every speaker convention, or every
language. Unsupported implicit qualifications may be missed; conservative false holds and bounded supported
cases must be assessed separately from model quality.

## Evaluation

The frozen `language-discourse-v2` corpus separates development and held-out cases with invented English,
Russian and mixed sources; the exposed v1 corpus remains available unchanged. Deterministic CI covers policy, exact quotes, qualification, source-byte preservation,
rebuild/replay, graph eligibility, and failures. It does not establish live-model quality.

```bash
pnpm build
pnpm bench:language --live --split development --corpus v2 --runs 2
pnpm bench:language --live --split held-out --corpus v2 --runs 2
```

These explicitly opted-in runs use configured model roles and temporary isolated knowledge bases. They retain,
restart/rebuild, replay, query in English and Russian, assemble context, and request English and Russian answers.
Each case runs the full eight combinations of query language (English/Russian), answer language
(English/Russian), and explicit/inferred memory view. `--runs` accepts one through five repetitions, each in
fresh directories; `--case ID` selects diagnostic cases and records the selection in the report.
Ordinary passages are read and inspected through production operations. Reports include corpus/policy/prompt
versions, model ids, stage receipts, per-language/scenario counts, and denominators for holds, coverage, typed
semantic mismatches, noncanonical eligibility flags, language rejection and availability. Index summaries/facts are disabled
in this language benchmark; integration tests cover ordinary fact and graph derivation separately.

V2 introduces authored review expectations and separates writable language fidelity from a deliberately
read-only admission case. The ordinary source passage is indexed after retention, so it cannot win routing
against the writable destination. V1 indexed that passage first as a read-only knowledge page: some apparent
false holds were legitimate refusals to substitute a weaker writable page. The old setup is recorded as
`legacy-read-only-source-before-retain`; its coverage is not directly comparable to v2. Routing authority,
folder admission and configured fallback behavior are preserved.

Answer diagnostics expose `reason_code` and `validation`: generated blocks, blocks passing deterministic
guards, independently verified blocks, and rejection counts for citations, protected values, attribution,
discourse and semantic support. `verified_blocks: null` means verification did not complete; it is not a failed
semantic verdict. No eligible evidence is an abstention, without a fabricated `answer_failed` degradation.
Retain candidates expose `hold_stage` and `routing_reason` for validation, verifier and placement decisions.
Unavailable or invalid routing models report typed degradation; receipts preserve those diagnostics on replay.
Old receipts may lack the new optional fields. These fields contain no source text.

Answer guards accept bounded English/Russian qualification forms while checking combined semantics: a
reported tentative claim must retain both attribution and uncertainty, and fictional examples must remain
fictional. The complete answer still passes a separate semantic verifier. Exact source frames may contain a
narrower support quotation; they must remain byte-exact, uniquely located, and in the same source item.

Reports under `bench-results/` contain diagnostics and generated text from the invented corpus for review.
Inspect `reviewKnowledge` and `reviewAnswer` against frozen sources when adjudicating translation, attribution,
polarity and useful answers. Produced answers are reported both over all requests and over retained cases;
independently judged useful answers and justified abstentions remain separate, unassessed metrics. Accepted language-error, translation-error and unsafe-promotion rates stay **unassessed** until that
review: another model's agreement is not ground truth. Reports declare thresholds and remain ineligible as
release evidence without independent adjudication. Preserve prior reports for comparisons.

Older frozen answer corpora are unchanged. Some expect factual answers from a record that “says” a claim;
the stricter report boundary abstains on those cases. Their benchmark gates expose the coverage loss instead
of silently replacing expected answers. General longitudinal reliability and bounded observation/reflection
inference remain separate roadmap work.

A split used to diagnose or tune a fix is exposed diagnostic evidence afterward, even if its frozen name is
`held-out`. Fresh independently reviewed cases are required for an unbiased release-quality claim.

## Initial live baseline

The initial diagnostic run used `language-discourse-v1` (fingerprint
`69752a7525357e462aea76b251f531a33862279b0a87900eeb182bed6d1db458`), English knowledge,
`retain-extraction-language-v1` / `retain-verifier-language-v1`, `answer-generation-v5` /
`answer-verifier-v3`, and `prose-v1`. Retention/answer used `gpt-5.6-luna`, embeddings used
`text-embedding-qwen3-embedding-0.6b`, and expansion used `llama-3.2-3b-instruct`.

| Diagnostic metric                                       | Development   | Exposed held-out |
| ------------------------------------------------------- | ------------- | ---------------- |
| Useful cases with retained knowledge                    | 6/8           | 4/6              |
| False holds among useful cases                          | 2/8           | 2/6              |
| Expected safe holds                                     | No such cases | 2/2              |
| Retained cases retrieved with qualification             | 6/6           | 4/4              |
| Retained cases matching typed expectations              | 6/6           | 4/4              |
| Ordinary prose qualification matches                    | 8/8           | 8/8              |
| Source-byte changes                                     | 0/8           | 0/8              |
| Noncanonical eligibility warning flags                  | 0/6           | 0/6              |
| Cases with language-policy rejection                    | 0/8           | 0/8              |
| Cases with model availability degradation               | 1/8           | 0/8              |
| Queries producing an answer, before independent grading | 13/32         | 12/32            |
| Queries reporting `answer_failed`                       | 8/32          | 16/32            |

Useful retention is below the declared 80% threshold in both splits. Three useful cases were held because
routing found no writable destination in the legacy mixed-permission setup; the counterfactual case was held for uncertain discourse semantics.
The development availability degradation came from query expansion. The `answer_failed` counts arose after
retention left no exact answer evidence in the queried folder; they are distinct from model availability.
Some retained reports, tentative claims and fictional examples were retrieved but did not yield accepted answers.

These counts describe behavior, not independently graded answer correctness. Zero eligibility flags or language
rejections does not establish zero accepted semantic/language errors. Those error rates remain unassessed, and
this baseline **does not pass the live quality gate**. The implementation supplies conservative controls and
reviewable diagnostics; routing coverage, qualified answer usefulness and independent quality adjudication
still need work. The original frozen answer benchmarks also retain their visible coverage failures described above.

## Repeated v2 diagnostics

The next run froze eight fresh cases before execution (`language-discourse-v2`, fingerprint
`9be572567928a10c4002d811a4f882424aa9d2a4bbea56067768f6383779f5a7`) and repeated each split twice.
It used the same model roles as the initial baseline, `answer-generation-v6` / `answer-verifier-v4`, and
all eight independent query/answer/view combinations per case. These are authored expectations with
implementation review, not independent adjudication. The diagnostic artifacts are
`language-development-v6.json` and `language-held-out-v6.json` under ignored `bench-results/`.

| Diagnostic metric                              | Development, two runs | Held-out, two runs |
| ---------------------------------------------- | --------------------- | ------------------ |
| Expected useful cases with retained knowledge  | 7/8                   | 2/6                |
| Expected-retention misses                      | 1/8                   | 4/6                |
| Expected read-only holds                       | No such cases         | 2/2                |
| Retained cases retrieved with qualification    | 7/7                   | 2/2                |
| Produced answers over retained cases' requests | 40/56                 | 10/16              |
| Produced answers over all requests             | 40/64                 | 10/64              |
| No eligible answer evidence                    | 8/64                  | 48/64              |
| Draft guard rejection                          | 6/64                  | 2/64               |
| Semantic verifier rejection                    | 10/64                 | 4/64               |
| Model availability degradation                 | 0/8                   | 0/8                |
| Ordinary qualification matches                 | 8/8                   | 8/8                |
| Source/index-rebuild byte changes              | 0/8                   | 0/8                |

One development hypothesis was held during deterministic validation (`discourse_uncertain`). In both held-out runs the model
selected no durable candidate from the fictional example; the proposal mentioning “next month” was held
as `time_unresolved` because no source clock/timezone was supplied. The read-only case reported
`read_only_match` at placement without calling the routing model. A separate final two-run admission
probe also checked the tree before and after retention and found no byte changes.

The two noncanonical-eligibility flags in held-out are the factual denials “the warranty was not extended”
retained alongside separately marked counterfactuals, which the authored expectation explicitly allows.
They illustrate why the flag is a review signal, not a measured unsafe-promotion rate. Likewise, the original
v6 artifacts label expected-retention misses `falseHolds`; the runner now calls those
`expectedRetentionMisses` and leaves v2 `falseHolds` unassessed pending independent judgment. An unanswered
request following a deliberate selection or unresolved-time hold is not automatically an incorrect abstention.

Auto-recall activated for 8/128 requests. The reports now preserve the full activation receipt, including
candidate count, qualification pass and reference resolution. This run disables the reranker: ambiguous
cases requiring calibrated qualification cannot activate through that path. That result does not establish
a language-specific auto-recall recall rate, and no injection/permission gate was relaxed to improve it.

The repeated run predates the final Russian attribution fixes: accepting “приведённая” as an attribution
form and translating the assistant role when extraction stores `source_speaker: "assistant"`. Actual named
speakers still keep their spelling. Focused built-package probes cover those final fixes; the table is retained
as diagnostic evidence, not relabeled as a measurement of the final guard. Verifier disagreements and
qualified-answer coverage remain visible. Held-out retention remains below the declared target and accepted
semantic/language errors remain unassessed, so **the live quality gate is still not passed**. This held-out
split is now exposed and cannot serve as an unseen release test after these fixes.
