# V60 code review round 2

## Conclusion

No blocking finding remains in the current diff from `7167de9`.

I reviewed the V60 runtime changes independently of the round-1 note and without provider calls, grading output, V20 held-out inputs, or implementation edits. The new behavior stays within the declared architecture: one existing extraction call, existing per-block answer generation/verification, unchanged semantic acceptance dimensions, unchanged repair/retry policy, unchanged ownership decision, unchanged schemas and output ceilings.

I found one concrete source-clock boundary escape during this review. The current tree fixes it, and the reproduced negatives plus intended positive now behave correctly. The prompt-only generation changes remain fallible availability improvements; they do not weaken any acceptance gate.

## Finding and resolution

### Resolved — Russian record-time matcher could ignore a preposed negation or metalinguistic qualifier

**Initial location:** `packages/core/src/timeline/source-clock.ts`, new Russian `clockLabel ... отсчитывается/считается от времени ...` branch.

The initial round-2 expression required only a non-letter immediately before the deictic label. It therefore found an affirmative-looking substring inside a larger nonasserted or negated construction. Direct offline calls returned `hasSourceRelativeAnchor(...) === true` for these invented controls:

- `Не следующий год отсчитывается от времени записи; календарный год неизвестен.`
- `Неверно, что следующий год отсчитывается от времени записи; календарный год неизвестен.`
- `Нельзя сказать, что следующий год отсчитывается от времени записи; календарный год неизвестен.`
- `Якобы следующий год отсчитывается от времени записи; календарный год неизвестен.`
- `Пример: «Следующий год» отсчитывается от времени записи; календарный год неизвестен.`

This did not by itself accept an answer: the clock helper is a rejection floor and complete semantic verification remained mandatory. It nevertheless violated the branch's declared closed affirmative grammar and could let a nonasserted mention satisfy the local source-anchor requirement.

**Resolution reviewed:** the expression now requires `(?:^|[.;!])\s*` immediately before the bare or unwrapped clock label. New controls cover the five prefixes with bare and quoted labels, including `Не\n...`. Newline alone is deliberately not a clause reset, so a soft wrap cannot discard a preposed qualifier. The existing right boundary still permits only:

- a declarative end at end-of-string, `.`, `;`, or `!`; or
- the closed comma contrast denying today's and processing clocks, optionally followed by the bounded unknown-calendar-date clause and then a declarative end.

The intended V59 shape still returns both source-anchor and unknown-clock true:

> `...; «Следующий год» отсчитывается от времени записи, а не от сегодняшнего дня или времени обработки, и точный календарный год восстановить нельзя.`

The reproduced prefix cases now return false. Conditional, interrogative, processing/meeting/device-recording source nouns, quoted full examples, internal quoted negation, and corrective comma continuations are also negative controls in `source-clock.test.ts`. The answer integration tests exercise a supported generated answer and a semantically rejected alternate under the same mandatory verifier path.

## Other reviewed surfaces

### Epistemic predicate-role generation

`retain.ts` advances extraction to `retain-extraction-language-v44` and adds first-pass guidance distinguishing receipt, seeking, giving and independent checking of confirmation. This directly addresses V59's change from Ada receiving no confirmation to Ada personally not confirming a message. The instruction affects generation and the existing structural repair prompt because repair appends to the same system text. The existing semantic verifier remains unchanged and already rejects a changed epistemic action/role.

The scope is sound: it asks for equivalent semantic action and direction, rather than exact source-language words, and explicitly preserves the source-stated form. It introduces no model-produced role array that could conflict with readable prose and no retry after semantic rejection.

Limitation: this is generation guidance, not a deterministic guarantee. If extraction repeats the role swap, the correct outcome remains a verifier hold and loss of useful coverage. Local stubs can establish prompt transport and withholding behavior but cannot prove cross-language predicate preservation; the declared exposed diagnostic is the meaningful semantic check.

### Person-subject destination suggestion

The retention prompt now distinguishes the affected person/possessor from an unspecified booking actor. For an explicit possessive passive denial, it instructs generation to:

- keep the action passive and generic device unresolved;
- use the exact source-established person as canonical subject;
- suggest a page named for that person only in a supplied creatable folder;
- avoid deriving possession or agency from source-speaker provenance alone.

