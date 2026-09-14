# V74 round-two fix review

## Scope

I rechecked only the changes made in response to the punctuation-only finding preserved in
`tmp/language-v74-round2-review.md`: the clock sentence schemas, retention negative-evidence schemas
and post-parse checks, and their focused controls. I made no runtime/test edits and no provider
calls.

## Resolution

**Accepted; the round-two finding is resolved.**

`retain-clock-repair.ts` now requires every segment to contain at least one Unicode letter or
number in addition to its existing nonempty, per-field cap, single-line/NUL-free, and terminal
punctuation constraints. This rejects `.`, `!`, `...!`, and horizontal-whitespace-plus-punctuation
for every required field in both the exclusion and no-exclusion arms. Cyrillic, CJK, and numeric
content controls confirm the check is script-neutral rather than English-specific. Field maxima,
the exact 400-unit joined allocations, response keys, branch ownership, and materialization remain
unchanged.

`retention-negative-evidence.ts` applies the same Unicode letter/number requirement to exact source
and current-text excerpts at both schema validation and the independent `consistent()` boundary.
Punctuation-only source/current witnesses and polarity witnesses therefore invalidate the complete
verifier response. Closed metadata pointers are unaffected, and exact substring ownership, 80-unit
caps, null-side branch rules, candidate-specific repair evidence, and polarity equality rules remain
unchanged.

The new tests cover each clock field, direct transaction rejection, negative mismatch source/current
anchors, polarity evidence, and atomic two-candidate verifier failure with no retry. The initially
incorrect unsupported-content fixture is no longer present; the corrected `changed_value` case has
the required source side and isolates the intended punctuation defect.

## Direct verification

- `pnpm vitest run packages/core/src/write/retain-clock-repair.test.ts packages/core/src/write/retention-negative-evidence.test.ts`
  — 82 tests in 2 files passed.
- `pnpm typecheck` — passed.
- `git diff --cached --check` was clean before the fix; the working-tree fix itself introduces no
  whitespace or schema-shape concern on inspection.

## Final disposition

The V74 round-two code review is **clean after fixes**. I found no remaining production blocker in
the complete staged change. Final repository gates and declared compiled/provider preflight remain
the root workflow's freeze prerequisites; they are validation evidence rather than changes to this
review conclusion.
