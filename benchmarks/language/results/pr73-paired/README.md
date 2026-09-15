# PR 73: fixed-input scope and routing comparison

The evidence supports keeping the Markdown scope and query-routing fixes in PR 73. Against its actual
base, identical inputs receive more appropriate evidence, and Luna produces more useful answers in this
bounded downstream comparison. This does **not** establish overall end-to-end accuracy or satisfy the
historical language quality gate.

The baseline is `ce8fbe4ed0d529bec35dd154e8bbfec79eefb0eb`; the evaluated candidate is `f23c0da`.
Only `kb/prose.ts` and `memory/intent.ts` differ in production code. Retention, answer generation and
answer verification are unchanged. Both compiled trees and the complete changed-module inventory are
recorded in the [offline manifest](offline/manifest.json) and [live manifest](live/manifest.json).
No production code changed during either run or after these measurements.

## Deterministic behavior

Both revisions indexed identical bytes for all 44 public retained sets from the preceding full V23 run,
including incomplete and empty sets, plus four original ordinary Markdown fixtures. All 48 pairs finished.

| Measurement                                                |    Base |      PR |
| ---------------------------------------------------------- | ------: | ------: |
| Correct inferred views                                     |  66/100 | 100/100 |
| Correct explicit views                                     | 100/100 | 100/100 |
| Correct ordinary-prose projections                         |     1/6 |     6/6 |
| Incorrect factual projections                              |       5 |       0 |
| Answer operations supplied with eligible evidence          | 153/200 | 172/200 |
| Retained explicit-view evidence controls equal across arms |   88/88 |   88/88 |
| Input bytes preserved                                      |   48/48 |   48/48 |

All four ordinary fixtures also upgraded a real base-created index through the candidate's normal index
pass. Their stored projections matched a fresh candidate index, with unchanged source bytes. The fixed
matrix audit found no unintended loss of eligible evidence; removing hypothetical content from the factual
empty-heading control is intentional. The generic summarizer detects complete evidence loss, while the
independent audit additionally checks partial set differences in this matrix.

These are model-free measurements: **zero generated answers and zero network requests**. Auto-context is
inactive or degraded on many coordinates, so evidence availability is not presented as answer accuracy.
See the [complete summary](offline/summary.json), [completion receipt](offline/completion.json) and
[per-pair hash index](offline/results.json).

## Repeated Luna integration result

The frozen live subset contains 11 fixtures and two repetitions. Each revision executes inferred and
explicit views with English and Russian answers: **88 main answer operations per arm**, plus **22 factual
answer controls per arm**. All 22 pairs and all 220 answer operations completed. Independent source review
graded every public output, including nulls, in eight anonymous packets before inspecting arm mappings.

| Main-answer measurement                      |  Base |    PR |
| -------------------------------------------- | ----: | ----: |
| Source-useful answers                        | 43/88 | 68/88 |
| Fully grounded useful answers                | 38/88 | 68/88 |
| Published answers                            |    56 |    77 |
| Published answers with source-meaning errors |    12 |     8 |
| Published answers with qualification errors  |     8 |     1 |
| Null answers                                 |    32 |    11 |
| Language or citation errors                  |     0 |     0 |

**Source-useful** is the independent judgment against the original source. **Fully grounded useful** also
requires source entailment, preserved qualifications, the requested language, valid citations, and support
in the evidence actually supplied to the model. Five baseline answers were useful against the original
source but lacked that grounding; both measurements are shown to keep the distinction explicit. Error
categories overlap and must not be added together.

Source-useful answers improve from **21/44 to 34/44** in repetition one and **22/44 to 34/44** in repetition
two. There are 25 paired source-useful gains and no source-useful losses. The stricter grounded count rises
from 19/44 to 34/44 in each repetition, with 30 gains and no losses. These are observations on exposed
fixtures, not estimates of general accuracy or proof of noninferiority.

Eligible answer evidence rises from 64/88 to 80/88; nonempty auto-context rises from 30/44 to 40/44.
All 32 retained explicit-view answer-evidence controls remain identical. The candidate's 22 factual answer
controls comprise four useful factual answers and 18 justified exclusions, with no source or qualification
error. All input bytes remain unchanged.

