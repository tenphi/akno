# V68 code review round 2

Base: `11c2098`
Scope: current V68 implementation diff and `benchmarks/language/v68-trial-plan.md`. Review was read-only; no provider calls or fresh held-out inputs were used.

## Result

No unresolved production blocker remains in the reviewed diff after two bounded fixes made during this round. The named-source field is private generation guidance bound to the same current readable line, the tentative definition supplies no evidence and leaves every semantic acceptance dimension mandatory, and the two new Russian clock recognizers remain local prerequisites followed by full-source semantic verification.

The exposed evaluation is still required to establish model usefulness. These prompt and finite-grammar changes do not establish semantic reliability by themselves.

## Findings and resolutions

### Medium, resolved — a conjoined semicolon retraction bypassed both new clock endings

Locations: `packages/core/src/timeline/source-clock.ts:123-124`, used by `hasDirectUnknownRussianCalendar` and `hasRussianExplainedSourceEntryClock`.

The round-one repair rejected `; это неверно`, `; но ...`, `; однако ...`, and `; а ...`, but the immediately conjoined form remained live:

```text
Ada Marlow предложила в следующем месяце рассмотреть условия ремонта Zephyr QX-100 — то есть в месяце после недатированной первоначальной записи; и это неверно.

Календарный месяц определить невозможно; и это неверно.
```

Before the correction, the first returned `hasSourceRelativeAnchor(...) === true` and the second returned `hasUnknownReferenceClock(...) === true`. This did not bypass the mandatory semantic verifier, but it was inside the new bounded retraction family and made the local floor claim that retracted clock material was present.

`RUSSIAN_CLOCK_END` now rejects optional `и ` before `это неверно`, including the capitalized form. Direct replay returns false for both examples, and tests cover both clock branches. The positive source-entry explanation and independent calendar predicate remain accepted.

### Medium, resolved — exact-name boundaries omitted Unicode combining marks

Location: `packages/core/src/ops/answer.ts:1316-1324`.

After the initial substring fix, a metadata speaker `Bo` still matched the current readable token `Bo\u0301`. That could create `named_source_reference.exact_spelling:"Bo"` even though the exact source name was absent from the line. This violated the feature's current-line byte-binding rule rather than merely reducing model quality.

The boundary class now includes Unicode combining marks and Unicode dash punctuation. It also excludes apostrophe-joined name prefixes and suffixes while preserving straight and curly possessives such as `Ada Marlow's` and `Ada Marlow’s`. Added tests cover decomposed marks, Unicode dashes, both apostrophe join directions, Markdown punctuation, and both possessive forms. The implementation remains case-sensitive and does not normalize the supplied spelling, as required for an exact rendering hint.

## Source and dataflow review

`memoryModelFields` creates `named_source_reference` only when all of the following are true:

- serialization is for answer generation;
- the indexed line is qualified;
- a nongeneric `source_speaker` exists;
- that exact spelling passes the current line's bounded occurrence check.

The test and call-path inspection confirm that a title, sibling prose, private retention frame, graph label, or source-speaker metadata by itself cannot create the hint. Each line is serialized independently at `answer.ts:1144-1162`, so one qualified line cannot lend its name to another. Generic `assistant`, `the assistant`, `user`, `the user`, `ассистент`, and `пользователь` stay translatable roles. Existing `source_label` behavior for generic assistants is unchanged.

`attribution_required` mirrors the existing guard condition: `source_report` or `answer_eligible:false`. It does not alter evidence selection or validation. The prompt at `answer.ts:207-213` explicitly keeps the readable record's predicate and allows neutral provenance where no material action is supported. Existing attribution, action-role, language, source-alignment, and semantic checks still decide publication. A transliterated or omitted required name is held by the existing local guard; an invented discussion/action is still submitted only to the mandatory semantic verifier and rejected when any semantic dimension is false.

The field is absent from `evidenceText(..., false)`, verifier requests, returned context, citations, and public answer results. `answerLanguageReferences` remains the post-generation language-check allowance and is not treated as source authority or a generation requirement. Documents and observations do not acquire the page-memory hint.

The generation evidence estimate at `answer.ts:608-614` now uses the same `answerLanguage` argument as the actual serialized generation evidence. This counts the new hint and localized display fields instead of estimating a different projection. It does not change the configured output ceiling.

## Tentative scope review

`semanticRecordScope` adds the definition only for records whose commitment is `tentative`. Its conditional wording requires both supplied source and candidate to explicitly couple an asserted discussion or consideration act with competing preliminary or unsupported hypotheses. It says that the label qualifies the embedded hypotheses, while expressly preserving actor, predicate, alternatives, evidence limits, and personal nonselection. All other tentative records retain the ordinary whole-proposition interpretation.

The helper is passed only to the existing retention and answer verification payloads. It is not generation evidence or public output. Tests demonstrate that an asserted version of the same candidate remains locally noncanonical and that false `proposition_supported`, `action_arguments_preserved`, or `qualification_scope_preserved` outcomes each withhold the candidate. The scope text cannot override a negative dimension or create the outer act.

## Clock boundaries and practical limits

The proposal-clock recognizer couples one affirmative clause-head actor, proposal verb, deictic period, bounded review object, `то есть` explanation, matching period/direction, and the undated original record. It masks quotations with a nonsplicing sentinel and rejects tested negation, question, report, conditional, wrong-period, wrong-direction, cross-clause, and immediate correction forms.

The independent unknown-calendar recognizer accepts a clause-head `календарный <день|месяц|год> определить невозможно`, or the exact coordinated continuation after the bounded no-plan/no-meeting clause. The earlier arbitrary comma-`и` entrance is absent. Source-relative anchoring and unknownness remain separate required booleans in retention and answer cleaning; passing one does not imply the other.

These regexes intentionally cover finite sentence shapes. Unlisted paraphrases can still be held, and a later independent contradiction outside the bounded immediate retraction heads remains full-verifier work. Conversely, returning true from either helper is not semantic approval: retention and answer publication still require the complete-source verdict. No broad modal, quotation, or attribution heuristic was weakened.

## Protocol and validation

The diff changes generation input prose/metadata and verifier prompt text only. It adds no provider output property, Zod branch, enum, null relation, public protocol field, model call, retry, repair, or acceptance dimension. Output caps, the Luna runtime role, semantic pass count, and trial gates remain unchanged. Prompt versions move consistently to answer generation 63, answer verifier 43, and retention verifier 34; benchmark expectations and the trial plan agree.

I ran the three directly affected files on the final corrected tree:

```text
packages/core/src/ops/answer.test.ts
packages/core/src/timeline/source-clock.test.ts
packages/core/src/write/retain-verification.test.ts

3 files passed, 777 tests passed
```

`git diff --check` also passed. After both round-two corrections, the parent reported the final whole suite passing with 3,055 tests across 144 files in `tmp/v68-final-suite.log`; build, lint, and formatting also passed. Parent-run compiled mock controls for presentation, bounded semantics, and clock/name boundaries passed in `tmp/v68-prefreeze-{presentation,bounded,boundaries}.log`. Those mocks establish transport, dataflow, and guard behavior rather than live semantic reliability.
