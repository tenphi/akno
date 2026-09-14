# V66 publication evidence review

## Disposition

Clean for publication. I found no count mismatch, provenance overclaim, hidden acceptance claim, or private local path in the new tracked artifacts. The README, final trial decision, mechanism adjudication, preserved initial/final receipts, source-first reviews, artifact manifest, and proposed PR body consistently disclose the failed diagnostic and the interpretation difference.

## Count reconciliation

The published totals reconcile exactly:

- selected: 36/64 independently useful answers, 6/8 complete retained sets, 48/64 useful retrieval observations;
- built: 23/32 independently useful answers, 3/4 complete retained sets, 24/32 useful retrieval observations;
- aggregate: 59/96 useful answers, 9/12 complete retained sets, and 72/96 useful retrieval observations (36/48 unique query/view combinations);
- raw production: 38 selected plus 23 built = 61 published answers, leaving 35/96 nulls;
- availability: zero case-level failures; the selected report's two answer-operation failures are language-policy holds, with no built answer-operation failure.

These values agree across `README.md`, `full-trial-decision.json`, the selected/built reports and reviews, and `tmp/pr70-v66-final-body.md`. The decision to defer the full V21 trial is stated consistently, and fresh V21 held-out inputs remain recorded as unexecuted.

## Interpretation disclosure

The connector-continuity disagreement is preserved accurately rather than collapsed into a false consensus:

- the corrected source-only grade treats `проверка целостности разъёма` as a broader source-entailed category, keeps language and discourse qualification valid, and marks q1/q5 not useful because the requested electrical-continuity mechanism is lost;
- the source-first forensic labels the same two published answers source errors because it treats the missing mechanism as a source-meaning failure;
- `mechanism-adjudication.md`, `full-trial-decision.json`, and the README state both interpretations and agree on the material usefulness loss.

The wording `accepted material mechanism generalizations` in the final decision is compatible with the adopted grade and is immediately qualified by its `interpretation` field. The README and PR body do not claim zero semantic defects merely because the adopted receipt keeps `sourceEntailed:true`. Both initial and corrected judgments and both forensic versions remain present.

## Evidence/provenance boundaries

All readiness and protocol claims remain bounded to frozen runtime `13a7569f54634627c0eae91eb8f55d159c064176`. The publication calls the four provider controls schema/transport evidence and explicitly says they do not establish semantic competence. It distinguishes the exposed diagnostic from V65 rather than presenting unlike probe matrices as a causal score comparison.

`local-artifact-manifest.json` contains 62 relative workspace paths with byte lengths and SHA-256 hashes; every listed artifact is marked present. It identifies local traces/logs without embedding absolute home paths, configuration paths, credentials, endpoints, or knowledge-base locations. A scan of the new V66 evidence and PR body found no `/Users/...`, `akno_path`, `state_dir`, bearer token, API-key, or key-shaped value.

The README accurately reports the initial Chat fixture/schema-rung mistakes as test-only corrections without implying a runtime workaround. It records the final 2,859/144 suite and all other local/CI checks while preserving the initial ranking timeout and isolated follow-up. It does not treat deterministic controls, private verifier summaries, or runtime positive booleans as source authority.

## PR body

The proposed PR update accurately presents V66 as a failed diagnostic: 59/96 useful answers, 9/12 retention, 72/96 retrieval, 35 nulls, two language-policy operation holds, zero case availability failures, and two disputed-but-material mechanism generalizations. It keeps the full V21 trial deferred, states that no unchanged-runtime replacement is allowed, and preserves the unchanged acceptance gates and lower production-overlay limitation.

No publication correction is required from this review.