The candidate still publishes **eight Russian component/word-sense errors** and **one qualification
omission**. Examples include changing the whole device into an indicator, a lid into a coating, or a generic
alignment gauge into a more specific instrument. The omission loses the contract-silence limit in an
open-renewal answer. **Three candidate source errors replace baseline nulls**: an alignment gauge becomes
a coaxiality gauge (`a1b4583034e8b69ba65f`) or a camber/toe gauge (`3b959957125ba112ccca`), and a lid becomes
a coating (`3032f628d3b6d3e2579e`). These are already included in the eight errors above. Additional published
answers therefore expose failures that a baseline null hid; the absence of useful-answer losses is not a
zero-error result. Eleven candidate nulls comprise eight
operations on an inherited empty retained artifact and three verification rejections. The empty artifact
explains those downstream misses, but its original source was answerable: they are not source-justified
abstentions and remain in the denominator.

The [independent aggregate](source-review-summary.json), [failure ledger](source-failure-ledger.json),
[raw review packets and grades](reviews), [primary inspection](primary-inspection.json),
[live summary](live/summary.json) and [per-pair hash index](live/results.json) preserve these distinctions.

## What the experiment holds fixed

The [predeclared plan](../../pr73-paired-plan.json) and [reproduction procedure](../../paired-comparison.md)
hold the public retained text, IDs, typed qualifications and temporal metadata fixed. The public archive
does not contain complete managed markers: reconstructed fixtures use declared marker receipts and empty
links, reporters and evidence metadata. Original sources and support references remain separately available
to reviewers. This tests downstream behavior on identical reconstructed inputs; it does not reproduce
retention, original provenance-backed verification, replay, or source-archive lineage.

Live answers and verification use `gpt-5.6-luna`, low reasoning, a 2,400-token response cap, 60-second timeout
and no provider retries. Reranking uses Luna at low reasoning, a 1,600-token cap, 30-second timeout, top eight
results and 2,400 characters per result. Embeddings use `text-embedding-3-small` with 1,536 dimensions.
Knowledge language is English; derivation, expansion, graph retrieval and index summaries/facts are disabled.
There is no stronger runtime model or new semantic loop.

Case/repetition/stage/provider identity and exact request bytes determine whether opposite arms share a
provider response. Each arm still executes its own parsing, guards and verifier. Same-arm repeated calls
remain physical calls, and repetitions never share responses. Different requests sample independently;
matching requests deliberately do not. Arm order alternates, with at most two independent pairs running
concurrently. This coupling limits random variation when requests are unchanged, but is not independent
end-to-end replication.

The [network ledger](live/network-receipts.jsonl) records 1,354 logical requests, 844 physical requests and
510 coupled responses. Every physical response was HTTP 200. Known physical usage is 1,524,265 Luna tokens
and 11,945 embedding tokens; usage is charged once per physical response. No currency cost is inferred.
Credentials, endpoints, headers and private provider reasoning are excluded from the publication.

## Comparison with historical percentages

The preceding [full Luna evaluation](../pr73-luna-final/README.md) remains **233/320 useful answers** with a
failed quality gate. It includes fresh retention and a larger repeated source matrix. Earlier percentages
also used different corpora, profiles, scoring or execution boundaries. None is interchangeable with 68/88
here. This comparison isolates the PR's scope/routing benefit; it does not show that the full score increased
or that a cheap model has reached its intelligence limit.

Issues [61](https://github.com/tenphi/akno/issues/61) and [62](https://github.com/tenphi/akno/issues/62)
remain closed as bounded implementations, not as certification that all their quality requirements are met.
The unresolved semantic reliability work remains tracked in
[issue 66](https://github.com/tenphi/akno/issues/66).

## Validation and audit

Typecheck, build, lint, knip, formatting, repository safety, **4,071 tests across 155 files**, and **34 smoke
checks** pass. The [built CLI check](built-check/built-check.json) passes 35 assertions across socket start
and restart, and the [built view matrix](built-check/view-matrix.json) confirms the updated routing.
`pnpm akno redeploy --no-restart` rebuilt the packages; the socket check used an isolated invented knowledge
base. No pre-existing live service was restarted.

The [independent freeze review](freeze-review.json) precedes execution. The
[final independent audit](final-audit.json), [publication audit](publication-audit.json),
[validation receipt](validation.json) and [artifact manifest](artifact-manifest.json) bind the published
evidence. Prior PR archives remain byte-identical. A post-run lint-only variable rename in the summarizer
produces [byte-identical summaries](summarizer-validation.json); its original reviewed version and the
one-off review/audit helpers are preserved under [reviewed-runtime](reviewed-runtime).
