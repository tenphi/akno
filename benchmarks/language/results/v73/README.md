# V73 validation evidence

Frozen runtime **1eb002b84c05927b1ac1c5f69e974908de36c224** implements the [declared plan](../../v73-trial-plan.md) after the [V72 evidence](../v72/README.md). It adds a narrowly eligible report text repair that preserves metadata and source proof, a bounded original-clock recognition branch, and separate typed-label definitions for retention comparison. Versions are retention extraction v52 and verifier v36; answer generation v66 and verifier v46 are unchanged.

The exposed 64+32 probes completed once. Independent source-only grading and forensic review, with the preserved fiction adjudication, find:

| Probe | Complete useful retention | Useful retrieval | Semantically useful answers | Useful answers also meeting language policy |
| --- | ---: | ---: | ---: | ---: |
| Selected source-build | 7/8 | 56/64 | 51/64 | 50/64 |
| Built-package | 3/4 | 24/32 | 24/32 | 24/32 |
| Combined | 10/12 | 80/96 | 75/96 | 74/96 |

All 75 produced answers are source-entailed and qualified. One Russian fiction answer retains the ordinary English component term `hinge-pin`, violating requested language. Twenty-one coordinates return null. There are no case availability failures or source-byte changes. All surviving retained records are faithful; two source sets are incomplete. Empty sets and absent answers are completeness failures, not accepted unsupported claims.

**The fresh repeated trial remains deferred.** The accepted language error independently fails the zero-error gate, and missing answers leave further reliability work. Approved V21 held-out inputs remain unexecuted. See the [decision](full-trial-decision.json), [independent summary](output-summary.json), and [provenance checks](completed-probe-provenance.json). These exposed observations do not replace the last failed full trial or establish causal improvement between revisions.

## What the traces establish

The new report text repair is exercised successfully in the selected probe: three model-written sentences preserve the nested report, operation/property, personal limits, metadata and source proof, with the independent delivery denial unchanged. Both records survive verification. The built rejected-action and competing-alternatives sets are complete in this run; this does not establish a causal effect of the revision.

The built report is lost after faithful extraction reaches verification. The verifier inserts `報告` into its own private paraphrase, then rejects the immutable candidate for supposedly containing that token. The token occurs in neither candidate nor source. This false hold accounts for eight null answers and motivates the [exact-witness design review](verifier-evidence-second-design-review.md).

The repaired undated proposal reaches semantic verification but is held for omitting an explicit “not after processing” clause. Independent reviewers disagree about whether naming the original record already preserves that exclusion. Both judgments remain in the [selected forensic review](selected-forensic-review.md) and [clock design review](clock-design-review.md). The next design preserves the source's explicit contrast without relaxing verification; this disagreement changes neither observed empty retention nor the failed gate.

The other five nulls include two source-faithful Russian counterfactual drafts falsely held by the discourse recognizer. The other three are correctly held: a transliterated protected name, reversed coverage roles, and an untranslated fiction term. The [draft-boundary review](draft-boundary-design-review.md) records the exact distinctions. Seventeen private property-absence classifications are wrong on accepted, source-faithful answers: ten selected and seven built. These are private audit errors, not seventeen published property errors.

## Independent review and corrections

A fresh Sol grader read source/output packets without runtime code, verdicts, traces or earlier selected grades. Separate Sol forensic review read source material first. Initial and final JSON grades are preserved. The built review corrects eight downstream nulls from justified to unjustified abstentions because the original source contains an answer; the original grade and Markdown are retained. The [fiction adjudication](fiction-adjudication.md) permits a focused promise answer to omit the separate proposal act. It distinguishes semantic usefulness from language compliance: a source-faithful untranslated answer still fails the independent zero-language gate. Initial and corrected selected grades and forensic metric labels remain preserved. Raw model traces and execution logs remain local; their preserved bytes are identified by [the artifact manifest](local-artifact-manifest.json).

The [rendering analysis correction](rendering-analysis-correction.json) concerns an inherited trace-analysis assumption: the new report language hook has repair prose rather than answer blocks. The failed script/output and corrected analysis remain preserved; no trace, runtime or model call was repeated.

## Validation and protocol history

Two independent Sol code reviews are clean. Local gates passed with **3,488 tests in 147 files**, typecheck/build, lint, knip, formatting, repository safety, documentation doctor/build, smoke and installed-package smoke. The code was frozen, pushed, built and redeployed through service restart and socket readiness. Eighteen compiled control groups, exact-revision CI and documentation CI, and independent preflight passed.

Protocol accounting follows the reviewed [amendment](protocol-validation-amendment.md). Eight logical actual-provider controls are preserved: five exact passes fulfill the amended plan; two simpler alignment controls were invoked accidentally and remain passing extras; the original repetitive repair echo failed exactness by dropping one identical filler sentence. A separately declared distinct-sentence fixture at the same 200/78/120 normalized UTF-16 limits passed once with the same mixed schema and caps. The original failure remains failed. The extra pair did not save raw responses or usage; those fields remain unavailable. See [readiness](postdeploy-check.json) and [budget/accounting](protocol-budget.json).

Protocol echoes establish observed transport behavior only. They do not prove model competence, arbitrary exact copying or universal budget sufficiency. Initial local test, schema, assertion and lint failures remain preserved with their corrections.

Acceptance remains at least 90% independently useful writable answers in each full split/run, at least 80% useful retention/retrieval, zero accepted source/qualification/language/promotion/source-byte errors, and at most 5% case availability failures. Runtime remains Luna, with independent Sol review. The isolated ceiling remains 2,400 tokens; the service's existing 1,024-token overlay is unchanged and outside this evidence. No semantic retry, replacement run, extra model pass, cap increase or weaker gate was used. PR #70 remains open and unmerged.