No router code changed. `candidate.page` remains the sole way a new-page choice enters ownership; admitted-folder, temporal, existing-page and independent ownership checks remain intact. The new `remember.test.ts` matrix verifies:

- a person-named proposal is only written when ownership selects `proposed`;
- `uncertain` produces no write;
- absent `page` produces no synthesized proposal;
- candidate text stays generic and contains no Zephyr identity;
- an unrelated product page's bytes remain unchanged.

This is the correct dataflow boundary. In particular, the runtime does not construct a person page from `source_speaker`, equate a generic device with a nearby product, or make a person match sufficient ownership evidence.

Limitation: extraction must still generate the exact person subject and eligible page suggestion, and ownership may still decline it. The test proves the routing behavior once that tuple exists; it does not pretend that a stub proves the model will produce or select it. Ambiguous possession, multiple people/folders, external reports and absent writable taxonomy remain valid holds.

### Per-record readings and citations

`ANSWER_READING_CONTRACT` now says that each private reading stays local to its own retained excerpt even when records share an original frame, and that a block using a second record's selected proposition must cite that record. The example correctly distinguishes a fictional promise from the actual proposal to discuss it. This is consistent with the existing source-frame contract: private frames constrain a selected record but cannot expand selection or become citation authority.

The answer prompt advances to `answer-generation-v56`; verifier version and schema remain unchanged. Existing verification still requires an alignment for every cited framed evidence record, retained-excerpt selection, all three semantic booleans, and the other local guards. No private reading becomes public evidence.

Limitation: the new citation grouping is model guidance. A synthetic all-true verifier response cannot establish that the model will cite the second record, so the absence of a text-mirroring unit test is not a blocker. The declared selected diagnostic is needed to observe whether the prior fiction composition improves; an omitted citation must continue to be withheld by the fallible but mandatory excerpt-selection/semantic verifier.

### Versioning, plans and budgets

The benchmark expectation advances to `answer-generation-v56`; retention advances to `retain-extraction-language-v44`. Verifier versions correctly stay at `answer-verifier-v37` and `retain-verifier-language-v30` because their contracts and schemas did not change. The changeset and V60 plan describe the final clause-start and clause-end bounds, person-page ownership boundary, predicate-role guidance and citation scope.

There is no new schema arm, public protocol/storage field, model role, pass, repair, retry, output allowance or configured service override. The trial plan retains the explicit diagnostic 2,400-token setting and states that it does not establish reliability under the service's 1,024-token overlay.

## Checks

I independently ran:

```text
pnpm vitest run packages/core/src/timeline/source-clock.test.ts packages/core/test/remember.test.ts packages/core/src/ops/answer.test.ts
```

Result: **608 tests in 3 files passed**.

I also ran the exact prefix reproductions directly against `hasSourceRelativeAnchor`; all five original escapes now return false, including the newline variant, while the intended semicolon-delimited V59 construction returns true with an unknown clock. `git diff --check 7167de9` is clean.

I inspected the final local receipts:

- `tmp/v60-suite-round2.log`: **2,684 tests in 143 files passed**;
- `tmp/v60-compiled-boundaries-round2.log`: intended source-time anchor, unknown clock, mandatory semantic rejection, quote exclusion, source-byte stability and zero added model passes all true;
- `tmp/v60-compiled-person-preflight.log`: person proposal, independent ownership, no synthesized proposal, unresolved device, passive agent, unrelated product-byte stability and zero added model passes all true.

Root reports the accompanying final build/typecheck, lint, format and repository checks green; earlier knip, documentation, smoke and installed-package checks are unchanged and green.

## Residual limitations

- The clock recognizer intentionally accepts a small grammar, so faithful abbreviations or differently punctuated source-relative prose may still be held. That is a conservative availability limit. Complete semantic verification remains authoritative for admitted forms.
- Generation guidance for exact epistemic predicates, person-subject/page suggestions and citation grouping can improve first-pass behavior but cannot guarantee it. The system continues to fail closed through semantic, ownership and excerpt-selection checks.
- The current review establishes local grammar/dataflow safety and compiled wiring. It does not establish live semantic reliability, lower-budget reliability, or fresh held-out performance.

Within those stated limits, the current V60 diff is ready to freeze and run through the declared diagnostics.
