# V75 independent Sol code review — round 1

## Scope

I reviewed the complete seven-file staged diff against `65b62c611ddb566ffedbac36a844647527afb1ef`, including the V75 trial plan and the preserved V74 diagnostic outcome. I did not edit runtime/tests, call providers, inspect corpus data, or change GitHub state.

## Findings

No actionable correctness or compatibility defect found.

The two runtime changes are narrowly matched to the demonstrated endpoint failures:

- `retention-negative-evidence.ts` retains `min(1)`, `max(80)`, and the Unicode letter/number requirement in the same Zod parse, while no longer serializing the rejected Unicode-property pattern.
- `retain-clock-repair.ts` retains the provider-compatible single-line/terminal-punctuation regex and moves only the Unicode-content assertion to a local refinement. It still rejects CR, LF, NUL, missing terminal punctuation, punctuation-only fields, over-cap fields, and absent fields.

The refinements remain part of the strict schemas used to parse complete returned transactions. They therefore do not create a post-acceptance advisory check or permit partial clock repairs/negative audits. `retentionNegativeEvidence.consistent` also independently retains `hasContent` checks for every source and candidate text witness, so a punctuation-only witness cannot pass through a different parsing path.

The emitted-schema assertions cover the relevant compatibility boundary: negative-evidence schemas contain no provider-visible pattern, while every clock field emits the plain `^[^\\r\\n\\u0000]*[.!]$` pattern and no `oneOf`/`const`. The multilingual RU/CJK and numeric positives demonstrate that the local policy did not become ASCII-only. Existing atomic negative-witness and clock-transaction cases continue to exercise malformed, foreign, wrongly-null, punctuation-only, overlength, and partial responses.

Version bumps to extraction `v54` and verifier `v38` consistently identify the changed private schemas. The changeset and trial plan accurately preserve the V74 7/10 result, prohibit treating the correction as a retry, and keep models, calls, semantic gates, repair count, caps, and public schemas unchanged.

## Verification reviewed

- `tmp/v75-focused-initial.log`: 85 tests in two files passed.
- `tmp/v75-typecheck.log`: typecheck invocation was recorded; final completion should remain part of the normal freeze gate.
- Static inspection confirms the staged diff contains only the declared seven files.

The deterministic schema tests establish local conversion and validation behavior, not endpoint acceptance or model competence. The declared post-freeze protocol controls are still required before any semantic probe.

## Disposition

**Clean for round 1.** Proceed with the independent second review and the declared repository, deployment, and transport gates. This review does not approve provider or corpus execution on an unfrozen revision.
