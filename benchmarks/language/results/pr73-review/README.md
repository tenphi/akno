# PR 73 review and fix rounds

Production commit `558954d` fixes regressions found during independent review of PR 73. The final bounded
code review has no remaining findings after four fix rounds and a fifth review: **463 independent
assertions**, **4,121 tests across 156 files**, **34 smoke checks**, an installed-package smoke, and
**61 built CLI/client socket assertions across two service starts** pass.

The current offline comparison completes **48/48 pairs** against actual PR base `ce8fbe4`. All complete
baseline and candidate arm observations are deeply equal to the earlier offline run, with no fields
excluded. This covers reads, projections, query routing, recall evidence, answer inputs and null outcomes,
factual controls, safety flags and byte preservation. Projection-upgrade metadata changes from `prose-v3`
to `prose-v4` and is checked separately against the recorded runtime version.

## Fixes and review evidence

- [Round 1](reviews/round-1.json): list-contained headings could close the document's hypothetical scope;
  four routing cases confused machine errors, incidental assistant speculation, conditional rejection
  and an English document-title token with the requested evidence view.
- [Round 2](reviews/round-2.json): preserve backward qualifications after list paragraphs; follow Markdown
  block boundaries for lazy continuation; reject incomplete factual/read observations; bind upgrade checks
  to the manifest's projection version; handle whitespace consistently in device-error queries.
- [Round 3](reviews/round-3.json): isolate heading-looking text inside list code/comments, preserve unchecked
  task meaning and recognize managed/source markers only in original authored bytes.
- [Round 4](reviews/round-4.json): keep a recomputed frame-limit result unresolved instead of allowing a
  child qualification to overwrite its status.
- [Final code review](reviews/final-code-review.json): all prior blockers and nearby controls pass, with
  exact source hashes. These are independent agent judgments, not a proof that all semantic cases work.
  The [portable probe](reviews/reproduce-code-review.mjs.txt), [result](reviews/code-review-probes.json)
  and [portability receipt](reviews/portable-probe-receipt.json) reproduce its 463 assertions.

List boundaries now use the CommonMark parser `mdast-util-from-markdown`, declared as a pinned core runtime
dependency. Original line numbers, text and frame hashes remain bound to authored bytes. Excessive context
and recursion remain unresolved. `prose-v4` triggers rebuilding derived projections through ordinary
indexing; an operation regression checks repair of a stale `prose-v3` index and unchanged source bytes and
mtime. Routing is versioned as `memory-view-v12`. No model calls are added.

The parent also found that an empty result index could retain a successful completion receipt and be
summarized as a passing experiment. The runner and summarizer now fail on incomplete or failed execution
and missing, duplicate or altered expected observations. Regression tests exercise these failures. Both
historical offline/live summaries still reproduce byte-for-byte through the hardened validator.

## Current deterministic comparison

| Measurement                                       | Actual base | Reviewed code |
| ------------------------------------------------- | ----------: | ------------: |
| Correct inferred views                            |      66/100 |       100/100 |
| Correct explicit views                            |     100/100 |       100/100 |
| Answer operations supplied with eligible evidence |     153/200 |       172/200 |
| Correct ordinary projections                      |         1/6 |           6/6 |
| Incorrect factual projections                     |           5 |             0 |
| Byte-preserving pairs                             |       48/48 |         48/48 |

All **88 retained explicit-view evidence controls** remain identical between arms. All **four ordinary
fixtures** upgrade a base-created index to the fresh candidate's result. The review regressions have
dedicated unit, operation and built-service checks; they are not added to the frozen 48-fixture denominator.

- [Full offline summary](offline/summary.json), [completion](offline/completion.json),
  [runtime manifest](offline/manifest.json) and [per-pair result index](offline/results.json).
- [Exact comparison with previous offline observations](previous-offline-equality.json).
- [Historical summary compatibility](legacy-summary-check.json).
- [Validation receipt](validation.json), [built service receipt](built-check/built-check.json) and
  [query-view matrix](built-check/view-matrix.json). The [built-check helper](built-check/reproduce.mjs.txt)
  uses only an isolated invented knowledge base. It builds through `redeploy --no-restart`, then starts and
  restarts the built service. No pre-existing live service was restarted.

Use the [paired comparison procedure](../../paired-comparison.md) to rerun the current sources against the
declared base in a new output directory. Each checkout needs its own dependencies and built runtime.

## Measurement limits

**No live generation was rerun after these review fixes.** The earlier paired Luna scores—43/88 to 68/88
source-useful answers and 38/88 to 68/88 fully grounded useful answers—belong to frozen runtime `f23c0da`,
not the current `558954d` runtime. The [earlier paired report](../pr73-paired/README.md) and its outputs are
unchanged. Exact offline equality establishes the recorded deterministic behavior on those exposed inputs;
it does not turn historical generated-answer grades into a new live measurement.

The full **233/320 Luna result and failed quality gate** also remain unchanged. No stronger runtime model,
new retention trial or general accuracy claim is introduced. Unresolved semantic reliability remains
tracked by issue #66. These review rounds support the bounded scope and routing change in PR 73.
