# V64 code review round 2

## Result

No blocking or substantive correctness finding remains in the reviewed V64 diff. The implementation keeps all three changes bounded to their declared roles:

- precise observability and repair guidance for the existing 400-UTF-16-unit retention limit;
- a generation-only localized outer-report phrase derived from existing qualified attribution metadata;
- removal of the complete-record `copy` schema arm when declared knowledge and requested answer languages differ.

No source, reporter, qualification, selection, semantic-verdict, ownership, retry, model, pass, token-ceiling, or source-clock gate is weakened.

## Retention limit and repair binding

[`retain.ts`](../../../../packages/core/src/write/retain.ts) lines 220-225 accurately describe the already-enforced normalization order and unit: trim, fold whitespace, then measure JavaScript string length as UTF-16 code units. The runtime check at lines 1152-1168 now distinguishes fewer than four normalized words, more than 400 normalized UTF-16 units, and failure to form a self-contained statement. It does not truncate or admit over-limit prose.

The detailed length issue flows through the existing candidate ID and original-position map. The repair transaction remains keyed by the failed zero-based extraction positions; admitted candidates are sent only through `read_only_admitted_context`, deep-compared after reconstruction, and cannot be replaced, deduplicated away, or mutated. Accepted repairs retain their original-position obligation and still enter the same full-source semantic verifier. The new wording about having, receiving, and personally performing confirmation correctly distinguishes the action predicates without supplying a lexical exemption.

[`retain-repair.test.ts`](../../../../packages/core/src/write/retain-repair.test.ts) lines 84-180 exercise 399/400/401 boundaries, whitespace folding, astral-symbol UTF-16 behavior, the exact over-limit diagnostic at original position 0, an independently admitted sibling at position 1, the original repair obligation, and both accepted and semantic-negative repaired prose. The negative fixture changes receipt of confirmation into performance of confirmation and is withheld by the mandatory supplied semantic verdict. This is a dataflow/fail-closed test, not evidence that a model will always notice that distinction; the V64 plan states that semantic competence remains for frozen evaluation.

## Localized outer-report presentation guidance

[`answer.ts`](../../../../packages/core/src/ops/answer.ts) lines 1192-1203 adds `report_source_display_phrase` only when all of the following hold: the fields are being rendered for generation, an output language is resolved, the memory is qualified, and its basis is `source_report`. A named source keeps its exact stored spelling. A generic assistant role becomes `According to the assistant` or `По словам ассистента`. Missing speaker identity produces no hint.

The phrase is derived only from the already-present source role/speaker metadata. It supplies a neutral presentation form and does not name an inner reporter, assert that the outer source created or recorded anything, select a proposition, or alter retained text. The generation contract at lines 196-211 explicitly requires the selected record's actual outer/inner roles and independent material-action actors, and says the hint is neither evidence nor mechanically prepended text.

The dataflow remains private to the generation request. `answerMessages` calls `evidenceText(..., true, outputLanguage)` for generation, while verifier evidence calls `evidenceText` without the generation flag; returned context and citations retain the original protocol memory fields. The tests inspect those boundaries and show that the key is absent from verifier payloads, source files, returned context, and public results. A model may naturally emit the phrase itself in answer prose, which is its intended use; every such sentence still passes the unchanged named/generic reporting-role guards and full semantic verification.

The positive nested-report guidance remains safer than broadening `hasBoundReporter`: it prefers `По словам OUTER, INNER сообщил ...`, while the V63 predicate-before-name drafts would remain held if a model ignored the hint. Existing negative semantics still withhold a fluent but unsupported hinted answer. I find no new attribution-authority or adjacent-proposition path.

## Declared-language copy restriction

[`answer-record-rendering.ts`](../../../../packages/core/src/ops/answer-record-rendering.ts) lines 12-40 leaves the single-record/frame/qualified-line/current-text/reference/600-unit eligibility checks unchanged and adds only `copy_allowed:false` when both policy languages are present and differ. The flag does not assert the current payload's language. It removes a shortcut that conflicts with the declared policy; same-policy and unset-policy cases keep the existing copy-or-translate choice.

Lines 43-58 make the mismatch shape a single strict `translate` object with the existing exact evidence ID, required bounded text, and no extra properties. A forbidden `copy`, missing translation text, foreign ID, duplicate ID, or extra authority field fails schema validation. The outer generation path still supplies `outputLanguage`, so generated translation text undergoes the actual language check. Copy materialization remains covered by `additionalLanguageProse` when copy is permitted. The translated material then passes the unchanged local guards and singleton complete-record verifier with immutable answer/source anchors, complete-record scope, excerpt selection, all three semantic booleans, and source alignments.

The integration test covers valid translation, forbidden copy, language-negative translation, and semantic-negative translation. It confirms that only the valid translation publishes, invalid/language-negative branches do not reach semantic verification, the semantic-negative branch does, the full original frame reaches verification unchanged, and `copy_allowed` is absent from the result. The helper matrix covers same, different, and unset policy combinations and confirms the strict transport shape. No text-language detector, historical-receipt inference, public schema field, extra call, or retry is introduced.

## Versioning, plan, and validation

The prompt versions correctly advance to answer generation v59 and retention extraction v47; answer verifier v39 and retention verifier v31 remain unchanged because their prompts and schemas do not change. The grounded-answer benchmark expectation is updated to v59. [`v64-trial-plan.md`](../../v64-trial-plan.md) records the three changes separately, keeps the 2,400-token isolated-evaluation setting and all release gates unchanged, and requires transport controls before either declared probe.

The first focused run had two English-hint fixture failures because the fixture lacked the canonical visible tentative report label required by existing qualification guards. The fixture was corrected to `**Reported by Ada Marlow · Tentative:**`; the targeted two cases then passed. This was a test-fixture setup issue and did not require a runtime relaxation.

Independent checks during this review:

- `pnpm vitest run packages/core/src/ops/answer-record-rendering.test.ts packages/core/src/write/retain-repair.test.ts packages/core/src/ops/answer.test.ts` — 508 tests in three files passed.
- `git diff --check` — passed.

Current-tree receipts inspected:

- [`v64-suite.log`](v64-suite.log) — 2,740 tests in 143 files passed.
- [`v64-translation-preflight.log`](v64-translation-preflight.log) — compiled translation-only schema, forbidden-copy rejection, current-payload language checking, complete-record verification, mandatory semantics/selection, strict JSON, unchanged source bytes, and zero extra passes all reported true.
- Build/typecheck, lint, knip, formatting, documentation doctor/build, and repository-safety logs are green. Smoke, installed-package, and actual-provider transport controls were still plan/final-gate responsibilities at the time of this review and are not model-competence evidence.

## Residual limitations

The new instructions cannot guarantee that Luna will choose the neutral phrase, compress a long proposition without semantic loss, or produce a faithful translation. Existing guards and the verifier fail closed when they detect those failures; the declared frozen probes remain the evidence for useful-answer and retention reliability. The configured knowledge language is used only to remove `copy`; it never proves the language of existing bytes, so an old or mixed-language record may still require the model to return unchanged prose through the `translate` arm before the actual language checker decides it.

Within those documented limits, the current V64 diff is ready to freeze after the remaining planned local/protocol checks complete.
