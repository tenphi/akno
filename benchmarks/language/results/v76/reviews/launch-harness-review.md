# V76 exposed launch harness review — fixed recheck

## Disposition

The four findings in `tmp/language-v76-launch-harness-review-initial.md` are resolved in the current harness. Static harness review is clean. This is not semantic launch approval: final approval still requires the completed immutable readiness receipt and a separate preflight review.

## Fix verification

### Pre-start manifest integrity

`tmp/v76-launch-integrity.mjs` now has a no-write `--check` path. It recomputes the complete frozen source and dist tree digests and every listed execution-harness hash, then deep-compares them with `tmp/v76-launch-manifest.json`. Both `tmp/write-v76-readiness.mjs` and `tmp/start-v76-probes.mjs` invoke this check before readiness or the once-only start marker is written.

The final manifest now binds eleven files, including the readiness writer and new trace validator. I independently ran the no-write check; it returned verified at frozen SHA `44e6e714f1758948f306ec90cdae9b0d453e3604` with `providerCalls: 0`. The preserved mutation test demonstrates that one-byte drift in an ignored harness is rejected before the start marker and that the original bytes were restored.

### Original protocol failure and amendment accounting

The readiness writer now requires the original ten-control result to remain failed, with exactly nine exact successes and sole failure ID `four-branch-retention-repair`. That result must remain transport-ok and schema-valid but nonexact. Its declaration hash is checked and every original result remains bound to its original fixture, caps, audit status and completed transport.

The separate natural repair declaration binds the original declaration and result hashes. Readiness requires its distinct result to bind that declaration, pass exactly once, parse to the declared expected object, use one completed endpoint, and preserve the original failed fixture's schema, API, caller/role/effective caps, complete object shape and every string length. The seven amendment/design/outcome artifacts must exist and their hashes are persisted. Accounting is explicitly 11 logical calls, 10 fulfilled requirements and one preserved original failure.

The natural result is now present and passes these static conditions: one Responses endpoint, 3,200 caller / 2,400 effective cap, schema-valid and exact, with 482 output tokens. The original 9/10 receipt remains unchanged. Final readiness execution remains a separate prerequisite.

### Declared case-row identity

`tmp/validate-v76-evidence.mjs` now requires exact ordered equality between `r.cases.map(c => c.id)` and the declared matrix, unique `[id, run]` pairs, and exact aggregate observations equal to the start receipt's 64 or 32. It retains the exact top-level selected IDs, case count, one run and eight unique query-language/answer-language/view coordinates per case.

### Trace lifecycle integrity

`tmp/v76-trace-integrity.mjs` validates nonempty JSON objects, a closed trace-kind/field vocabulary, bounded error classes and schema keywords, safe positive IDs, globally unique lifecycle starts, one matching terminal event per model and transport start, one model decision record for every classified completed model call, transport result kind matching the language flag, and no details after terminal completion. Its output is stored in completed provenance.

The mutation receipt reports both prior invented V75 traces balanced (264/337 and 133/170 model/transport counts) and seven independently rejected mutations per trace. This establishes deterministic validator behavior, not V76 model quality.

## Remaining preflight prerequisites

- `tmp/v76-postdeploy-check.json` must be written once by the corrected readiness writer after exact CI and documentation success and all declared receipts are available.
- The independent semantic preflight must review that final readiness object, amendment hashes/accounting, frozen deployment and the unchanged exposed 64+32 matrix before creating `tmp/language-v76-preflight-review.md`.
- `tmp/start-v76-probes.mjs` must then rerun the no-write integrity check and confirm every output, trace and start marker is absent before creating the marker.

No fresh held-out corpus is selected or read by these scripts. The selected runner remains the exposed V21 development eight-case matrix and the built runner the exposed V20 development four-case matrix, each once at the unchanged 2,400 answer ceiling.

The initial findings and their exact failure modes remain preserved in `tmp/language-v76-launch-harness-review-initial.md`.
