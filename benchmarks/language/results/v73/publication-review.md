# V73 publication and evidence review

## Disposition

**Publication content approved.** I found no remaining metric, semantic-history, protocol-accounting, source-byte, frozen-runtime, or fresh-held-out blocker after the corrections recorded below.

One mechanical condition remains before commit: regenerate `benchmarks/language/results/v73/local-artifact-manifest.json` after this review and the final copied corrections. The current manifest still contains the pre-clarification hashes for three locally revised files. Committing that stale manifest would be a blocker; a deterministic refresh and zero-mismatch validation closes it without another semantic review.

This was read-only review of the evidence and publication text. I made no provider call, runtime change, benchmark run, issue/PR mutation, or merge.

## Frozen evidence and arithmetic

The workspace remains at frozen runtime `1eb002b84c05927b1ac1c5f69e974908de36c224`. The completed-probe provenance hashes and row counts match the raw local evidence:

| Probe | Raw report hash | Raw trace hash | Trace rows | Result |
| --- | --- | --- | ---: | --- |
| Selected | `9547ff19…` | `819a797b…` | 246 | exact |
| Built | `e9e1ae8c…` | `e5847c25…` | 115 | exact |

The copied `selected-diagnostic.json` and `built-reliability.json` are byte-identical to those completed raw reports. Both copied source-only packets are byte-identical to their local originals. `output-summary.json` is byte-identical to `tmp/v73-output-summary.json`.

I independently recomputed the final source-only review totals:

| Measure | Selected | Built | Combined |
| --- | ---: | ---: | ---: |
| Complete useful retained sets | 7/8 | 3/4 | **10/12** |
| Useful retrieval observations | 56/64 | 24/32 | **80/96** |
| Semantically useful qualified answers | 51/64 | 24/32 | **75/96** |
| Fully language-compliant useful answers | 50/64 | 24/32 | **74/96** |
| Null answers | 13 | 8 | **21** |
| Accepted language errors | 1 | 0 | **1** |
| Accepted source/qualification/promotion errors | 0 | 0 | **0** |
| Case availability failures | 0/8 | 0/4 | **0/12** |
| Source-byte changes | 0/8 | 0/4 | **0/12** |

All 75 non-null answers have `sourceEntailed:true` and `qualificationPreserved:true`. The one Russian fiction answer with untranslated ordinary `hinge-pin` remains semantically useful and qualified but has `languageCompliant:false`; it therefore counts in 75 semantic answers and not in 74 fully compliant answers. This preserves the zero-language-error gate failure rather than redefining semantic usefulness.

The selected probe's one `answerOperationFailures` observation is the separately documented language-policy generation failure. It is not a case availability failure. The PR draft now says “no **case** availability failures,” matching the gate and raw report rather than implying zero answer-operation failures.

## Empty and incomplete retention semantics

The two incomplete source sets are represented consistently:

- Selected `v20-held-undated` has an empty retained set and eight downstream nulls. Vacuous absence of an unsupported retained claim is not useful or qualification-complete retention.
- Built `v19-held-report` retains only a faithful independent no-collection denial and loses the useful nested report. The eight nulls are safe relative to that incomplete retrieval because they avoid invention, but the original source answers the query, so all eight are unjustified abstentions under source-only writable-case grading.

During this review, final `built-output-review.json` initially had `justifiedAbstention:false` while each reason still said the abstention was justified. The initial and pre-clarification artifacts are preserved. The final JSON and Markdown now distinguish safe behavior from incomplete retrieval from unjustified original-source coverage, and `correctionReceipt.fieldsChanged` lists both the eight booleans and eight reasons. No score changed.

The final source-only correction history is otherwise narrow and traceable:

- selected initial to final changes only the inferred EN→EN fiction answer's semantic usefulness, qualification field and reason, plus its correction receipt;
- built initial to final changes the eight report-null abstention fields and clarified reasons, plus its correction receipt;
- the initial built Markdown reconstruction receipt says exactly how the original text was recovered rather than presenting it as newly inferred.

## Disputed and corrected interpretations

The publication does not manufacture agreement over the selected clock hold. `selected-forensic-review.md` treats the positive original-record anchor as preserving the boundary and calls the hold false. `clock-design-review.md` treats the explicit `а не после обработки` contrast as separately material and calls the hold sound. README and PR text call the issue disputed, preserve both reviews, and choose the conservative next action of retaining the explicit contrast without relaxing verification. The observed empty set, eight nulls, and failed gate do not depend on deciding that disagreement.

