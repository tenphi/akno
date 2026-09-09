# V76 independent code review round 2 — initial

## Disposition

No actionable production defect found in the current diff against `2bc8a18`.

The new generated-clock requirement is source-activated, candidate-local, and rejection-only before the existing semantic verifier. The new nominal counterfactual admission is likewise a presence floor; it does not establish source truth. I found no quotation, soft-boundary, mismatched-clock, ambiguous-witness, provided-candidate, or mixed-repair bypass in the reviewed implementation.

## Clock witness and candidate floor

- `packages/core/src/write/retain-clock-repair.ts:74-143` derives the private `deictic`, `period`, and `direction` only from one complete exact frame span. The definition is anchored at byte zero, requires all temporal dimensions in that span, checks the immediate ending for retraction, and rejects unmatched trailing source prose. Distinct witnessed definitions return `null`; dimensions are not assembled across items.
- `packages/core/src/write/retain-clock-repair.ts:148-198` binds the readable exclusion to the source-derived period. Whole quotations are replaced with a nonsplicing sentinel, while only an isolated matching clock label is unwrapped. Each accepted shape starts at text or a hard `.`, `;`, or `!` boundary and must end immediately or at an unretracted hard clause boundary. A question, conditional/example prefix, wrong period, chronological `not after processing`, generic processing mention, or immediate retraction does not pass.
- The check deliberately proves only that an explicit same-clock processing-reference contrast is readable. A candidate could still state a wrong proposition elsewhere. That is an acknowledged finite-floor limit and remains owned by full source verification.

Concrete reviewed boundary results, also covered in `retain-clock-repair.test.ts`:

- `Processing time is not the reference for next month.` passes only a `next/month` exclusion witness.
- Its whole-quoted form, `If ...`, `Not\n...`, `...?`, and a suffix `But this is false.` fail.
- Replacing `next month` with `last year` fails against that witness.
- `Next month is not after processing.` and `The clock is not the time of processing.` fail because they do not state the reference relation.

## Retain integration and repair ownership

- `packages/core/src/write/retain.ts:1661-1690` computes the witness only for generated candidates after exact spans, attribution, time cleaning, and the existing relative-time checks. The additional requirement activates only when the candidate has explicitly unknown time and the exact witness has `with_exclusion: true`.
- `packages/core/src/write/retain.ts:1783-1798` records a text-only target only after the intervening discourse/schema floors pass, only for generated candidates, only when report uncertainty is not also unreadable, and only for a literal empty relation vector. Mixed report/clock or other earlier failures therefore remain full-repair targets or held.
- `packages/core/src/write/retain.ts:748-770` strictly parses and normalizes the entire transaction before selecting repair prose, rejects duplicate original indices, and checks each exclusion repair against its own server-owned witness before the language transport. Repaired text is then rebuilt into the original vector, run through the complete cleaner again, compared with immutable admitted siblings and original positions, and submitted to the existing mandatory source verifier with the original repair obligation.
- `cleanCandidateBatch` without `generated: true` never computes the new witness. The added caller-provided regression confirms this path remains unchanged.
- Caps and calls are unchanged: the four fields remain 195/90/60/52 UTF-16 units and total 400, the existing single repair transaction is used, and no semantic retry or additional verifier call is introduced.

The pre-language relation check is applied to the final joined repair text rather than requiring the qualifying sentence to occupy only `excluded_reference_clocks`. That is consistent with the runtime invariant: the fields are private bounded generation scaffolding, while the final readable candidate is the persisted and semantically verified object. It does not let an irrelevant final text pass.

## Named acquisition counterfactual floor

- `packages/core/src/memory/counterfactual-wording.ts:76-101` recognizes only the two declared complete acquisition shapes. It requires a hard sentence start, the unrealized alternative and irrealis consequence, a separate proper-name nonpurchase sentence, and the inactive-coverage consequence.
- When an outer `По словам <name>` is present, its normalized spacing must equal the explicit actual-world actor. A pronoun or different actor cannot lend the closure. Whole quotations, conditions/examples, newline or semicolon substitutions, missing purchase negation, missing inactive coverage, and immediate retractions fail.
- The grammar intentionally omits other faithful surface forms. Passing the helper only sends the answer to mandatory semantic verification, so later unsupported clauses and source/object/year differences remain rejectable. The revised `nominal-independent-negative` test now isolates this by preserving the source year and adding only the unsupported independent claim.

## Verification performed

I ran:

```text
pnpm exec vitest run packages/core/src/write/retain-clock-repair.test.ts \
  packages/core/src/memory/counterfactual-wording.test.ts \
  packages/core/src/ops/answer.test.ts --reporter=dot
```

Result: 943 tests in 3 files passed. `git diff --check 2bc8a18` also passed. The parent reports the corrected full suite at 3,790 tests / 151 files and all routine gates green; I did not independently repeat the full suite.

## Practical limits

- The English/Russian relation and counterfactual grammars are intentionally finite and can still hold faithful unseen phrasings. Full semantic verification cannot recover a candidate rejected by a local floor; exposed evaluation remains necessary to measure that coverage cost.
- Exact-span ownership proves source bytes and dimensions, not that a model chose the correct frame for the proposition. Existing frame audits and semantic verification remain authoritative for attachment.
- Positive test verdicts establish wiring and rejection behavior, not provider semantic reliability.
