# V66 independent code review — round 2

Reviewed the complete working-tree implementation diff from `3b85e7f`, the V66 design review and trial plan, and the focused/full local receipts. This was a read-only production review: I made no runtime or test edits, made no provider calls, and did not inspect or execute fresh V21 held-out outputs.

## Result

No unresolved production blocker remains in the current tree. I found one concrete role-floor defect during review; root corrected it, and I independently reproduced the corrected behavior. The remaining limitations below are bounded and accurately preserved by the unchanged mandatory semantic verifier.

## Finding and resolution

### P2 — resolved: unanswered coverage activation did not bind the subject

The first version of the new `unansweredInstrument` branch in `packages/core/src/memory/coverage-roles.ts` began at `не отвечает на вопрос` and did not constrain its grammatical subject. With the covered-repair source `Whether motor repair is covered remains unknown.`, the following three candidates all returned `false` from `coverageRolesSupported` and therefore bypassed the local repair-as-coverer hold:

- `Запись не отвечает на вопрос, покрывается ли ремонтом двигатель.`
- `Устройство не отвечает на вопрос, покрывается ли ремонтом двигатель.`
- `Ada Marlow не отвечает на вопрос, покрывается ли ремонтом двигатель.`

The latter two contradict the helper comment and the approved boundary: a device or person must not masquerade as the source record's unresolved answer. This did not itself publish the candidate because full semantic verification remained mandatory, but it unnecessarily removed a deterministic rejection boundary and made acceptance depend entirely on that fallible judgment.

The current implementation at `packages/core/src/memory/coverage-roles.ts:28` requires an immediately preceding `запись` (optionally `об исключении`), `заметка`, or `источник`. Quote removal now inserts a sentinel, so quoted text cannot splice the record noun to the predicate. New controls cover a same-clause device, person, an intervening quotation, the exact observed record phrase, and existing sentence/adversative boundaries.

Independent post-fix reproduction gives the intended direction:

| Candidate subject | `coverageRolesSupported` |
| --- | ---: |
| `Устройство ...` | `true` (local floor defers) |
| `Ada Marlow ...` | `true` (local floor defers) |
| `Запись ...` | `false` (local role hold) |
| `Эта запись об исключении ...` | `false` (local role hold) |

`tmp/v66-review2-coverage-tests.log` records 522 passing coverage/answer tests after the fix.

## Other reviewed contracts

