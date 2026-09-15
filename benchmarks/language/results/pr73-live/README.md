# PR 73 focused live verification

This directory records the focused live measurement for the Markdown heading scope and mixed-language
view-selection fixes in PR #73. The production changes are at `745a8c4`; the frozen runner and corpus are
at `ed3d736`. Every source is invented. Each case uses a fresh temporary knowledge base and the built public
Akno operations, with actual provider calls for generation, retention, verification, and query embeddings.

The focused gate passes: **82/84 useful answers (97.6%)**, with no published source, qualification, language,
or citation errors found in the implementing assistant's source-based review. The two null answers remain
coverage misses. This is not independent adjudication, a held-out result, or the full acceptance gate for
issues #61/#62. The final counts are in `summary.json`; every answer's review is in `adjudication.json`.

| Path              | Repetition 1  | Repetition 2  | Declared minimum per repetition |
| ----------------- | ------------- | ------------- | ------------------------------- |
| Ordinary Markdown | 23/24 (95.8%) | 23/24 (95.8%) | 90%                             |
| Retained memory   | 18/18 (100%)  | 18/18 (100%)  | 90%                             |

Both inferred and explicit views selected useful qualified evidence in **42/42** query coordinates.
Factual-view controls excluded qualified claims in **36/36** coordinates. All **6/6** retained sources
produced useful English knowledge and replayed after restart/rebuild. All **14/14** case runs preserved file
sets and bytes across index, rebuild/replay and subsequent reads. All **30/30** ordinary recalled evidence
lines and their frames matched the original bytes; all **82/82** published answers cited existing lines.

Useful coverage by source language is English **34/36**, Russian **24/24**, mixed **24/24**. By query
language it is English **27/28**, Russian **28/28**, mixed **27/28**. Requested English and Russian answers
each achieved **41/42**. Auto-recall activated in **0/42** coordinates under this structural-index profile;
this is not counted as useful automatic context coverage.

Two failures remain visible:

- `ordinary-english-report`, repetition 1, English query/Russian answer: `draft_rejected`, with one
  discourse-guard rejection. The rejected draft is unavailable for source review.
- `ordinary-empty-heading-fact`, repetition 2, mixed query/English answer: `generation_failed` with
  `language_mismatch`. The provider calls succeeded; no answer reached verification. The rejected text
  is unavailable for checking whether the language rejection itself was correct.

All **604/604** corpus provider requests returned HTTP success, with **1,280,555** reported total tokens,
including embeddings and cached input. These transport successes do not erase either output failure.

## Method and evidence

The frozen [plan](../../pr73-live-plan.md) declares seven cases, two fresh repetitions, three query languages
and two answer languages: 84 target answers. Ordinary authored Markdown and automatically retained memory
have separate coverage gates in each repetition. Null target answers remain coverage misses. The 36 factual-view
controls are a separate exclusion measure and never inflate useful-answer coverage.

- `manifest.json` records source, runner and built-package hashes, model settings, and prompt/projection versions.
- `cases.json` preserves the exact frozen corpus. `source-review.json` records source obligations and limitations.
- `*-run-*.json` preserves every case outcome, published answer, citation, qualification, typed degradation,
  retained knowledge, replay outcome, and source-preservation check.
- `network-receipts.jsonl` records every provider request's model, operation, HTTP status, token ceiling,
  latency and reported usage. It excludes credentials, connection endpoints and hidden generated drafts.
- `completion.json` is the untouched runner completion record. Its adjudication field remains pending because
  correctness was assessed afterward in the separate review artifacts.
- `integrity.json` checks that runner, corpus and built packages still match the pre-run manifest.
- `api-preflight.json` records successful generation and embedding access before corpus execution.
- `boundary-comparison.json` compares the original and corrected deterministic source/view boundaries with no
  provider calls. It is not a live-model baseline.

The provider profile uses `gpt-5.6-luna` via Responses, low reasoning, a configured 2,400-token ceiling,
60-second answer timeout, 120-second retention timeout and zero provider retries. Internal operations may
supply narrower ceilings; the receipts expose the actual values for every request. Embedding uses
`text-embedding-3-small` at 1,536 dimensions. Generation settings, the runner and corpus were not changed
between repetitions; no case was selectively retried. The runtime's ordinary bounded verification/repair
behavior remains enabled and its additional calls remain in the receipts.

## What this establishes and what it does not

The deterministic comparison changes three ordinary qualified passages from factual to the intended report
or discussion view. It also corrects five mixed-language query variants from planning to reports: 16/21
correct query-view selections before the fix, 21/21 after it. These are boundary checks on the same invented
inputs; they do not establish a like-for-like improvement in live answer rates.

The provider profile differs from the historical comparison, which used local embedding/expansion models,
a smaller answer ceiling and different retention timeout/reasoning settings. The earlier independent reviewer
model was inaccessible to the supplied credential. The implementing assistant reviewed this run against the
original sources; reviewer independence remains a limitation.

Structural indexing deliberately leaves `partial_index` and `no_vector_index` degradation. Expansion,
reranking, graph expansion, index summaries and index facts are disabled. Explicit qualified retrieval and
answers are measured, and auto-recall activation is reported separately. This run does not prove useful
semantic retrieval without lexical overlap or productive automatic context injection.

Rejected draft text is not exposed by the public answer operation. A null with `draft_rejected` is counted
as a coverage miss, but cannot be classified as a true or false guard rejection from the saved public result.
The retained read records also omit original support/frame spans, so this run does not independently verify
those spans' byte equality. It does verify readable retained meaning against the original invented input,
ordinary evidence text/frame bytes, and file-set/byte stability across index, restart/rebuild, replay and reads.

The empty-heading live fixture also indents the earlier hypothetical heading. The old scanner misses that
earlier heading, so the focused color line is factual in both versions. It confirms current useful ordinary
factual retrieval; the deterministic regression suite separately isolates the empty-heading boundary fix.

This measurement invokes freshly built operations in isolated knowledge bases. It is not evidence that an
existing configured service was redeployed. That checkout had no configured knowledge-base path; build-only
redeploy and a separate built Unix-socket startup/restart check were verified with invented data.

## Reproduction

Build the recorded revision, then use a fresh output directory:

```sh
pnpm build
node scripts/measure-language-reliability.mjs --prepare --output /tmp/akno-live-preparation
node scripts/measure-language-reliability.mjs --live --config /path/to/private-provider-config.json \
  --output /tmp/akno-live-measurement
```

The private provider configuration references an environment variable for authentication. Match the profile
in the manifest and review the public outputs against the frozen original sources before assigning usefulness
labels. A completed operation or a nonnull answer is not by itself a correctness label.
