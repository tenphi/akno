# V75 independent Sol code review — round 2

## Scope

I reviewed the final seven-file staged diff against `65b62c6`, including both production schema sites, composed repair/verification parsing, focused and integration tests, changeset and `benchmarks/language/v75-trial-plan.md`. I also reviewed the preserved V74 7/10 protocol failure and the independently approved four-call differential receipt. I did not edit code/tests, call a provider, inspect fresh held-out inputs or run a corpus probe.

## Findings and resolution

### P2 — locally invalid clock output could have reached the language transport before refinement — resolved

The initial V75 implementation correctly applied the Unicode-content refinement in the final atomic transaction parse, but `ModelClient.chat` selects generated prose and performs its language audit before returning the repair response to `runRetain`. The original `additionalLanguageProse` callback checked clock field types rather than the composed schema. Once punctuation-only content became legal on the provider wire, an output containing `"."` could therefore have consumed a language request before the later local refinement rejected it.

The final code moves the existing permissive-full `transactionSchema` before the model call and validates the normalized complete transaction inside `additionalLanguageProse`. It also rejects duplicate original indices there. A failed local refinement throws during prose selection, before a language transport begins; the transaction remains unwritable and the semantic verifier is not reached. The same transaction schema is still applied after strict JSON parsing, so this early check does not replace the authoritative post-call parse.

The added real `ModelClient`/stubbed-private-transport matrix covers every clock field. Its observed request order is extraction, extraction-language-check, repair, with no repair-language-check, verification or accepted candidate. The corrected focused run reports 133 passing tests, and the compiled clock/report replay reports 272 passing tests.

This resolution retains one minor diagnostic limitation: `ModelClient` classifies an exception from generated-prose selection as `language_check_failed`, even though this particular exception arose from local transaction shape. It makes no extra request and cannot authorize a write; changing that internal reason would require a broader client callback contract and is not justified by this transport correction.

## Final assessment

No remaining code blocker found.

- `retention-negative-evidence.ts` preserves `min(1)`, `max(80)`, Unicode letter/number parsing, exact candidate/source substring checks, candidate-owned catalog IDs, polarity evidence and atomic response consistency. Its endpoint schema emits no pattern.
- `retain-clock-repair.ts` preserves the plain single-line, no-CR/LF/NUL and terminal punctuation pattern plus every branch-specific length. The local refinement independently requires a Unicode letter or number in every segment. Normalization occurs before both the early and final transaction checks.
- The endpoint schemas contain neither Unicode-property escapes nor lookaround. The only clock-repair wire pattern is the previously accepted `^[^\\r\\n\\u0000]*[.!]$`.
- Punctuation-only, missing, over-cap, CR/LF/NUL, malformed and duplicate transactions remain held as a whole. RU, CJK and numeric content remain valid; no ASCII-only policy was substituted.
- The repair vector, immutable siblings, original-position ownership, one-repair limit and mandatory final semantic verifier are unchanged. Negative retention findings still fail atomically on missing, foreign or inconsistent witnesses.
- Extraction and verifier versions advance to `retain-extraction-language-v54` and `retain-verifier-language-v38`; public protocols, model, token ceilings, semantic booleans and pass/retry counts do not change.

## Verification

- `tmp/v75-round2-fix-tests-corrected.log`: 133 focused tests passed.
- `tmp/v75-prefreeze-clock-repair-after-ordering.log`: 272 clock/counterfactual compiled tests passed.
- `tmp/v75-round2-full-suite.log`: 3,668 tests in 151 files passed.
- Typecheck, lint, formatting, knip, repository safety, smoke, installed-package smoke, docs doctor and docs build all passed in the reported `tmp/v75-round2-*` logs.
- My independent rerun of the two changed helper test files passed 85/85; `git diff --cached --check` passed.

## Disposition

**Clean for round 2.** The runtime change is the smallest correction supported by the V74 differential and preserves local atomic enforcement. This code result does not establish provider compatibility or model competence; the exact frozen V75 protocol and final preflight remain mandatory before corpus execution.
