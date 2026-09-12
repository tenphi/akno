# V50 code review round 2 — final

Reviewed the current uncommitted V50 diff against `146fefc` without reading round 1 or fresh V20 output. I made no implementation or tracked-file edits and made no live calls.

## Result

No remaining code-review findings in the requested scope.

The initial review found one P1 fail-closed defect: `verifyCandidateBatch` used `parseJsonLoose`, which could restore missing terminal delimiters and accept a truncated but otherwise complete verifier verdict. That finding and its local reproducer are preserved in `tmp/language-v50-code-review-2-initial.md`.

The fix at `packages/core/src/write/retain.ts:827-850` is correctly confined to the atomic retention-verdict boundary. It parses with `JSON.parse`, sends parse failures through the existing schema-invalid path, reports the invalid response, accepts no candidates, returns typed `retain_verification_failed` degradation through `runRetain`, and does not issue another semantic call. Extraction and repair retain their intentionally permissive `parseJsonLoose` behavior.

The expanded matrix in `packages/core/src/write/retention-frame-audit.test.ts:41-124` covers the original empty truncation, a complete verdict missing the root closer, a complete verdict missing both terminal container closers, and trailing non-JSON content. Each malformed form produces zero accepted candidates and degradation; `chat` remains exactly two calls total (one extraction and one verifier), and invalid-response reporting is asserted. Complete and reversed audit order remain accepted, while a well-formed semantic-negative verdict remains a normal hold rather than availability degradation. I reran the retention-frame and retain-language suites after the fix: 181 tests passed in 2 files. `git diff --check` is clean. The parent reported the pre-fix full local gate green at 2,281 tests across 135 files and is responsible for the post-fix aggregate run/deploy evidence.

## Reviewed invariants

- **Source-span accounting:** multi-span candidates receive private positional `F*` IDs plus original item IDs and quote bytes. Candidate-local enum membership, exact array length, and uniqueness require the exact span set without making response order significant. Single-span behavior remains unchanged.
- **Candidate accounting:** literal candidate discriminators form the union. Verdict length, unique map size, and expected-ID membership reject omissions, duplicates, and foreign candidates. A malformed batch invalidates the operation rather than preserving earlier accepted batches.
- **Repair and authority:** a repaired candidate is audited against its own current validated frame. The original candidate is carried separately, keyed to the repaired position and ID, as a proposition-preservation obligation. The contract expressly prevents either generated candidate or repair obligation from becoming source evidence.
- **Budget and call count:** batches remain bounded to two candidates. Requested output grows by 160 tokens for each required audited span and is still capped by `ModelClient`'s configured provider-role ceiling. The low-cap transport test checks the emitted schema and cap. V50 adds no semantic retry; any ceiling-driven incomplete batch now fails closed at both Responses status handling and retention's strict JSON/schema boundary.
- **Coverage roles:** the answer floor activates from unquoted, clause-local covered-repair source grammar and targets the narrow Russian instrumental-repair inversion. Independent source clauses where repair is itself a coverer defer to the semantic verifier. Its intentionally incomplete grammar can miss other reversals, but it cannot independently accept an answer.
- **Attribution and proposal agency:** the nominal Russian assistant-report form is punctuation- and content-bound and remains subject to attribution plus semantic verification. The proposal change treats `proposed discussion/review/inspection/action ... attributed to` as an unassigned description when source prose has a proposer, while retaining direct, passive-agent, possessive, and independently anonymous source cases. Remaining unrecognized grammar is conservative availability exposure, not an acceptance bypass.

## Limitations left for evaluation

The required span interpretations and relationship labels remain fallible model judgments; structural completeness does not establish semantic correctness. Two maximum-length frames can exceed a configured role ceiling and fail closed, so availability on long multi-span candidates must be measured in the approved fresh evaluation. The deterministic coverage and agency rules are deliberately narrow rather than complete parsers. None of those limitations warrants broadening the heuristics before exposed evaluation.
