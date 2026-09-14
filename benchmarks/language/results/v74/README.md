# V74 protocol failure and diagnosis

Runtime `1f7309bc851690af3132cc00f0c7272347c7b2de` is preserved. Two independent Sol code review/fix rounds, 3,661 tests in 151 files, all repository gates, 21 compiled control groups, build/restart/socket deployment, CI 34410279020 and documentation CI 34410279006 passed.

The once-only declared provider suite passed 7/10 logical controls. Positive retention, maximum-frame negative retention, and four-branch repair all failed with request_failed before model output or reported usage. The original runner omitted detailed error text; that limitation remains explicit. The suite made 12 logical transports and 16 endpoint requests, including existing Chat compatibility negotiation. All four maximum 32-hint language controls passed within 1,024 tokens.

An independently approved four-call differential diagnostic then tested plain sentence, Unicode-property, ASCII-lookahead and ASCII-content patterns on the same invented small object, at a lower 400-token ceiling. Plain and ASCII-content passed exactly. The provider explicitly rejected Unicode property escapes as an invalid regex and rejected lookaround as unsupported. All four raw outcomes and redacted error messages are preserved. These new diagnostic observations establish compatibility failures for those minimal schemas; they do not reconstruct the omitted original errors or turn the three failed full-schema controls into passes.

No V74 semantic probe or fresh held-out run started. Preflight is HOLD. The next runtime must retain Unicode letter/number checks locally while exporting compatible schemas, then receive review, freeze, deployment, protocol validation and per-run provenance checks before the exposed matrix can start. No model, semantic pass, repair count, budget or acceptance threshold is changed by this diagnosis.

Initial and corrected protocol declarations, failed/successful receipts, diagnostic declaration/results, independent reviews and compiled outcomes are committed here. The local manifest hashes additional preserved harnesses and logs. Runtime-freeze.md preserves the earlier pre-execution checkpoint. The fixed repeated reliability gate remains unmet.
