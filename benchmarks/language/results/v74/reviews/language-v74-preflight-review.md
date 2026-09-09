# V74 exposed-probe preflight review

## Disposition

**HOLD. Do not start either semantic corpus probe.** The declared once-only protocol suite completed at frozen runtime `1f7309bc851690af3132cc00f0c7272347c7b2de`, but its receipt is `passed:false`: 7 of 10 controls passed and all three retention-path controls returned `request_failed` with no output or usage. `tmp/v74-postdeploy-check.json` does not exist, so the launch condition required by `tmp/start-v74-probes.mjs` is also unsatisfied. This is a transport/schema preflight failure, not evidence about retention semantics or model competence.

No V74 selected or built corpus marker, report, or trace existed at review time. The V21 held-out split was not read or executed in this review.

## Findings

### P0 — all newly changed retention schemas failed the declared provider protocol

The exact receipt in `tmp/v74-protocol-results.json` records:

- `positive-retention-verifier`: `request_failed`, `ok:false`, `schemaValid:false`, `value:null`, `usage:null`;
- `maximum-frame-negative-retention-verifier`: the same outcome;
- `four-branch-retention-repair`: the same outcome.

The rendering copy, two-record answer verifier, structured clock translation, and four maximum language-audit controls all returned exact schema-valid echoes. The failed controls each recorded one endpoint request, so they were attempted once and were not retried. The runner did not retain a redacted provider error, so the original provider rejection text and definitive failure reason are unavailable. An amended diagnostic must preserve this uncertainty and must not replace or relabel the failed controls.

Offline schema comparison isolates one strong hypothesis. Every failed schema, and none of the seven passing schemas, emits JSON Schema `pattern` values containing Unicode property escapes:

- each retention-verifier schema contains ten occurrences of `pattern: "[\\p{L}\\p{N}]"` from `retention-negative-evidence.ts`;
- the mixed repair schema contains seven clock-field patterns beginning `^(?=[\\s\\S]*[\\p{L}\\p{N}])...` in addition to three inherited report-field patterns without Unicode property escapes.

This common new construct is the narrowest offline explanation for the transport rejection, but the missing provider error means it remains a hypothesis. Schema size and `anyOf` alone are weaker explanations: the passing two-record answer verifier is larger and has more `anyOf` occurrences.

The smallest coherent correction is to keep the Unicode letter/number requirement as an atomic server-side validation while removing Unicode-property escapes from provider-visible JSON Schema. A local Zod refinement can preserve punctuation-only rejection without emitting `pattern`; the negative-evidence path already repeats the content test in `consistent()`. The clock transaction needs an equivalent all-field post-parse/refinement check while retaining the existing plain closure pattern, lengths, transaction atomicity, and no-retry behavior. This requires a separately frozen revision and newly declared protocol control; the failed V74 suite must remain preserved.

### P1 — readiness provenance initially omitted a changed runtime bundle; corrected while review was open

The initial `tmp/write-v74-readiness.mjs` snapshot hash list covered `models/client.js` and `models/language-audit.js` but omitted changed `models/language.js`, which contains the new language-check system contract and instruction behavior. All inspected current dist files, including `models/language.js`, byte-match `tmp/core-v74/dist`, but the initial writer would not have proved that file at readiness time.

Root preserved the old writer and added `models/language.js` to the readiness hash list. This resolves the identified file-set gap for a future readiness receipt. No readiness receipt has been created because the protocol is failed.

### P1 — the individual corpus runners do not independently recheck the frozen revision

`tmp/start-v74-probes.mjs` checks clean `HEAD`, the readiness runtime, absent outputs, and the frozen 64+32 case declaration before writing the start marker. The two shell runners later check only that the marker exists and their own output paths are absent. They do not compare current `HEAD` with the marker, require a clean tracked tree, or recheck the snapshot hashes immediately before importing current source/dist.

In the declared workflow the commands are intended to run together on a frozen tree, but that relationship is procedural rather than enforced. A change between marker creation and either runner can therefore produce an output whose final validator still attributes it to the marker SHA. The source runner imports `packages/core/src`; the built runner imports `packages/core/dist`, so both are sensitive to that interval.

Before a later semantic launch, each runner should fail before its first model call unless current `HEAD` equals `v74-probes-started.runtimeCommit`, the tracked tree is clean, and the relevant source/dist snapshot still matches. This is a runner-provenance guard; it does not require a runtime or corpus change.

## Other reviewed controls

- The runner arguments themselves are the declared exposed development matrices: V21 development has eight `v20-held-*` cases and 64 observations; V20 development has four `v19-held-*` cases and 32 observations. Both specify one run and an answer/retention ceiling of 2400. No held-out case is named.
- `tmp/validate-v74-evidence.mjs` checks the exact case IDs, all eight language/view coordinates per case, corpus fingerprints against V69, prompt versions, model IDs, token ceilings, source-byte stability and case availability before writing an immutable provenance receipt. It cannot repair the missing launch-time runner guard.
- The source and built trace hooks preserve the model result, typed reason, bounded schema-error classification and the language transport output. They call the original methods with the original receiver. They log only after awaited calls return; a thrown call can have no trace row, so the final typed benchmark report remains authoritative for availability. The hooks also omit the redacted error detail that would have localized this protocol failure. Any diagnostic amendment should capture a bounded error classification without recording credentials or provider payloads.
- `tmp/start-v74-probes.mjs` clones the V67 marker, whose case lists, one-run setting, runtime/reviewer models, 2400 answer ceiling, `freshHeldOutExecuted:false`, and no-replacement policy match the V74 plan; it overwrites the runtime SHA, timestamp and plan path.
- The inspected changed runtime bundles byte-match `tmp/core-v74/dist`. CI and documentation CI are recorded successful, and local receipts report 3,661 tests in 151 files plus 21 compiled groups. Those checks do not override the failed provider schema protocol.

## Approval state

There is no approval to launch V74 semantic probes from this review. Approval requires a separately reviewed transport correction/diagnostic outcome, a successful exact protocol receipt for the frozen runtime being evaluated, a complete `tmp/v74-postdeploy-check.json` for that same runtime, and runner-time provenance guards. Existing failed evidence must remain available and no unchanged protocol control should be retried.