The fiction adjudication is also represented without hiding its initial history. It permits a focused answer to state the complete fictional promise without repeating the separate proposal act already supplied by the question. It separately keeps the untranslated ordinary component as an accepted language error. This is why semantic useful coverage is 51/64 selected while fully compliant useful coverage is 50/64.

The rendering-analysis correction accurately identifies the original failed analysis assumption: an `additionalLanguageProse` observation may be the new report-repair materialization rather than an answer block. It preserves the failed script/output, records that stderr was not redirected to the empty stdout log, and states that no trace, runtime, or provider call was repeated.

## Protocol accounting

The eight logical actual-provider controls reconcile across `protocol-budget.json`, `postdeploy-check.json`, the amendment, and the individual receipts:

1. two intended rendering controls passed exactly and fulfill the amended plan;
2. the structured-clock control passed exactly and fulfills it;
3. the retention control passed its declared strict response and fulfills it;
4. the separately declared distinct-sentence mixed repair control passed exactly and fulfills it;
5. two accidentally invoked simpler alignment controls passed but remain unplanned extras;
6. the original repetitive mixed-repair echo remains a failure because it omitted one repeated filler sentence.

That is five amended-plan passes, two passing extras, and one preserved original failure. The amendment was written and independently reviewed before the replacement distinct-sentence control and before corpus execution. It did not retry or relabel the failed fixture. The replacement retained the same frozen runtime, mixed schema, `200/78/120` normalized UTF-16 maxima, 400-unit joined text, 3,200 caller cap, 2,400 effective role cap, strict schema, and exact-equality criterion while replacing only confounded repetitive filler with distinct invented sentences.

The extra alignment pair's wrapper did not retain raw responses, usage, caller caps, effective initial limits, or JSON lengths. All are `null`/unavailable in the budget receipt and the publication does not infer them. Protocol echoes are described only as observed transport checks, not model competence, universal copying, semantic reliability, or universal budget sufficiency. `extraSemanticPasses` remains zero.

## Validation, portability, and deferral

The preserved readiness evidence reports 3,488 tests in 147 files, all local gates, eighteen compiled groups, redeploy/build/restart/socket readiness, exact-revision CI `34398656057`, documentation CI `34398656056`, and independent preflight. The isolated evaluation ceilings are answer 2,400 and retention 2,400; the separately captured live service answer configuration remains 1,024 and is explicitly outside this evidence.

The only broken relative link found initially was in copied `clock-design-review.md`, which linked to the ignored local raw trace. It now names that trace as a plain path and links to the artifact manifest. A full relative-link scan now finds no missing or untracked target outside the pending V73 evidence tree. README also explicitly states that raw traces and execution logs remain local and are identified by the manifest, matching prior evidence publications.

Only the selected V21-development and built V20-development exposed probes were executed. `probes-started.json`, completed provenance, the decision, and readiness receipt all state `freshHeldOutExecuted:false`; the only V73 held-out artifact found is an unexecuted runner script. The full repeated V21 trial is truthfully deferred because the accepted language error already violates the unchanged zero-error gate and 21 nulls/two incomplete retained sets leave material coverage work. The publication does not claim stochastic causal improvement or supersede the failed V65 full trial.

The PR draft retains the unchanged thresholds, Luna runtime, Sol independent review, no model switch, no semantic retry, no replacement run, no extra semantic pass, no weaker gate, and open/unmerged status. I did not independently mutate or query remote GitHub state in this review.

## Findings and closure

1. **Portability — resolved.** `clock-design-review.md` linked to an ignored local trace. It now uses a plain path and a manifest link; the original local review remains unchanged.
2. **Null-grade explanation — resolved.** Final built JSON reasons contradicted `justifiedAbstention:false`. Corrected final reasons and receipt now distinguish safe noninvention from unjustified writable coverage, with before-correction evidence preserved.
3. **Local-trace disclosure — resolved.** README now says raw traces/logs remain local and links the manifest.
4. **Availability terminology — resolved.** PR draft now says zero case availability failures, preserving the separate answer-operation failure.
5. **Artifact manifest — pending mechanical refresh.** At review close, the existing 198-entry manifest has three expected stale hashes following the above publication corrections: `tmp/language-built-output-review-v73.json`, `tmp/language-v73-built-source-review.md`, and `tmp/v73-readme-final-draft.md`. Regenerate the manifest after copying this review and any closure receipts, then require every listed path to exist and every byte length/SHA-256 to match. Preserve the existing prefreeze manifest and before-correction artifacts.

Subject to item 5's deterministic refresh, I approve the V73 evidence-only commit and PR-body update. I do not approve runtime changes, a fresh held-out run, issue mutation, or merge as part of this review.
