# V53 code review — round 2

## Disposition

Clean after the fixes described below. I found no remaining blocker in the bounded V53 diff from `3f164c2`. The changes preserve the mandatory semantic verifier, one structural repair, existing routing/model/pass/schema contracts and the declared gates. The new deterministic recognizers remain necessary language floors rather than semantic approval.

## Findings and resolutions

### Medium — the coordinated-report suffix initially admitted a positive retraction — resolved

The first round-two state still allowed a complete negative list to stop immediately before arbitrary `, so` or `, therefore` text. Consequently this candidate passed the readable uncertainty floor even though its continuation affirmed confirmation:

```text
Ada Marlow has not read the contract or independently confirmed the report, so she then confirmed the report.
```

The final implementation at [packages/core/src/write/retain.ts:976](../../../../packages/core/src/write/retain.ts#L976) consumes only the closed negative explanation “so/therefore it is/was not a/the condition/term/requirement ACTOR has/have/had verified/confirmed,” then requires end, sentence punctuation, semicolon or newline. It no longer accepts an arbitrary continuation. The regressions at [packages/core/src/write/retain-report-uncertainty.test.ts:51](../../../../packages/core/src/write/retain-report-uncertainty.test.ts#L51) cover `and then`, adversative retraction, positive `so`/`therefore` continuations, and a negative explanation followed by a comma-spliced positive retraction. The intended V52 explanatory wording still passes.

### Medium — adjacency alone treated a dependent Russian noun as the qualified epistemic head — resolved

The initial `установлен` extension reused the broad two-order adjacency expression. It therefore treated the following instrumental noun as the uncertainty head in sentences such as:

```text
Гипотезы подтверждены. Не установленный версией компонент лежал рядом.
Не установленная гипотезой деталь лежала рядом.
```

In both cases the adjective qualifies the later component/detail; `версией` or `гипотезой` is a dependent. This would have let an unrelated installation/establishment denial satisfy the deterministic tentative floor, although the semantic verifier would still have run.

The final implementation at [packages/core/src/ops/answer.ts:1580](../../../../packages/core/src/ops/answer.ts#L1580) removes `установлен` from the generic adjacency family and uses bounded agreement pairs for the new adjective forms. The two reproductions are negative integration cases at [packages/core/src/ops/answer.test.ts:1714](../../../../packages/core/src/ops/answer.test.ts#L1714). Feminine, accusative and plural/instrumental positive forms remain supported.

### Medium — the first agreement fix omitted natural post-head predicates — resolved

After the generic `установлен` alternative was removed, only adjective-before-head forms remained. Natural predicates such as `Эти гипотезы остались не установленными` then failed the tentative floor, even though the intended family previously allowed its epistemic head before the uncertainty expression.

The bounded reverse branch at [packages/core/src/ops/answer.ts:1601](../../../../packages/core/src/ops/answer.ts#L1601) now accepts agreeing nominative epistemic subjects followed by a matching predicate adjective, including the existing remain/still modifiers, and requires punctuation or end after the adjective. It does not reopen unrestricted adjacency. Tests cover plural, feminine and neuter predicates and reject `Гипотезы не установленными компонентами не объясняются` at [packages/core/src/ops/answer.test.ts:1695](../../../../packages/core/src/ops/answer.test.ts#L1695).

## Other reviewed boundaries

- Source and candidate report prose use the same `hasReportUncertainty` helper. The new branch requires one finite negative auxiliary over a two-member terminal `or` list or the closed three-member comma/terminal-`or` list. A new subject, positive auxiliary, adversative or incomplete comma list does not borrow its negation.
- A candidate that passes either new lexical floor still reaches the unchanged semantic verifier. Tests cover semantic rejection with and without the single structural repair and confirm that a second repair is not attempted.
- Existing broad joined and short Russian uncertainty forms remain untouched. The new agreement grammar intentionally does not decide whether `версия` means a hypothesis or a software version, nor does it parse every same-case dependency; those semantic and syntactic ambiguities remain with mandatory verification rather than motivating a broad heuristic.
- The answer generation prompt gives only the selected record's bound original frame authority to resolve a query's ambiguous term. It retains the existing rule that the question, a dictionary sense and adjacent unselected content supply no evidence, and it does not relax excerpt selection or source-frame conflict handling.
- Tentative temporal status is attached to timing/date language while asserted proposal commitment and a genuinely tentative proposition remain separate dimensions.
- Prompt version changes, benchmark expectation, changeset and V53 trial plan agree with the runtime scope. The trial plan retains the per-run thresholds and unchanged model/retry policy.
- All added fixture names, identifiers and prose are invented and conform to `AGENTS.md`.

## Verification

Focused final command:

```text
pnpm exec vitest run packages/core/src/write/retain-report-uncertainty.test.ts packages/core/src/ops/answer.test.ts packages/core/src/bench/answer.test.ts --reporter=dot
```

Result: 3 files passed, 407 tests passed. `git diff --check` passed. The parent reported the final complete rerun after the agreement and reverse-predicate changes: `tmp/v53-suite.log` records 2,393 tests in 138 files at 02:51:22. Build/typecheck, lint, knip, formatting, smoke/packages and repository-safety checks also passed; documentation doctor/build had passed against the same documentation state. No runtime change followed those checks.

## Review limitation

This review establishes the structural boundaries and verifier wiring from source and deterministic tests. It does not establish model-level language reliability for the two generation-only prompt additions; the declared frozen exposed evaluation is the appropriate evidence for those effects.
