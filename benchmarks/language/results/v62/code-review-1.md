# V62 code review round 1

Reviewed the uncommitted diff from `bad22b4`, limited to retention extraction/repair field order, the governing-unknownness instruction, the negative restrictive-naming grammar, its tests, the changeset, and `benchmarks/language/v62-trial-plan.md`. I made no runtime or tracked-file changes and made no provider calls.

## Finding

### P2 — a title-cased run-on can be consumed as the naming tail and borrow the earlier denial

`packages/core/src/write/retain.ts:1587-1599` removes any one-to-six-token suffix whose tokens begin with an uppercase letter or digit, apart from a finite stop-word list. That admits text after the actual identifier when the later words are title-cased. The cleaner then reduces the whole prefix to `no handover of the device`, so `hasAffirmedBooking` returns false and the later affirmative-looking booking does not require a time envelope.

Using the existing invented `Ada Marlow` / `Zephyr QX-100` source and candidate structure from `retain-booking-alias.test.ts`, I called the actual exported `cleanCandidateBatch` with `generated: true`. Each of these returned one admitted candidate and no hold:

```text
Ada Marlow states that no handover of the device referred to as Zephyr QX-100 Then A Collection has been booked.
Ada Marlow states that no handover of the device referred to as Zephyr QX-100 THEN A Collection has been booked.
Ada Marlow states that no handover of the device referred to as Zephyr QX-100 Ada Marlow has been booked.
```

Splitting the first example before `Then` also admitted it, because `cleanCandidateBatchWithPositions` folds all whitespace before `hasAffirmedBooking`. The lowercase contrast, `... QX-100 then a collection has been booked`, correctly produced `time_unresolved`. Existing tests at `retain-booking-alias.test.ts:87-100` cover `AND` and `Is Ready And`, but not an unlisted title-cased separator or a second title-cased subject.

This does not directly accept a source error: every survivor still reaches the mandatory complete-source semantic verifier. It does remove the deterministic booking/time floor for malformed but schema-valid generated prose, leaving the fallible verifier as the only barrier. Expanding the stop-word list would leave the same open class.

The smallest structural correction is to strip the captured restrictive name only when that complete normalized tail is exact source/frame-backed naming text, and preferably also equals the candidate's proposed subject. The actual target `Zephyr QX-100` is present in the supplied frame. Source occurrence would establish the boundary without treating generated capitalization as authority. Subject equality alone is weaker because `subject` is generated and remains subject to independent ownership and semantic checks. Tests should include the three examples above, their newline-folded form, and the intended exact source-backed identifier.

**Resolution verified.** The revised `hasAffirmedBooking` receives the declared subject and the already validated frame. It removes the restrictive tail only when its normalized value equals the complete declared subject and that same bounded name occurs inside one frame span. It does not concatenate neighboring spans, and the existing proper-name grammar remains an additional limit. The declared field therefore cannot self-certify an expanded run-on tail; two new forged-subject tests exercise that case. My four original repros now produce `time_unresolved`, while the source-backed `Zephyr QX-100` target is still admitted and still reaches both positive and negative mandatory-semantic integration outcomes. This resolves the P2 finding without treating the subject, frame, or capitalization alone as source authority.

## Other reviewed areas

- `RETAIN_SCHEMA` now emits `text`, `subject`, and `page` as its final three candidate properties. Extraction and the candidate nested in repair both use the same schema object, so the order applies consistently. Zod parsing remains property-name based, all fields remain required or nullable, and no protocol field was added, removed, or retyped. `models/client.test.ts:644-651` checks the actual endpoint-converted schema order and strict-schema coverage still runs for `RETAIN_SCHEMA`.
- The prompt tells the model to complete the qualified sentence before selecting routing metadata and explicitly states that subject/page do not establish ownership or agency. Existing cleaner, page admission, placement ownership, exact support/frame, repair-position, and mandatory semantic checks remain in place. I found no schema or legacy-output compatibility blocker in the reorder.
- The new actual-requirements instruction keeps the epistemic experiencer, assumed/actual distinction, conditional consequence, and explicit absence of an actual event in one hypothetical record. It does not grant canonical status or source authority and does not let a repair mutate an admitted sibling. Its practical effect remains model-dependent, as the plan states.
- Quoted restrictive names are conservatively rejected by the new unquoted-tail branch; full quoted statements also continue to trigger the booking floor in my local probes. Punctuation such as colon, comma, semicolon, period, and question mark prevents the new removal. That conservative behavior is compatible with mandatory semantics.

## Checks

- Initial `pnpm vitest run packages/core/src/write/retain-booking-alias.test.ts packages/core/src/models/client.test.ts` — 88 tests passed in 2 files.
- Initial direct actual-cleaner adversarial probe — intended target admitted; lowercase connective, colon, quoted sentence, and mixed-lowercase identifier held; the four title-case/run-on forms above reproduced the finding.
- Post-fix focused recheck — 94 tests passed in the same 2 files. The same actual-cleaner probe admitted only the intended target; all four original run-on forms now returned `time_unresolved`.
- `git diff --check bad22b4 --` passed.
- Parent-reported current-tree gate: 2,716 tests in 143 files plus build/typecheck, lint, knip, formatting, docs doctor/build, smoke, installed-package smoke, and repository checks passed. Compiled extraction/repair schema-order and inherited retention preflights passed. These results do not cover the reproduced title-case boundary.

**Conclusion:** the one P2 deterministic-boundary defect found in round 1 is resolved. I found no remaining blocker in the reviewed V62 diff. The schema reorder, source/frame/subject binding, repair compatibility, and governing-qualification prompt are coherent within the declared scope. Natural naming variants outside the closed grammar can still be conservatively held, and live semantic reliability remains for the frozen evaluation rather than these deterministic tests.
