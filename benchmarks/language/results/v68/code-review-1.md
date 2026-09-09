# V68 code review round 1

Base: `11c2098`
Scope: current uncommitted V68 runtime/tests/plan. No provider calls or fresh held-out inspection.

## Findings

### Medium — same-line name test accepts a substring inside a different token

Location: `packages/core/src/ops/answer.ts`, `memoryModelFields`, the `readableText.includes(speaker)` condition.

The contract says the hint repeats a named source already present in the current readable line. `String.includes` does not establish that exact occurrence: a source speaker `Ada` passes on a line containing only `Adaline`, and a speaker `Bo` passes inside `Boreal`. The resulting private generation payload then supplies `exact_spelling: "Ada"` and, for `answer_eligible:false` or `source_report`, `attribution_required:true`, even though that name is absent from readable evidence. This violates the stated source-local boundary and can cause generation to introduce metadata-only identity.

Use an exact Unicode letter/number boundary around the escaped speaker string, while preserving punctuation and whitespace inside real multiword names. Add a negative test with invented overlapping tokens and a positive with the exact same name adjacent to Markdown punctuation. Keep the existing private-frame/sibling negatives.

### Medium — both new clock branches accept a later explicit retraction

Locations: `packages/core/src/timeline/source-clock.ts`, `hasRussianExplainedSourceEntryClock` and the new direct-calendar branch in `hasUnknownReferenceClock`.

Both regexps treat `;` as a successful terminal and stop there. They therefore ignore a following clause that retracts the assertion:

```text
Ada Marlow предложила в следующем месяце рассмотреть условия ремонта Zephyr QX-100 — то есть в месяце после недатированной первоначальной записи; однако это неверно.
```

Current result: `hasSourceRelativeAnchor(...) === true`.

```text
Календарный месяц определить невозможно; однако затем его определили.
```

Current result: `hasUnknownReferenceClock(...) === true`.

The tests cover comma retractions, but not the semicolon form admitted by the terminal. This is within the explicit V68 retraction boundary, not a request for general discourse parsing. Either terminate only at end/period/exclamation for these new branches, or inspect the immediate semicolon continuation and reject the bounded adversative/correction heads (`но`, `однако`, `а`, `это неверно`) while retaining any exact required continuation. Add both reproductions. Mandatory semantic verification still limits these local false admissions, but the new floor should not claim the retracted clock evidence is present.

### Medium — comma-`и` unknown-clock start inherits a conditional clause

Location: `packages/core/src/timeline/source-clock.ts`, new `hasUnknownReferenceClock` regexp.

The start alternative `,[ \t]+и` is needed for row 233, but it is treated as an unconditional clause boundary. It admits:

```text
Если запись потеряна, и календарный месяц определить невозможно.
```

Current result: `hasUnknownReferenceClock(...) === true`.

The existing negative `Если календарный месяц ...` only tests a conditional immediately before the predicate, so it misses this bypass. Bind the comma-and form to the affirmative preceding shape it is intended to continue (the closed no-plan/no-meeting clause or the new proposal/source-clock construction), rather than allowing it after arbitrary text. A simpler safe option is to make generation use a semicolon/period before the calendar predicate and remove generic comma-and admission. Add conditional, question/report, and quoted-prefix controls that place the prefix before an otherwise valid preceding clause.

## Other reviewed boundaries

The tentative `record_scope` addition is explanatory only and appears in per-record verifier payloads. Tests keep all three semantic dimensions mandatory and verify the scope does not survive into public results. It does not change commitment fields or acceptance logic.

The named-source hint is generation-only, omitted from verifier/public output, excludes generic roles, and does not draw from a private source frame or neighboring line. `attribution_required` does not bypass attribution or semantic guards. Fixing the exact-occurrence check above is sufficient; no new source authority is needed.

The Russian proposal grammar otherwise couples affirmative proposer, review predicate, period and direction, masks quotations with a non-splicing sentinel, bounds intervening words, and rejects the tested conditional/negative/question/name-borrowing cases. The direct unknown-calendar grammar keeps unknownness independent from source anchoring. The exact V67 q7 shape reaches both helpers, and the paired answer test retains mandatory semantic rejection for a changed review object.

Generation evidence accounting now calls `evidenceText` with the actual answer language, matching the serialized localized fields used in the request rather than estimating a different projection. Prompt/version and trial-plan changes are consistent. Output schemas, caps, model selection, pass count, retry behavior, and semantic acceptance gates are unchanged.

Round-one disposition: three bounded blockers remain before freeze. All are local boundary corrections; none requires a new parser, model pass, retry, schema, or gate relaxation.

## Fix recheck

All three round-one findings are resolved in the current diff.

- The source-name occurrence check now escapes the supplied name and applies Unicode letter, number, underscore, and hyphen boundaries. The prior `Ada`/`Adaline` substring case is rejected, while an exact name next to Markdown punctuation remains eligible. This keeps the hint tied to a name actually present in the current readable line.
- Both new Russian clock endings now reject an immediate semicolon adversative or correction, including capitalized and newline-separated variants. Direct replays of the two prior examples now return false; the intended closed affirmative source-entry explanation remains accepted.
- The generic comma-`и` unknown-calendar start has been removed. That continuation is admitted only after the bounded affirmative personal no-plan/no-meeting clause. The prior conditional bypass now returns false, while the intended denial followed by calendar unknowability returns true. Added conditional, report, question, and quoted-prefix controls exercise the surrounding boundary.

The corrected focused run reported 765 passing tests across three files in `tmp/v68-review1-corrected.log`; I did not rerun it. The earlier full run predates these production fixes, so final full-gate status remains root-owned. I found no further actionable defect in this bounded recheck. The semantic verifier remains mandatory, and the fixes do not alter schemas, caps, models, pass count, retry behavior, or acceptance dimensions.