- **Candidate-specific identifier context:** `packages/core/src/write/retain.ts:597-617` adds the advisory only to failed original positions whose typed cleaner diagnosis records a missing subject identifier. `sourceIdentifierContext` uses exact original source-item bytes, reports total occurrences/source-span count/omissions, and applies one shared four-span/1,200-UTF-16-unit cap without clipping or silently selecting an antecedent. It is extra repair input only: the model must still return a repaired candidate at the original index; the cleaner revalidates its text, frame, metadata and relations; immutable admitted positions and the original-position verifier obligation remain unchanged. The context does not append a frame, admit a record, or create another repair/semantic call.
- **Repair metadata and positions:** the repair instruction now explicitly separates the original proposition from evidence and tells the model to re-evaluate commitment when adding coupled hypotheses. Tests cover asserted versus tentative repair metadata, omission of the repair, repeated/quoted/oversized occurrences, the shared span cap, original obligations and semantic-negative verification. Returned repairs still use the existing exact failed-position enum, uniqueness transaction check, immutable sibling comparison and duplicate rejection.
- **Alignment relation/null transport:** `packages/core/src/ops/answer-source-audit.ts:55-82` encodes three strict object alternatives: selected relations with two non-null anchors, `omitted` with a null answer anchor, and `not_selected` with a nullable source/null answer anchor. The existing owner checks and `answerAlignmentsSupported` still permit publication only for `preserved` or `not_selected`, and every cited record must select at least one category. The emitted schemas are checked for strict branches, `anyOf`, singleton enums, and absence of `oneOf`/`const` for both Chat Completions and Responses. Local fixtures exercise every relation/null parse combination and extra/foreign/stale coordinates. Planned frozen provider controls remain necessary evidence of endpoint compatibility; local schema echoes do not establish model semantic reliability.
- **Compact frame audits:** the added wording keeps exact source and candidate texts authoritative and describes each `span_audit.interpretation` as a private summary. It does not alter the 240-character schema, drop frames, salvage siblings, make `reason_code` mandatory, or relax the atomic consistency check. Tests retain whole-batch unavailability for an inconsistent response, ordinary rejection for a consistent negative with null reason, and show that a clipped but internally consistent private summary remains fallible rather than locally reinterpreted.
- **Shared-negative report list:** the new branch consumes one closed three-part list under a single negative auxiliary. Pronoun subjects require matching reflexives; a named actor deliberately permits bounded singular reflexive variants because names do not establish gender, leaving identity and predicate/object pairing to full-source semantics. Quotes, a positive/retracted tail, new subjects, conjunction changes, punctuation and unrelated objects remain negative controls. It is an admission to semantic verification, not semantic approval.
- **Nominal counterfactual forms:** `hasNominalCounterfactual` masks quotations, splits hard/adversative boundaries, and recognizes only the two reviewed Russian shapes with a bounded noun phrase and `бы` morphology. It supplies only the existing counterfactual-presence floor. The semantic verifier still owns the antecedent, consequence, nonpurchase and no-active-coverage qualifications; the integration test confirms an overbroad actual-coverage statement is rejected after the lexical floor passes.
- **Original undated source clock:** both source-relative and unknown-reference helpers call the same closed `hasUndatedOriginalClock` branch. It permits the two reviewed source nouns/orderings, supported interval constructions, hard endings and the bounded separate plan/meeting denial; it masks complete quotations while allowing an isolated quoted deictic label. Tests cover dated/processing/cross-clause/question/conditional/reversal/negated/quoted negatives. The branch intentionally does not parse every abbreviation, line wrap or Russian temporal paraphrase.
- **Generation and corpus wiring:** the prompt changes are guidance only: ordinary hyphenated component words remain translatable, no invented coverage provider is authorized, and competing hypotheses should keep their governing qualifications in one candidate. Prompt versions are bumped consistently. V21 is wired through the runner, CLI, review packet, gate and fixture matrices; its frozen hash and 10 writable plus one read-only case per split are checked. Gate thresholds, models, budgets, batching, public schemas, retry count and source-byte rules are unchanged.

## Validation observed

- `tmp/v66-focused-initial.log`: focused implementation tests passed.
- `tmp/v66-repair-focused-initial.log`: 43 repair-focused tests passed.
- `tmp/v66-commitment-fixture-initial.log`: 22 commitment fixtures passed after the round-one test API correction.
- `tmp/v66-transport-fixture-corrected-final.log`: 30 alignment transport fixtures passed.
- `tmp/v66-review2-coverage-tests.log`: 522 coverage/answer tests passed after the subject-binding fix.
- `tmp/v66-check-suite-initial.log`: 2,854 tests passed and one unchanged ranking test hit its 30-second timeout while other checks ran concurrently.
- `tmp/v66-ranking-timeout-followup.log`: the ranking test passed 2/2 in isolation.
- `tmp/v66-check-suite-followup.log`: the complete suite then passed 2,855 tests in 144 files at the unchanged timeout.
- Parent-reported and locally preserved receipts show build/typecheck, lint, knip, formatting, docs doctor/build, repository safety, smoke 8/8 and installed-package smoke passed.

## Practical limits

These deterministic helpers remain deliberately incomplete natural-language recognizers. Passing a presence floor does not establish source truth, action/object pairing, actor identity, clock correctness, or full qualification. The repair context is advisory and can still yield no safe repair; compact audit instructions cannot prevent a coherent but mistaken private interpretation; `anyOf` transport correctness cannot predict provider semantic choices. Those cases continue to fail closed through the existing cleaner and mandatory semantic verification. Fresh V21 held-out semantic reliability remains entirely untested at this review point and must not be inferred from the local suite or stub/provider schema controls.
