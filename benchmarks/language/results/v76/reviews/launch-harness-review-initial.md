# V76 exposed launch harness review — initial

## Status

**Hold.** This is a static harness review, not semantic preflight approval. The frozen runtime is `44e6e714f1758948f306ec90cdae9b0d453e3604`; no corpus probe has started. The current protocol receipt is also intentionally incomplete at 9/10 exact, so `tmp/v76-postdeploy-check.json` must not yet exist.

## Findings

### P1 — readiness does not prove the launch manifest is current before consuming the once-only start marker

`tmp/write-v76-readiness.mjs` reads `tmp/v76-launch-manifest.json` and checks only its `runtimeCommit`. `tmp/start-v76-probes.mjs` likewise checks the readiness commit but does not recompute the manifest. The complete source/dist/file-hash comparison occurs for the first time in `tmp/v76-launch-integrity.mjs` from inside each runner, after `tmp/start-v76-probes.mjs` has already written the irreversible `tmp/v76-probes-started.json` marker.

All harness files live under ignored `tmp/`, so changing a capture hook, runner or validator after `--prepare` leaves Git clean. Concrete reproduction:

1. prepare `tmp/v76-launch-manifest.json`;
2. change one byte in `tmp/capture-language-models-v76.mjs` or `tmp/validate-v76-evidence.mjs`;
3. finish otherwise valid CI/protocol receipts and run the current readiness writer;
4. readiness can succeed and the start script can create `tmp/v76-probes-started.json`;
5. the selected runner then fails its manifest deep-equality check before the benchmark, while overwrite guards prevent a replacement launch.

This fails closed with respect to provider calls, but it can consume the declared once-only launch before either corpus executes. Add a no-write manifest verification mode and require it in readiness/start, or have the readiness writer independently recompute the full source tree, dist tree and every listed harness hash and deep-compare them with the manifest. Runner checks and unique launch receipts should remain.

### P1 — the current readiness contract cannot preserve the known protocol failure plus a separate amendment

`tmp/write-v76-readiness.mjs` currently requires `protocol.passed`, ten results, and every original result to be exact. The actual once-only V76 receipt is 9/10 exact: `four-branch-retention-repair` had valid transport/schema output but shortened a 220-unit repeated-letter marker to 194. If a separately declared natural repair control is approved and run, readiness must preserve the original receipt and require exactly the declared nine original successes plus the separately identified amendment success. It must not relabel the original ten-control receipt as passed or replace the failed result.

The final accounting should bind the original receipt bytes/hash, the sole failed fixture ID and failure predicates, the independently reviewed amendment declaration/runner/result, exact caps/schema/field lengths, and total logical-call/endpoint counts. This is already being diagnosed separately; no amendment call should precede that review.

### P2 — evidence validation does not bind the actual case rows to the declared matrix

In `tmp/validate-v76-evidence.mjs`, the top-level `selectedCaseIds` is compared with `matrix.cases`, and only `r.cases.length` is compared with the declared count. The validator never compares `r.cases.map(c => c.id)` with `matrix.cases`, nor does it assert the declared `matrix.observations`.

A malformed or accidentally rewritten report containing a duplicate case row or a wrong case row can pass if it retains the expected top-level `selectedCaseIds`, the same number of cases, and eight query coordinates per case. The report hash would then faithfully identify an artifact that the provenance receipt incorrectly describes as the declared 64/32 matrix.

Require exact ordered equality of the case-row IDs and the declared IDs, unique `[id, run]` pairs, and exact observation count equal to `matrix.observations` (64 or 32). The existing eight-coordinate uniqueness check per case remains useful.

### P2 — trace lifecycle integrity is not validated

The capture hooks correctly add `model-call-start`/`model-call-finish|throw` and `transport-start`/`transport-result|language-check|transport-throw`. The final validator only parses every JSONL line and records `traceRows`. It does not require each start to have one terminal event, reject duplicate terminal events, validate IDs/allowed terminal kinds, or detect a trace truncated before the report was written.

This does not alter the report result, but it can make the preserved trace insufficient to localize schema, transport, language and semantic holds while still producing a successful provenance receipt. Validate balanced lifecycle pairs by `call_id` and `transport_id`, one terminal per start, no terminal without a start, and only the bounded `errorClass`/schema diagnostic fields. This remains an evidence check and need not infer semantic success from a completed call.

## Checks that are sound

- The selected runner hardcodes V21 development's eight already exposed V20 case IDs and one run; the built runner hardcodes V20 development's four already exposed V19 case IDs and one run. Neither command selects V21 held-out.
- Both runners explicitly request the existing 2,400 answer ceiling and use distinct output/trace paths guarded against overwrite.
- The selected path imports source and the built path imports dist. `v76-launch-integrity.mjs` compares complete source and dist tree digests with frozen `tmp/core-v76` and hashes every execution/capture/validation harness named in its manifest.
- The benchmark runs in new temporary knowledge-base and state directories, writes only invented corpus material there, closes each instance, checks synthetic source bytes, and deletes those temporary directories. Configured provider credentials are remapped to temporary environment variables; neither capture hook records headers or credentials.
- Capture hooks store model inputs/outputs needed for forensics, but reduce provider failures to a closed error class and schema-keyword list rather than logging raw provider errors.
- Runner launch receipts are unique, strict-keyed by the final validator, and bind runtime commit, source/dist digests, harness file hashes, mode and parseable start time.
- `tmp/v76-postdeploy-check.json` is non-overwriting and is correctly blocked until exact CI/docs, local, compiled and final protocol requirements exist.

## Required next review

After the manifest, case-row, lifecycle and protocol-amendment accounting fixes are applied, recheck their actual artifacts and the completed `tmp/v76-postdeploy-check.json`. Semantic launch approval remains separate and must continue to state that protocol echoes verify transport/schema behavior rather than model meaning quality.
