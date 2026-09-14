# V77 protocol declaration review

Independent Sol read-only review of the prepared declaration on frozen runtime `a67faa3fd3a6f59450a35c4af1d66baa96fee4e8`. I made no provider or semantic call and did not inspect held-out input. I invoked the suite's local `--prepare` path once only to exercise drift assertions; after all local captures succeeded, it correctly stopped at `Never overwrite a declared fixture` and did not modify the existing declaration.

## Declaration identity

- Path: `tmp/v77-protocol-declaration.json`
- SHA-256: `8858515916e931d6cc8b2311506e9d92c0a6373f0264c053d470009819bc71a4`
- Logical fixtures: 10, with unique IDs
- APIs: eight Responses fixtures plus two Chat Completions language fixtures
- Role cap: 2,400 for every fixture
- Effective caps: 2,222 for the three answer controls, 2,400 for the three retention controls, and 1,024 for the four language controls

The preparation log reports the same declaration hash and ten fixtures. The difference between its JavaScript string length and filesystem byte length is expected for the declaration's Unicode content and is not used as an identity check; SHA-256 binds the actual bytes.

## Exact schema and fixture checks

- A fresh local capture from the current compiled `dist` passed the runner's deep schema comparisons before the overwrite guard. This establishes that the prepared declaration still matches the frozen built runtime.
- `strictModeViolations` is empty for all ten declared endpoint schemas. Each effective cap equals `min(callerCap, roleCap)`.
- The two-record answer verifier contains two alignments and exactly four expected actor/qualification diagnostic values. Each is a complete natural 80-BMP-unit sentence. Across every provider-visible verifier union branch, actor and qualification details have `maxLength:80`; unrelated mismatch details remain at 240 and other field maxima are unchanged.
- The maximum verifier retains the preserved V75 natural source/candidate fixture, all relation/null/anchor states, exact selection and semantic-negative fields. Only the four expected diagnostic values and their shared wire maxima reflect V77.
- The four-branch repair uses the approved V76 natural fixture from the outset. Its repair shapes are report-text-only, clock-with-exclusion, clock-without-exclusion, and full candidate. Field lengths are respectively `200/78/120`, `195/90/60/52`, and `220/110/68`; the three materialized prose values remain exactly 400 units.
- The positive and 2×16-frame negative retention fixtures preserve their captured schemas, counts and caller/effective caps. The four language fixtures retain 32 owned hints each, both transports, and coherent compliant/noncompliant expected audit states.

## Execution safeguards

Live mode requires the existing declaration bytes to equal a freshly serialized capture, exact frozen HEAD, a clean tracked tree, explicit `--live`, and an absent result receipt. The receipt is written before transport, then records every logical and endpoint start/completion. Final success requires all ten results to be exact and schema-valid, the language audit statuses to match, every transport to complete successfully, and every observed effective cap to match the declared role ceiling.

Compiled groups and CI remain separate semantic-readiness prerequisites. Their current in-progress state does not alter the safety of executing this bounded transport suite, and successful echoes cannot substitute for those gates or establish model competence.

## Disposition

**Approved to execute the declared ten-control provider suite exactly once with `--live`.** Preserve any failure as final evidence and do not repeat a failed fixture unchanged. This approval covers transport/schema/exact-copy controls only; it does not approve selected, built, or full semantic probes.
